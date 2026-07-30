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
import { searchFaq, type SearchableEntry } from "./faq-search";
import type { EmbeddingProvider } from "./embeddings";
import { CHANNEL_LABELS } from "./types";
import type {
  DraftSource,
  ModerationChannel,
  SupportedLocale,
  ToneSettings,
} from "./types";

/**
 * Génération d'un brouillon de réponse.
 *
 * La FAQ est cherchée **avant** tout appel au modèle. Si aucune entrée ne
 * franchit le seuil, on n'appelle pas Claude du tout : ni coût, ni latence, ni
 * risque d'invention. La conversation part en traitement manuel.
 */

export const DRAFT_MODEL = "claude-opus-5";

export type DraftOutcome =
  | {
      kind: "draft";
      body: string;
      locale: SupportedLocale;
      confidence: number;
      sources: DraftSource[];
      translatedFromFr: boolean;
      model: string;
      promptVersion: string;
    }
  | {
      kind: "no_answer_available";
      /** Ce qui manque dans la FAQ — alimente la box de correction. */
      missingInformation: string;
      /** Meilleures approches trouvées, même sous le seuil : aide l'opérateur. */
      nearMisses: DraftSource[];
    };

export type GenerateDraftOptions = {
  question: string;
  conversationExcerpt: string;
  channel: ModerationChannel;
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

  if (!search.answerable) {
    return {
      kind: "no_answer_available",
      missingInformation:
        search.reason === "no_match"
          ? "Aucune entrée FAQ ne se rapproche de cette demande."
          : "Les entrées FAQ les plus proches ne couvrent pas la demande avec assez de certitude.",
      nearMisses: search.matches.map((match) => ({
        faq_entry_id: match.entry.id,
        question: match.entry.question_canonical,
        similarity: match.similarity,
      })),
    };
  }

  const anthropic = options.client ?? new Anthropic();

  const system = buildSystemPrompt({
    clientName: options.clientName,
    tone: options.tone,
    locale: options.locale,
  });

  const { faqBlock, questionBlock } = buildUserPrompt({
    matches: search.matches,
    locale: options.locale,
    conversationExcerpt: options.conversationExcerpt,
    question: options.question,
    channelLabel: CHANNEL_LABELS[options.channel],
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
        content: [
          // Les extraits FAQ sont stables d'un message à l'autre pour un même
          // client : le point de cache est posé derrière eux, la question
          // variable reste après.
          {
            type: "text",
            text: faqBlock,
            cache_control: { type: "ephemeral" },
          },
          { type: "text", text: questionBlock },
        ],
      },
    ],
  });

  // Un refus des classificateurs de sûreté arrive en HTTP 200 : lire
  // `content[0]` sans vérifier `stop_reason` planterait.
  if (response.stop_reason === "refusal") {
    return {
      kind: "no_answer_available",
      missingInformation:
        "La génération a été refusée par les garde-fous du modèle. Ce message demande une réponse humaine.",
      nearMisses: search.matches.map((match) => ({
        faq_entry_id: match.entry.id,
        question: match.entry.question_canonical,
        similarity: match.similarity,
      })),
    };
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Réponse du modèle sans bloc de texte exploitable.");
  }

  const generation = JSON.parse(textBlock.text) as DraftGeneration;
  const validated = validateGeneration(generation, search.matches);

  if (!validated.usable) {
    return {
      kind: "no_answer_available",
      missingInformation:
        generation.missing_information ||
        "Le modèle n'a cité aucune source FAQ vérifiable.",
      nearMisses: search.matches.map((match) => ({
        faq_entry_id: match.entry.id,
        question: match.entry.question_canonical,
        similarity: match.similarity,
      })),
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
    translatedFromFr,
    model: DRAFT_MODEL,
    promptVersion: PROMPT_VERSION,
  };
}
