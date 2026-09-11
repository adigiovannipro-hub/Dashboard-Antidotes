/**
 * Assemblage du contexte injecté dans les prompts de génération.
 *
 * **Une seule chaîne, une seule fois.** Avant cette refonte il y en avait
 * deux : `buildInjectedContext()` servait le compteur de tokens de l'écran,
 * et la génération passait par `getClientContext()`, qui rendait trois chaînes
 * séparées interpolées dans trois markdown différents — dont deux n'ont
 * jamais reçu les règles de plateforme. Le compteur mesurait donc une chaîne
 * que le modèle ne lisait pas, et un champ pouvait être rempli, compté,
 * affiché, sans jamais partir nulle part.
 *
 * Désormais : `buildContextSections()` rend un **tableau de sections**
 * `{ titre, texte, tokens }`, la génération en fait le `join`, et la modale
 * « Voir le prompt injecté » l'affiche telle quelle. Si l'écran annonce
 * 4 200 tokens, ce sont les 4 200 tokens qui partent.
 *
 * Fonction pure : aucun import Supabase, tout arrive en argument.
 */
import { normalizeDeliverables, renderDeliverables } from "./deliverables";
import { isFactStale, isTemporalContextStale, monthlyInstructionState } from "./freshness";
import { estimateTokens } from "./token-estimate";
import type {
  ClientAsset,
  ClientContext,
  ClientGenerationSettings,
  ContextPillar,
} from "./types";
import { ASSET_TYPE_LABELS } from "./types";

/**
 * Le titre de la section d'ajustement, exporté parce que la modale la
 * fabrique localement : taper dans le champ ne doit pas coûter un aller-retour
 * serveur, et deux titres écrits deux fois divergeraient au premier retouche.
 */
export const ADJUSTMENT_SECTION_TITLE = "Ajustement demandé au lancement (prioritaire)";

/** Une section du contexte injecté, dans l'ordre exact où le modèle la lit. */
export type ContextSection = {
  titre: string;
  texte: string;
  tokens: number;
};

export type InjectedContextInput = {
  brief: ClientContext | null;
  assets: ClientAsset[];
  settings: ClientGenerationSettings | null;
  /** Les accroches déjà publiées, la plus récente d'abord. */
  accroches: string[];
  /** Mois visé par la génération, `YYYY-MM-01`. Décide de la consigne du mois. */
  targetMonth: string | null;
  /** Ajustement à chaud, saisi au lancement. Jamais persisté. */
  adjustment?: string | null;
  now?: Date;
};

// --- Blocs élémentaires, réutilisés par la consolidation et le diff ---------

/** Le brief mis à plat — ce qui décrit la marque, sans les règles d'écriture. */
export function renderBrief(brief: ClientContext | null): string {
  if (!brief) return "";

  const lines: string[] = [];
  const push = (label: string, value: string | null) => {
    if (value && value.trim().length > 0) lines.push(`${label} :\n${value.trim()}`);
  };

  push("Contexte principal", brief.main_context);
  push("Cibles", brief.audience);
  push("Tone of voice", brief.tone_of_voice);

  return lines.join("\n\n");
}

/**
 * Une liste venue d'un `jsonb`, quoi qu'il s'y trouve.
 *
 * `pillars`, `validated_examples` et `sourced_facts` sont des colonnes jsonb :
 * le type TypeScript décrit ce que l'écran y **écrit**, pas ce que la base y
 * **contient**. Un pilier posé avant qu'une clé n'existe, ou rendu par le
 * parseur de consolidation, peut très bien n'avoir ni `formats` ni `angles` —
 * et `undefined.length` faisait alors tomber la page entière, pas seulement la
 * section. Vu à l'écran sur un brief à deux piliers, jamais au typecheck.
 */
function asList<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

