import type { FaqMatch, FaqSearchMethod } from "./faq-search";
import { resolveAnswer } from "./faq-search";
import { KIND_LABELS } from "./types";
import type { ConversationKind, SupportedLocale, ToneSettings } from "./types";

/**
 * Construction du prompt de génération de brouillon.
 *
 * Isolé de l'appel API pour une raison précise : le prompt est la pièce la plus
 * sensible du module — c'est lui qui règle ce que le modèle a le droit
 * d'affirmer — et il doit être testable sans réseau, sans clé, et sans coût.
 *
 * Le modèle répond **toujours**. Ce qui change selon la FAQ, c'est le statut de
 * la réponse : appuyée sur des extraits cités et vérifiables, ou proposition
 * écrite sans source. Un opérateur relit et valide dans les deux cas ; refuser
 * de rédiger ne le dispensait pas d'écrire, ça lui laissait juste une page
 * blanche.
 */

export const PROMPT_VERSION = "moderation-draft-2026-09-11";

/**
 * Deux registres, et c'est le **type de conversation** qui tranche, pas le
 * réglage de longueur du client.
 *
 *   • Commentaire (et mention en story) — public, lu en défilant : très court,
 *     et il relance la conversation. `tone.target_length` est délibérément
 *     ignoré ici : un paragraphe de six phrases sous un post ne se lit pas.
 *   • Message privé (et avis) — une correspondance : « Bonjour », puis une
 *     signature.
 */
function registerOf(kind: ConversationKind): "public" | "message" {
  return kind === "dm" || kind === "review" ? "message" : "public";
}

/**
 * Instructions système. Le ton de la marque, le registre du canal, et une
 * frontière nette entre ce qui est documenté et ce qui ne l'est pas.
 */
export function buildSystemPrompt(options: {
  clientName: string;
  tone: ToneSettings;
  locale: SupportedLocale;
  kind: ConversationKind;
}): string {
  const { clientName, tone, locale, kind } = options;
  const register = registerOf(kind);

  const address =
    tone.address === "tu"
      ? "Tutoie la personne (« tu »)."
      : "Vouvoie la personne (« vous »).";

  const emojis = tone.emojis_allowed
    ? "Un emoji est acceptable s'il est naturel ; jamais plus d'un."
    : "N'utilise aucun emoji.";

  const length =
    register === "public"
      ? "Une à deux phrases, pas davantage."
      : {
          short: "Deux à trois phrases maximum.",
          medium: "Quatre à six phrases maximum.",
          long: "Un paragraphe court, huit phrases maximum.",
        }[tone.target_length];

  // La signature par défaut n'existe qu'en message privé : sous un commentaire
  // public, signer chaque réponse est une manie d'entreprise, pas un usage.
  const signature =
    register === "message"
      ? `Termine par la signature exacte : « ${tone.signature ?? `L'équipe ${clientName}`} ».`
      : tone.signature
        ? `Termine par la signature exacte : « ${tone.signature} ».`
        : "N'ajoute aucune signature.";

  const opening =
    register === "message"
      ? "Commence par « Bonjour », suivi du prénom de la personne si tu le connais."
      : "Réponds directement, sans formule d'accroche du type « Merci de votre message ».";

  const relance =
    register === "public"
      ? "- Termine par une question ou une invitation qui donne envie de répondre en commentaire ou en message privé."
      : "- N'invente pas de relance commerciale : réponds à ce qui est demandé.";

  const language =
    locale === "en"
      ? "Rédige la réponse en anglais."
      : "Rédige la réponse en français.";

  return `Tu rédiges les réponses de ${clientName} sur ses réseaux sociaux, pour un opérateur humain qui les relira avant envoi.

Type de conversation : ${KIND_LABELS[kind]}.

CE QUE TU AFFIRMES — les extraits de FAQ fournis dans le message sont ta seule
source de faits sur ${clientName}. N'invente jamais un délai, un prix, une
adresse, un horaire, une politique de retour, une disponibilité, un nom de
produit ou une procédure, et ne prends aucun engagement au nom de la marque :
pas de geste commercial, pas de remboursement, pas de dérogation.

QUAND LA FAQ NE COUVRE PAS LA DEMANDE — tu rédiges quand même. Tu écris une
réponse humaine et utile qui accuse réception, reste générale sur ce que tu ne
sais pas, et propose la suite (« on vous répond en message privé », « notre
équipe revient vers vous »). Tu mets alors \`grounded_in_faq\` à faux et tu dis
dans \`missing_information\` ce qui manque à la FAQ pour répondre vraiment. Une
page blanche ne protège personne : c'est l'affirmation non documentée qui est
interdite, pas la réponse.

Ton et forme :
- ${language}
- ${address}
- ${length}
- ${emojis}
- ${opening}
- ${signature}
${relance}
- Pas de mise en forme Markdown : ce texte part dans une messagerie.

Le champ \`confidence\` mesure à quel point les extraits couvrent réellement la
question, pas la qualité de ta rédaction. Sois sévère : 0,95 signifie qu'un
extrait répond mot pour mot ; 0,6 signifie que tu extrapoles depuis un extrait
voisin ; une réponse sans source documentée reste sous 0,4.`;
}

