import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import {
  buildSystemPrompt,
  buildUserPrompt,
  DRAFT_OUTPUT_SCHEMA,
  PROMPT_VERSION,
  validateGeneration,
  type DraftGeneration,
} from "./draft-prompt";
import { searchFaq, type FaqSearchMethod, type SearchableEntry } from "./faq-search";
import type { EmbeddingProvider } from "./embeddings";
import { CHANNEL_LABELS } from "./types";
import type {
  ConversationKind,
  DraftSource,
  ModerationChannel,
  SupportedLocale,
  ToneSettings,
} from "./types";

/**
 * Génération d'un brouillon de réponse.
 *
 * La FAQ est cherchée d'abord, et **le modèle est appelé ensuite, toujours**.
 * L'ancien court-circuit — pas d'entrée au-dessus du seuil, donc pas d'appel —
 * économisait quelques centimes et laissait l'opérateur devant une page
 * blanche pour 100 % des conversations réelles, faute d'une FAQ qui couvre tout.
 *
 * Ce qui reste de la garde vit ailleurs, et c'est le bon endroit : le prompt
 * interdit d'affirmer un fait non documenté, et le brouillon porte son
 * discriminant — appuyé sur des sources citées, ou proposition sans source.
 */

export const DRAFT_MODEL = "claude-opus-5";

export type DraftOutcome =
  | {
      kind: "draft";
      body: string;
      locale: SupportedLocale;
      confidence: number;
      sources: DraftSource[];
      /** Sources FAQ réellement citées et vérifiées : c'est le discriminant. */
      grounded: boolean;
      /** Comment la FAQ a été approchée — l'écran doit pouvoir le dire. */
      faqMethod: FaqSearchMethod;
      /** Ce qui manque à la FAQ pour répondre sans extrapoler, s'il y a lieu. */
      missingInformation: string | null;
      translatedFromFr: boolean;
      model: string;
      promptVersion: string;
    }
  | {
      /** Le modèle n'a rien rendu d'exploitable — la cause, en français. */
      kind: "refused";
      reason: string;
    };

export type GenerateDraftOptions = {
  question: string;
  conversationExcerpt: string;
  channel: ModerationChannel;
  kind: ConversationKind;
  locale: SupportedLocale;
  clientName: string;
  tone: ToneSettings;
  entries: readonly SearchableEntry[];
  provider: EmbeddingProvider;
  client?: Anthropic;
};

export async function generateDraft(
  options: GenerateDraftOptions,
): Promise<DraftOutcome> {
  const search = await searchFaq({
    question: options.question,
    entries: options.entries,
    channel: options.channel,
    provider: options.provider,
  });

  const anthropic = options.client ?? new Anthropic();

  const system = buildSystemPrompt({
    clientName: options.clientName,
    tone: options.tone,
    locale: options.locale,
    kind: options.kind,
  });

  const { faqBlock, questionBlock } = buildUserPrompt({
    matches: search.matches,
    method: search.method,
    answerable: search.answerable,
    locale: options.locale,
    conversationExcerpt: options.conversationExcerpt,
    question: options.question,
    channelLabel: CHANNEL_LABELS[options.channel],
    kind: options.kind,
  });

  const response = await anthropic.messages.create({
    model: DRAFT_MODEL,
    max_tokens: 2000,
    // Pensée adaptative : le modèle décide seul de la profondeur. Une réponse
    // client courte n'en demande pas, une question limite si.
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: DRAFT_OUTPUT_SCHEMA },
    },
    system,
    messages: [
      {
        role: "user",
        content: faqBlock
          ? [
              // Les extraits FAQ sont stables d'un message à l'autre pour un
              // même client : le point de cache est posé derrière eux, la
              // question variable reste après.
              {
                type: "text",
                text: faqBlock,
                cache_control: { type: "ephemeral" },
              },
              { type: "text", text: questionBlock },
            ]
          : // Sans extrait, rien de stable à mettre en cache.
            [{ type: "text", text: questionBlock }],
      },
    ],
  });

  // Un refus des classificateurs de sûreté arrive en HTTP 200 : lire
  // `content[0]` sans vérifier `stop_reason` planterait.
  if (response.stop_reason === "refusal") {
    return {
      kind: "refused",
      reason:
        "Les garde-fous du modèle ont refusé de rédiger cette réponse. À écrire à la main.",
    };
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return {
      kind: "refused",
      reason: "Le modèle n'a rien renvoyé d'exploitable. Relancer la génération.",
    };
  }

  let generation: DraftGeneration;
  try {
    generation = JSON.parse(textBlock.text) as DraftGeneration;
  } catch {
    return {
      kind: "refused",
      reason: "La réponse du modèle est illisible. Relancer la génération.",
    };
  }

  const validated = validateGeneration(generation, search.matches);
  if (!validated.usable) {
    return {
      kind: "refused",
      reason: "Le modèle a rendu une réponse vide. Relancer la génération.",
    };
  }

  const translatedFromFr = search.matches.some(
    (match) =>
      validated.sources.some((source) => source.faq_entry_id === match.entry.id) &&
      options.locale === "en" &&
      !match.entry.answer_en &&
      Boolean(match.entry.answer_fr),
  );

  return {
    kind: "draft",
    body: generation.answer.trim(),
    locale: generation.language,
    confidence: validated.confidence,
    sources: validated.sources,
    grounded: validated.grounded,
    faqMethod: search.method,
    missingInformation: generation.missing_information.trim() || null,
    translatedFromFr,
    model: DRAFT_MODEL,
    promptVersion: PROMPT_VERSION,
  };
}
