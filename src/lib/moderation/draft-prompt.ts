import type { FaqMatch } from "./faq-search";
import { resolveAnswer } from "./faq-search";
import type { SupportedLocale, ToneSettings } from "./types";

/**
 * Construction du prompt de génération de brouillon.
 *
 * Isolé de l'appel API pour une raison précise : le prompt est la pièce la plus
 * sensible du module — c'est lui qui interdit d'inventer — et il doit être
 * testable sans réseau, sans clé, et sans coût.
 */

export const PROMPT_VERSION = "moderation-draft-2026-07-30";

/**
 * Instructions système. Volontairement contraignantes : le modèle n'a pas à
 * faire preuve d'initiative ici. Il reformule ce que la FAQ contient, dans la
 * langue du client final et le ton de la marque. Rien d'autre.
 */
export function buildSystemPrompt(options: {
  clientName: string;
  tone: ToneSettings;
  locale: SupportedLocale;
}): string {
  const { clientName, tone, locale } = options;

  const address =
    tone.address === "tu"
      ? "Tutoie le client (« tu »)."
      : "Vouvoie le client (« vous »).";

  const emojis = tone.emojis_allowed
    ? "Un emoji est acceptable s'il est naturel ; jamais plus d'un."
    : "N'utilise aucun emoji.";

  const length = {
    short: "Deux à trois phrases maximum.",
    medium: "Quatre à six phrases maximum.",
    long: "Un paragraphe court, huit phrases maximum.",
  }[tone.target_length];

  const signature = tone.signature
    ? `Termine par la signature exacte : « ${tone.signature} ».`
    : "N'ajoute aucune signature.";

  const language =
    locale === "en"
      ? "Rédige la réponse en anglais."
      : "Rédige la réponse en français.";

  return `Tu rédiges des réponses au service client de ${clientName}, pour un opérateur humain qui les relira avant envoi.

RÈGLE ABSOLUE — tu ne disposes d'aucune connaissance sur ${clientName} en dehors des extraits de FAQ fournis dans le message.

N'affirme que ce qui figure explicitement dans ces extraits. N'invente jamais un
délai, un prix, une adresse, une politique de retour, une disponibilité, un nom
de produit ou une procédure. Si les extraits ne permettent pas de répondre à la
question posée, ne rédige pas de réponse : renvoie \`can_answer: false\` en
expliquant ce qui manque. Une réponse plausible mais non documentée est une faute
plus grave qu'une absence de réponse.

Tu ne prends aucun engagement au nom de la marque : pas de geste commercial, pas
de remboursement, pas de dérogation, pas de date qui ne serait pas dans la FAQ.

Ton et forme :
- ${language}
- ${address}
- ${length}
- ${emojis}
- ${signature}
- Réponds directement, sans formule d'accroche du type « Merci de votre message ».
- Pas de mise en forme Markdown : ce texte part dans une messagerie.

Le champ \`confidence\` mesure à quel point les extraits couvrent réellement la
question, pas la qualité de ta rédaction. Sois sévère : 0,95 signifie qu'un
extrait répond mot pour mot ; 0,6 signifie que tu extrapoles depuis un extrait
voisin.`;
}

/**
 * Message utilisateur : la FAQ **avant** la question.
 *
 * Cet ordre n'est pas cosmétique. Les extraits FAQ d'un client sont stables d'un
 * message à l'autre, la question ne l'est jamais : placer la partie stable en
 * tête permet de poser un point de cache derrière elle et de ne payer le préfixe
 * qu'une fois par client.
 */
export function buildUserPrompt(options: {
  matches: readonly FaqMatch[];
  locale: SupportedLocale;
  conversationExcerpt: string;
  question: string;
  channelLabel: string;
}): { faqBlock: string; questionBlock: string } {
  const { matches, locale, conversationExcerpt, question, channelLabel } = options;

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

  const faqBlock = `<faq_extraits>
${extracts}
</faq_extraits>`;

  const questionBlock = `<contexte>
Canal : ${channelLabel}
Historique récent de la conversation :
${conversationExcerpt || "(aucun échange antérieur)"}
</contexte>

<message_a_traiter>
${question}
</message_a_traiter>

Rédige la réponse en t'appuyant uniquement sur les extraits ci-dessus, et
indique dans \`used_faq_entry_ids\` les identifiants des extraits que tu as
réellement utilisés — pas ceux que tu as lus sans t'en servir.`;

  return { faqBlock, questionBlock };
}

/**
 * Schéma de sortie. Contraindre le format évite de parser du texte libre, et
 * `used_faq_entry_ids` rend les sources vérifiables : un opérateur peut cliquer
 * sur l'entrée citée pour contrôler que la réponse en découle.
 */
export const DRAFT_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    can_answer: {
      type: "boolean",
      description:
        "Faux si les extraits FAQ ne permettent pas de répondre à la question.",
    },
    answer: {
      type: "string",
      description: "La réponse à envoyer au client final. Vide si can_answer est faux.",
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
      description: "Identifiants des extraits réellement utilisés.",
    },
    missing_information: {
      type: "string",
      description:
        "Quand can_answer est faux : ce qui manque dans la FAQ pour pouvoir répondre.",
    },
  },
  required: [
    "can_answer",
    "answer",
    "language",
    "confidence",
    "used_faq_entry_ids",
    "missing_information",
  ],
  additionalProperties: false,
} as const;

export type DraftGeneration = {
  can_answer: boolean;
  answer: string;
  language: SupportedLocale;
  confidence: number;
  used_faq_entry_ids: string[];
  missing_information: string;
};

/**
 * Valide la sortie du modèle contre ce que la recherche a réellement fourni.
 *
 * Un modèle contraint par schéma peut malgré tout citer un identifiant qui
 * n'était pas dans les extraits. On ne fait pas confiance : les identifiants
 * inconnus sont écartés, et un brouillon qui n'en garde aucun est rétrogradé —
 * sans source vérifiable, il n'a pas la garantie que le produit promet.
 */
export function validateGeneration(
  generation: DraftGeneration,
  matches: readonly FaqMatch[],
): {
  usable: boolean;
  sources: { faq_entry_id: string; question: string; similarity: number }[];
  confidence: number;
  droppedIds: string[];
} {
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
  const usable =
    generation.can_answer && generation.answer.trim().length > 0 && sources.length > 0;

  return { usable, sources, confidence, droppedIds };
}