/**
 * Message utilisateur : la FAQ **avant** la question.
 *
 * Cet ordre n'est pas cosmétique. Les extraits FAQ d'un client sont stables d'un
 * message à l'autre, la question ne l'est jamais : placer la partie stable en
 * tête permet de poser un point de cache derrière elle et de ne payer le préfixe
 * qu'une fois par client.
 *
 * `faqBlock` est `null` quand rien n'a été trouvé — FAQ vide, ou aucune entrée
 * qui s'approche. Le prompt tourne alors sans bloc FAQ ; il ne refuse pas de
 * tourner.
 */
export function buildUserPrompt(options: {
  matches: readonly FaqMatch[];
  method: FaqSearchMethod;
  /** Les extraits couvrent-ils la demande, ou ne sont-ils que des approches ? */
  answerable: boolean;
  locale: SupportedLocale;
  conversationExcerpt: string;
  question: string;
  channelLabel: string;
  kind: ConversationKind;
}): { faqBlock: string | null; questionBlock: string } {
  const {
    matches,
    method,
    answerable,
    locale,
    conversationExcerpt,
    question,
    channelLabel,
    kind,
  } = options;

  const faqBlock = matches.length === 0 ? null : buildFaqBlock(matches, method, answerable, locale);

  const faqNote =
    matches.length === 0
      ? "Aucun extrait de FAQ ne se rapproche de ce message : rédige une réponse générale, sans rien affirmer que tu ne saurais.\n\n"
      : "";

  const questionBlock = `${faqNote}<contexte>
Canal : ${channelLabel}
Type : ${KIND_LABELS[kind]}
Historique récent de la conversation :
${conversationExcerpt || "(aucun échange antérieur)"}
</contexte>

<message_a_traiter>
${question}
</message_a_traiter>

Rédige la réponse. Appuie-toi en priorité sur les extraits ci-dessus et indique
dans \`used_faq_entry_ids\` les identifiants de ceux dont tu t'es réellement
servi — pas ceux que tu as lus sans t'en servir. S'ils ne couvrent pas la
demande, réponds quand même, mets \`grounded_in_faq\` à faux et laisse
\`used_faq_entry_ids\` vide.`;

  return { faqBlock, questionBlock };
}

function buildFaqBlock(
  matches: readonly FaqMatch[],
  method: FaqSearchMethod,
  answerable: boolean,
  locale: SupportedLocale,
): string {
  const extracts = matches
    .map((match, index) => {
      const answer = resolveAnswer(match.entry, locale);
      const translationNote =
        answer?.translated === true
          ? "\n  (réponse disponible en français uniquement — traduis-la)"
          : "";
      return [
        `[${index + 1}] id: ${match.entry.id}`,
        `  question de référence : ${match.entry.question_canonical}`,
        `  réponse de référence : ${answer?.text ?? "(aucune)"}${translationNote}`,
        `  proximité mesurée : ${match.similarity.toFixed(2)}`,
      ].join("\n");
    })
    .join("\n\n");

  // Dire comment le rapprochement a été fait, et à quelle distance : un
  // recoupement de mots n'a pas la valeur d'un rapprochement de sens, et un
  // extrait sous le seuil est une piste, pas une réponse.
  const how =
    method === "embedding"
      ? "Rapprochement par sens (index sémantique)."
      : "Rapprochement par mots communs uniquement — approximation, l'index sémantique n'était pas disponible.";
  const coverage = answerable
    ? "Ces extraits couvrent la demande."
    : "Ces extraits sont les plus proches trouvés, sous le seuil de certitude : traite-les comme des pistes, pas comme des réponses.";

  return `<faq_extraits>
${how}
${coverage}

${extracts}
</faq_extraits>`;
}

