import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import {
  buildExtractionPrompt,
  EXTRACTION_OUTPUT_SCHEMA,
  EXTRACTION_SYSTEM_PROMPT,
  toResult,
  validateExtraction,
  type ExtractionResult,
} from "./extraction-prompt";
import { extractAmounts, likelyTotal, triageEmail } from "./heuristics";
import { parseKnownReceipt } from "./known-receipts";

export type { ExtractionResult };

/**
 * Lecture d'un mail : est-ce une pièce comptable, et que dit-elle ?
 *
 * Le tri heuristique passe **avant** tout appel au modèle. Sur une boîte
 * ordinaire il écarte l'écrasante majorité des messages pour le prix d'une
 * expression régulière, et le modèle ne lit que ce qui a des chances d'être une
 * facture. Sans cela, le coût du module serait proportionnel au volume de la
 * boîte plutôt qu'au nombre de factures.
 *
 * Sans clé d'API, on ne s'arrête pas : les heuristiques rendent une
 * classification dégradée, à confiance volontairement plafonnée. Le module
 * reste utilisable — simplement, rien ne partira automatiquement.
 */

export const EXTRACTION_MODEL = "claude-opus-5";

export type ExtractableEmail = {
  subject: string | null;
  from_email: string;
  from_name: string | null;
  received_at: Date;
  snippet: string | null;
  text: string;
  attachmentNames: string[];
};

/**
 * Plafond de confiance d'une classification sans modèle.
 *
 * Réglé sous le seuil d'auto-transfert par défaut (0,9) : une pièce jugée par
 * les seules heuristiques ne peut jamais partir toute seule, quelle que soit la
 * configuration. C'est une garantie structurelle, pas un réglage.
 */
const HEURISTIC_CONFIDENCE_CAP = 0.6;

function fromHeuristics(email: ExtractableEmail): ExtractionResult {
  const haystack = [email.subject ?? "", email.snippet ?? "", email.text]
    .join("\n")
    .toLowerCase();
  const total = likelyTotal(extractAmounts(haystack));

  return {
    kind: "invoice",
    confidence: HEURISTIC_CONFIDENCE_CAP,
    reason:
      "Classée par règles simples, sans lecture par le modèle. À vérifier avant transfert.",
    merchant: email.from_name ?? null,
    amount_cents: total?.cents ?? null,
    currency: total?.currency ?? null,
    tax_cents: null,
    document_date: null,
    invoice_number: null,
    source: "heuristics",
    prompt_version: null,
  };
}

export async function extractReceipt(
  email: ExtractableEmail,
  options: { client?: Anthropic } = {},
): Promise<ExtractionResult | null> {
  const triage = triageEmail({
    subject: email.subject,
    from_email: email.from_email,
    snippet: email.snippet,
    body: email.text,
    attachmentNames: email.attachmentNames,
  });

  // Écarté sans appel : ni coût, ni latence, ni risque d'invention.
  if (triage.verdict === "skip") return null;

  // Gabarit connu : lu sans appel, donc sans coût et sans dépendre du crédit.
  const known = parseKnownReceipt(email);
  if (known) return known;

  if (!process.env.ANTHROPIC_API_KEY && !options.client) {
    return fromHeuristics(email);
  }

  const anthropic = options.client ?? new Anthropic();

  const response = await anthropic.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 2000,
    /* Effort bas : lire une facture n'est pas un problème de raisonnement, et
       ce module tourne sur chaque mail retenu d'une boîte entière. La dépense
       se justifierait mal. */
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: EXTRACTION_OUTPUT_SCHEMA },
    },
    system: [
      {
        type: "text",
        text: EXTRACTION_SYSTEM_PROMPT,
        // Le système est identique d'un mail à l'autre : le point de cache
        // posé ici est lu à chaque message suivant.
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: buildExtractionPrompt(email) }],
  });

  /* Un refus des classificateurs arrive en HTTP 200 : lire `content[0]` sans
     vérifier `stop_reason` planterait. Un mail refusé n'est pas perdu — il part
     en relecture humaine avec la raison affichée. */
  if (response.stop_reason === "refusal") {
    return {
      ...fromHeuristics(email),
      reason: "Lecture refusée par les garde-fous du modèle. Relecture humaine nécessaire.",
    };
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") return fromHeuristics(email);

  let parsed: unknown;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    return fromHeuristics(email);
  }

  const output = validateExtraction(parsed);
  if (!output) return fromHeuristics(email);

  return toResult(output);
}
