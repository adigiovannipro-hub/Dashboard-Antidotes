import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { renderBrief } from "./injected-context";
import { buildConsolidationPrompt } from "./prompts";
import { parseProposal } from "./proposal";
import type { ClientContext, ContextProposal } from "./types";
import { CONTEXT_MODEL } from "./extraction";

/**
 * Consolidation : construit une proposition de brief à partir des résumés des
 * documents cochés et du brief actuel. Elle ne s'applique jamais seule — la
 * proposition passe par le diff champ par champ, et c'est l'utilisateur qui
 * accepte ou refuse chaque champ.
 *
 * Ce que le schéma **ne porte pas** est aussi une décision : ni exemples
 * validés, ni retours du client, ni faits sourcés, ni livrables. Ce sont des
 * saisies humaines — un modèle qui proposerait de réécrire un verbatim client
 * ou de redater un fait vérifié fabriquerait une preuve. `ContextProposal` et
 * `FIELD_KEYS` encodent cette limite, la régénération ne peut donc pas les
 * écraser même par accident.
 */

/**
 * Le schéma imposé à la sortie du modèle — mêmes clés françaises que le
 * prompt. La sortie structurée garantit un JSON valide ; `parseProposal`
 * reste derrière, parce qu'un schéma garantit la forme, pas la prudence.
 */
const PROPOSAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "contexte_principal",
    "cibles",
    "tone_of_voice",
    "piliers",
    "interdits",
    "plateformes",
  ],
  properties: {
    contexte_principal: { type: "string" },
    cibles: { type: "string" },
    tone_of_voice: { type: "string" },
    piliers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "nom",
          "description",
          "formats",
          "angles",
          "frequence",
          "objectif_business",
          "cta_autorises",
        ],
        properties: {
          nom: { type: "string" },
          description: { type: "string" },
          formats: { type: "array", items: { type: "string" } },
          angles: { type: "array", items: { type: "string" } },
          frequence: { type: "string" },
          objectif_business: { type: "string" },
          cta_autorises: { type: "array", items: { type: "string" } },
        },
      },
    },
    interdits: { type: "string" },
    plateformes: {
      type: "object",
      additionalProperties: false,
      required: ["instagram", "linkedin", "tiktok", "facebook"],
      properties: {
        instagram: { type: "string" },
        linkedin: { type: "string" },
        tiktok: { type: "string" },
        facebook: { type: "string" },
      },
    },
  },
} as const;

export type ConsolidationOutcome =
  | { ok: true; proposal: ContextProposal }
  | { ok: false; error: string };

export async function proposeConsolidation(
  input: { resumes: string; currentBrief: ClientContext | null },
  options: { client?: Anthropic } = {},
): Promise<ConsolidationOutcome> {
  if (!process.env.ANTHROPIC_API_KEY && !options.client) {
    return {
      ok: false,
      error: "ANTHROPIC_API_KEY absente : la régénération ne peut pas tourner.",
    };
  }

  const anthropic = options.client ?? new Anthropic();
  const prompt = buildConsolidationPrompt({
    resumes: input.resumes,
    briefActuel: renderBrief(input.currentBrief),
  });

  try {
    const response = await anthropic.messages.create({
      model: CONTEXT_MODEL,
      max_tokens: 4000,
      output_config: {
        format: { type: "json_schema", schema: PROPOSAL_SCHEMA },
      },
      messages: [{ role: "user", content: prompt }],
    });

    if (response.stop_reason === "refusal") {
      return { ok: false, error: "Consolidation refusée par les garde-fous du modèle." };
    }
    if (response.stop_reason === "max_tokens") {
      return { ok: false, error: "Proposition tronquée : réessayer avec moins de documents cochés." };
    }

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, error: "Le modèle n'a rendu aucune proposition." };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      return { ok: false, error: "Proposition illisible (JSON invalide)." };
    }

    const proposal = parseProposal(parsed);
    if (!proposal) {
      return { ok: false, error: "Proposition illisible (structure inattendue)." };
    }

    return { ok: true, proposal };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
