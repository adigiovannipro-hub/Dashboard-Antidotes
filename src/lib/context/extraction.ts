import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { splitIntoChunks } from "./chunking";
import { EXTRACTION_PROMPTS } from "./prompts";
import type { ClientAssetType } from "./types";

/**
 * Extraction du résumé éditorial d'un document de référence.
 *
 * Le texte est extrait localement quand c'est possible (PDF, DOCX, texte) —
 * seul le texte part à l'API, jamais le fichier brut. Deux exceptions, prévues
 * par le produit : les images et les lookbooks partent en base64 (vision), et
 * un PDF dont l'extraction ne rend presque rien (scan) bascule lui aussi en
 * vision plutôt que de produire un résumé vide.
 *
 * Sans `ANTHROPIC_API_KEY`, pas de dégradé silencieux : la ligne passe en
 * `error` avec la cause affichée — un résumé inventé par des règles simples
 * polluerait tous les prompts de génération en aval.
 */

export const CONTEXT_MODEL = "claude-sonnet-4-6";

/** Au-delà, on refuse l'analyse visuelle : la requête API plafonne à 32 Mo. */
const MAX_VISION_BYTES = 20 * 1024 * 1024;

/** Un PDF « textuel » qui rend moins que ça est un scan : bascule en vision. */
const MIN_EXTRACTED_CHARS = 200;

const VISION_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
type VisionImageType = (typeof VISION_IMAGE_TYPES)[number];

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type ExtractionInput = {
  name: string;
  type: ClientAssetType;
  mimeType: string;
  content: Buffer;
};

export type ExtractionOutcome =
  | { ok: true; summary: string }
  | { ok: false; error: string };

export async function extractAssetSummary(
  input: ExtractionInput,
  options: { client?: Anthropic } = {},
): Promise<ExtractionOutcome> {
  if (!process.env.ANTHROPIC_API_KEY && !options.client) {
    return {
      ok: false,
      error:
        "ANTHROPIC_API_KEY absente : l'analyse ne peut pas tourner. Renseigner la clé puis relancer.",
    };
  }

  const anthropic = options.client ?? new Anthropic();
  const prompt = EXTRACTION_PROMPTS[input.type];

  try {
    // Images, et lookbooks quel que soit leur format : lecture visuelle.
    if (isVisionImage(input.mimeType)) {
      return await summarizeVision(anthropic, prompt, {
        kind: "image",
        mediaType: input.mimeType as VisionImageType,
        content: input.content,
      });
    }
    if (input.type === "lookbook" && input.mimeType === "application/pdf") {
      return await summarizeVision(anthropic, prompt, {
        kind: "pdf",
        content: input.content,
      });
    }

    const text = await extractText(input);
    if (text === null) {
      return {
        ok: false,
        error: `Format non pris en charge (${input.mimeType || "inconnu"}). PDF, DOCX, texte, CSV ou image.`,
      };
    }

    // Un PDF qui ne rend presque rien est un scan : le texte n'y est pas, il
    // faut le regarder.
    if (text.trim().length < MIN_EXTRACTED_CHARS && input.mimeType === "application/pdf") {
      return await summarizeVision(anthropic, prompt, {
        kind: "pdf",
        content: input.content,
      });
    }

    if (text.trim().length === 0) {
      return { ok: false, error: "Document vide : aucun texte à analyser." };
    }

    return await summarizeText(anthropic, prompt, text);
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

function isVisionImage(mimeType: string): mimeType is VisionImageType {
  return (VISION_IMAGE_TYPES as readonly string[]).includes(mimeType);
}

/** Le texte brut du document, ou `null` si le format n'est pas lisible. */
async function extractText(input: ExtractionInput): Promise<string | null> {
  if (input.mimeType === "application/pdf") {
    const { extractText: extractPdfText } = await import("unpdf");
    const { text } = await extractPdfText(new Uint8Array(input.content), {
      mergePages: true,
    });
    return text;
  }

  if (input.mimeType === DOCX_MIME) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: input.content });
    return value;
  }

  if (
    input.mimeType.startsWith("text/") ||
    input.mimeType === "application/json" ||
    input.mimeType === ""
  ) {
    return input.content.toString("utf8");
  }

  return null;
}

/** Un appel de résumé, texte seul. */
async function summarizeText(
  anthropic: Anthropic,
  prompt: string,
  text: string,
): Promise<ExtractionOutcome> {
  const chunks = splitIntoChunks(text);

  if (chunks.length <= 1) {
    return callModel(anthropic, prompt, [
      { type: "text", text: `DOCUMENT :\n\n${chunks[0] ?? ""}` },
    ]);
  }

  // Document plus long que la fenêtre visée : résumé par sections, puis
  // consolidation des sections avec les mêmes règles éditoriales.
  const partials: string[] = [];
  for (const [index, chunk] of chunks.entries()) {
    const partial = await callModel(anthropic, prompt, [
      {
        type: "text",
        text: `PARTIE ${index + 1} SUR ${chunks.length} DU DOCUMENT :\n\n${chunk}`,
      },
    ]);
    if (!partial.ok) return partial;
    partials.push(partial.summary);
  }

  return callModel(anthropic, prompt, [
    {
      type: "text",
      text:
        `Voici les résumés des ${partials.length} parties d'un même document. ` +
        `Consolide-les en un seul résumé conforme aux règles ci-dessus, sans dépasser la longueur demandée.\n\n` +
        partials.map((partial, index) => `Partie ${index + 1} :\n${partial}`).join("\n\n"),
    },
  ]);
}

/** Un appel de résumé, pièce visuelle en base64. */
async function summarizeVision(
  anthropic: Anthropic,
  prompt: string,
  piece:
    | { kind: "image"; mediaType: VisionImageType; content: Buffer }
    | { kind: "pdf"; content: Buffer },
): Promise<ExtractionOutcome> {
  if (piece.content.length > MAX_VISION_BYTES) {
    return {
      ok: false,
      error: "Document trop lourd pour une analyse visuelle (20 Mo maximum).",
    };
  }

  const data = piece.content.toString("base64");
  const block: Anthropic.ContentBlockParam =
    piece.kind === "image"
      ? { type: "image", source: { type: "base64", media_type: piece.mediaType, data } }
      : {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data },
        };

  return callModel(anthropic, prompt, [block]);
}

async function callModel(
  anthropic: Anthropic,
  prompt: string,
  content: Anthropic.ContentBlockParam[],
): Promise<ExtractionOutcome> {
  const response = await anthropic.messages.create({
    model: CONTEXT_MODEL,
    max_tokens: 1000,
    /* Effort bas : restituer un document n'est pas un problème de
       raisonnement, et le pipeline tourne à chaque dépôt de fichier. */
    output_config: { effort: "low" },
    system: prompt,
    messages: [{ role: "user", content }],
  });

  /* Un refus des classificateurs arrive en HTTP 200 : lire `content[0]` sans
     vérifier `stop_reason` planterait. */
  if (response.stop_reason === "refusal") {
    return {
      ok: false,
      error: "Lecture refusée par les garde-fous du modèle. Résumé à écrire à la main.",
    };
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text" || textBlock.text.trim().length === 0) {
    return { ok: false, error: "Le modèle n'a rendu aucun résumé exploitable." };
  }

  return { ok: true, summary: textBlock.text.trim() };
}