/** Un texte venu d'un `jsonb`, même absent. */
function asText(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Un pilier, avec son objectif business et ses appels à l'action autorisés. */
function renderPillar(pillar: ContextPillar): string {
  const formats = asList(pillar.formats);
  const angles = asList(pillar.angles);
  const cta = asList(pillar.cta_autorises);
  const details = [
    asText(pillar.description),
    asText(pillar.objectif_business)
      ? `Objectif business : ${asText(pillar.objectif_business)}`
      : "",
    formats.length > 0 ? `Formats : ${formats.join(", ")}` : "",
    angles.length > 0 ? `Angles : ${angles.join(", ")}` : "",
    // Une liste d'appels à l'action est une liste fermée : le modèle n'a pas à
    // en inventer un seizième au motif qu'il sonne bien.
    cta.length > 0
      ? `Appels à l'action autorisés (et eux seuls) : ${cta.join(" · ")}`
      : "",
    asText(pillar.frequence) ? `Fréquence : ${asText(pillar.frequence)}` : "",
  ].filter(Boolean);

  return `- ${pillar.nom}\n  ${details.join("\n  ")}`;
}

/** Les résumés des documents cochés, chacun sous son titre. */
export function renderAssetSummaries(assets: ClientAsset[]): string {
  return assets
    .filter((asset) => asset.include_in_context && asset.summary?.trim())
    .map(
      (asset) =>
        `[${ASSET_TYPE_LABELS[asset.type]} : ${asset.name}]\n${asset.summary!.trim()}`,
    )
    .join("\n\n");
}

/** Les règles de plateforme non vides, prêtes à filtrer par réseau. */
export function extractPlatformRules(
  brief: ClientContext | null,
): Record<string, string> {
  if (!brief) return {};

  const rules: Record<string, string> = {};
  for (const [platform, rule] of Object.entries(brief.platforms)) {
    if (typeof rule === "string" && rule.trim().length > 0) {
      rules[platform] = rule.trim();
    }
  }
  return rules;
}

// --- Le tableau de sections -------------------------------------------------

/**
 * L'ordre est une décision produit, pas un détail : le modèle lit ce qui
 * décrit la marque avant ce qui décrit le mois, et l'ajustement à chaud vient
 * en dernier parce qu'il tranche sur tout le reste.
 *
 * Deux blocs s'insèrent dans l'ordre demandé sans le contredire : les
 * documents de référence, qui décrivent la marque au même titre que le brief,
 * et les livrables mensuels, qui disent le volume dû — sans eux une génération
 * de mois entier ne sait pas combien de publications produire.
 */
export function buildContextSections(input: InjectedContextInput): ContextSection[] {
  const now = input.now ?? new Date();
  const brief = input.brief;
  const settings = input.settings;
  const sections: { titre: string; texte: string }[] = [];

  const add = (titre: string, texte: string) => {
    // Une section vide ne s'écrit pas : « Retours du client : (aucun) » coûte
    // des tokens pour apprendre au modèle qu'il n'apprendra rien.
    if (texte.trim().length > 0) sections.push({ titre, texte: texte.trim() });
  };

  // 1. La marque.
  add("La marque", renderBrief(brief));

  // 2. Les documents de référence cochés.
  add("Documents de référence", renderAssetSummaries(input.assets));

  // 3. Les piliers.
  const pillars = asList(brief?.pillars);
  if (pillars.length > 0) {
    add("Piliers de contenu", pillars.map(renderPillar).join("\n"));
  }

  // 4. Les livrables mensuels.
  if (brief) {
    add("Livrables mensuels", renderDeliverables(normalizeDeliverables(brief.deliverables)));
  }

  // 5. Les règles par plateforme — celles que deux prompts sur trois ne
  //    recevaient jamais.
  const rules = Object.entries(extractPlatformRules(brief));
  if (rules.length > 0) {
    add(
      "Règles par plateforme",
      rules.map(([platform, rule]) => `- ${platform} : ${rule}`).join("\n"),
    );
  }

  // 6. Les interdits, contraignants : reportés tels quels, jamais adoucis.
  add("Interdits (contraignants)", brief?.restrictions ?? "");

  // 7. Les exemples validés, entiers.
  const examples = asList(brief?.validated_examples);
  if (examples.length > 0) {
    add(
      "Exemples validés (registre à reproduire, jamais à recopier)",
      examples
        .filter((example) => asText(example.texte).length > 0)
        .map((example) => `[${example.reseau || "réseau non précisé"}]\n${asText(example.texte)}`)
        .join("\n\n"),
    );
  }

  // 8. Les retours du client.
  add("Retours du client (corrections, refus, formulations bannies)", brief?.client_feedback ?? "");

  // 9. Les faits sourcés. Un fait périmé part quand même — c'est une matière,
  //    pas une consigne — mais avec son âge dit, pour que le modèle n'en fasse
  //    pas une affirmation du jour.
  const sourced = asList(brief?.sourced_facts);
  if (sourced.length > 0) {
    const facts = sourced
      .filter((fact) => asText(fact.fait).length > 0)
      .map((fact) => {
        const repere = [
          asText(fact.source) ? `source : ${asText(fact.source)}` : "",
          fact.verifie_le ? `vérifié le ${fact.verifie_le}` : "non daté",
          isFactStale(fact.verifie_le, now) ? "À REVÉRIFIER" : "",
        ].filter(Boolean);
        return `- ${asText(fact.fait)} (${repere.join(", ")})`;
      });
    add(
      "Faits sourcés (seuls chiffres et affirmations autorisés)",
      facts.join("\n"),
    );
  }

  // 10. Les accroches déjà publiées, en négatif.
  const accroches = input.accroches.map((hook) => hook.trim()).filter(Boolean);
  if (accroches.length > 0) {
    add(
      "Accroches déjà utilisées — interdiction de les réécrire ou de les paraphraser",
      accroches.map((hook, index) => `${index + 1}. ${hook}`).join("\n"),
    );
  }

  // 11. Le contexte temporel, s'il décrit encore le moment.
  if (settings && !isTemporalContextStale(settings.temporal_context_at, now)) {
    add("Temps forts du moment", settings.temporal_context ?? "");
  }

  // 12. Les instructions permanentes.
  add("Instructions permanentes", settings?.permanent_instructions ?? "");

  // 13. La consigne du mois, si elle vise le mois généré.
  const monthly = monthlyInstructionState({
    instruction: settings?.monthly_instruction,
    month: settings?.monthly_instruction_month,
    targetMonth: input.targetMonth,
  });
  if (monthly === "active") {
    add("Consigne du mois", settings?.monthly_instruction ?? "");
  }

  // 14. L'ajustement à chaud : il tranche sur tout ce qui précède, donc il
  //     arrive en dernier. Rien n'en est persisté.
  add(ADJUSTMENT_SECTION_TITLE, input.adjustment ?? "");

  return sections.map((section) => ({
    ...section,
    tokens: estimateTokens(`${section.titre} :\n${section.texte}`),
  }));
}

/** Le texte exact envoyé au modèle. La modale l'affiche, le prompt le reçoit. */
export function renderContextSections(sections: ContextSection[]): string {
  return sections.map((section) => `${section.titre} :\n${section.texte}`).join("\n\n");
}

/** Le total affiché par la barre de complétude et par la modale. */
export function totalContextTokens(sections: ContextSection[]): number {
  return sections.reduce((total, section) => total + section.tokens, 0);
}