/**
 * Schéma de sortie. Contraindre le format évite de parser du texte libre, et
 * `used_faq_entry_ids` rend les sources vérifiables : un opérateur peut cliquer
 * sur l'entrée citée pour contrôler que la réponse en découle.
 *
 * `grounded_in_faq` a remplacé `can_answer` : la question n'est plus « peux-tu
 * répondre ? » — la réponse existe toujours — mais « sur quoi repose-t-elle ? ».
 */
export const DRAFT_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    grounded_in_faq: {
      type: "boolean",
      description:
        "Vrai si la réponse repose sur les extraits FAQ fournis, faux si elle est générale.",
    },
    answer: {
      type: "string",
      description: "La réponse à envoyer, dans tous les cas. Jamais vide.",
    },
    language: { type: "string", enum: ["fr", "en"] },
    confidence: {
      type: "number",
      description:
        "Couverture de la question par les extraits, entre 0 et 1. Pas la qualité rédactionnelle.",
    },
    used_faq_entry_ids: {
      type: "array",
      items: { type: "string" },
      description: "Identifiants des extraits réellement utilisés. Vide si aucun.",
    },
    missing_information: {
      type: "string",
      description:
        "Ce qui manque à la FAQ pour répondre sans extrapoler. Vide si elle suffisait.",
    },
  },
  required: [
    "grounded_in_faq",
    "answer",
    "language",
    "confidence",
    "used_faq_entry_ids",
    "missing_information",
  ],
  additionalProperties: false,
} as const;

export type DraftGeneration = {
  grounded_in_faq: boolean;
  answer: string;
  language: SupportedLocale;
  confidence: number;
  used_faq_entry_ids: string[];
  missing_information: string;
};

export type ValidatedGeneration = {
  /** Y a-t-il une réponse à montrer ? Seule une réponse vide est refusée. */
  usable: boolean;
  /** Repose-t-elle sur des sources FAQ réellement fournies et citées ? */
  grounded: boolean;
  sources: { faq_entry_id: string; question: string; similarity: number }[];
  confidence: number;
  droppedIds: string[];
};

/**
 * Valide la sortie du modèle contre ce que la recherche a réellement fourni.
 *
 * Deux règles, et une seule a changé de conséquence :
 *
 *   • les identifiants qui n'étaient pas dans les extraits sont écartés — un
 *     modèle contraint par schéma peut malgré tout citer un id inventé ;
 *   • un brouillon sans source vérifiable n'est plus **rétrogradé**, il est
 *     **marqué**. C'était le verrou le plus sournois : il annulait une
 *     génération hors FAQ même excellente, et laissait l'écran vide. La
 *     distinction se fait maintenant à l'affichage, où une proposition sans
 *     source se reconnaît d'un coup d'œil.
 */
export function validateGeneration(
  generation: DraftGeneration,
  matches: readonly FaqMatch[],
): ValidatedGeneration {
  const byId = new Map(matches.map((match) => [match.entry.id, match]));

  const sources: { faq_entry_id: string; question: string; similarity: number }[] = [];
  const droppedIds: string[] = [];

  for (const id of generation.used_faq_entry_ids) {
    const match = byId.get(id);
    if (!match) {
      droppedIds.push(id);
      continue;
    }
    sources.push({
      faq_entry_id: id,
      question: match.entry.question_canonical,
      similarity: match.similarity,
    });
  }

  const confidence = Math.min(Math.max(generation.confidence, 0), 1);
  const usable = generation.answer.trim().length > 0;
  // Se déclarer sourcé sans citer une entrée vérifiable ne vaut pas source :
  // c'est la citation qui se contrôle, pas la déclaration.
  const grounded = generation.grounded_in_faq && sources.length > 0;

  return { usable, grounded, sources, confidence, droppedIds };
}
