import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

/**
 * Le visuel d'un post, par un LoRA Flux hébergé sur Replicate — l'hypothèse
 * du cahier des charges : seul un modèle entraîné sur les photos de
 * l'auteur tient la cohérence d'un visage d'une image à l'autre.
 *
 * Deux réglages d'environnement : `REPLICATE_API_TOKEN`, et
 * `REPLICATE_LORA_VERSION`, l'identifiant de version du modèle entraîné
 * (`owner/model:version`, ou le seul hash). `REPLICATE_LORA_TRIGGER` est le
 * mot déclencheur appris à l'entraînement, préfixé au prompt.
 *
 * L'image rendue par Replicate est **rapatriée** dans le bucket privé
 * `antidotes-visuals` : les URL de sortie de Replicate expirent, et un post
 * approuvé doit garder son visuel. Écrit sur la documentation, jamais joué
 * contre le vrai service.
 */

export const VISUALS_BUCKET = "antidotes-visuals";
const REPLICATE = "https://api.replicate.com/v1";

export function visualAvailability(): string | null {
  if (!process.env.REPLICATE_API_TOKEN?.trim()) return "REPLICATE_API_TOKEN absent";
  if (!process.env.REPLICATE_LORA_VERSION?.trim()) return "REPLICATE_LORA_VERSION absente";
  return null;
}

type Prediction = { id: string; status: string; output?: string[] | string; error?: string | null };

async function createPrediction(token: string, version: string, prompt: string, fetcher: typeof fetch): Promise<Prediction> {
  const body: Record<string, unknown> = {
    input: { prompt, num_outputs: 1, aspect_ratio: "4:5", output_format: "jpg", output_quality: 90 },
  };
  // `owner/model:version` vise une version publiée ; un hash nu, la version directement.
  const [model, hash] = version.includes(":") ? version.split(":") : [null, version];
  if (model) body.version = hash;
  else body.version = hash;
  const response = await fetcher(`${REPLICATE}/predictions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "wait=60" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as Prediction & { detail?: string };
  if (!response.ok) throw new Error(`Replicate ${response.status} : ${payload.detail ?? "refus"}`);
  return payload;
}

async function waitForPrediction(token: string, prediction: Prediction, fetcher: typeof fetch): Promise<string> {
  let current = prediction;
  for (let attempt = 0; attempt < 30 && !["succeeded", "failed", "canceled"].includes(current.status); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const response = await fetcher(`${REPLICATE}/predictions/${current.id}`, { headers: { Authorization: `Bearer ${token}` } });
    current = (await response.json()) as Prediction;
  }
  if (current.status !== "succeeded") throw new Error(`Replicate : ${current.error ?? current.status}`);
  const output = Array.isArray(current.output) ? current.output[0] : current.output;
  if (!output) throw new Error("Replicate : aucune image rendue.");
  return output;
}

export async function generateVisual(options: {
  admin: SupabaseClient<Database>;
  orgId: string;
  postId: string;
  prompt: string;
  fetcher?: typeof fetch;
}): Promise<{ path: string }> {
  const unavailable = visualAvailability();
  if (unavailable) throw new Error(`${unavailable} : le visuel ne peut pas être généré.`);
  const fetcher = options.fetcher ?? fetch;
  const token = process.env.REPLICATE_API_TOKEN!.trim();
  const version = process.env.REPLICATE_LORA_VERSION!.trim();
  const trigger = process.env.REPLICATE_LORA_TRIGGER?.trim();
  const prompt = trigger ? `${trigger}, ${options.prompt}` : options.prompt;

  const prediction = await createPrediction(token, version, prompt, fetcher);
  const outputUrl = await waitForPrediction(token, prediction, fetcher);

  const image = await fetcher(outputUrl);
  if (!image.ok) throw new Error(`Replicate : image introuvable (${image.status}).`);
  const bytes = Buffer.from(await image.arrayBuffer());
  const path = `${options.orgId}/${options.postId}-${Date.now()}.jpg`;
  const { error } = await options.admin.storage
    .from(VISUALS_BUCKET)
    .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`Bucket des visuels : ${error.message}`);
  return { path };
}

/** L'URL signée d'un visuel, une heure — l'image d'un post approuvé se relit souvent. */
export async function signVisual(admin: SupabaseClient<Database>, path: string): Promise<string | null> {
  const { data } = await admin.storage.from(VISUALS_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/** Les octets d'un visuel, pour l'envoyer à LinkedIn. */
export async function readVisual(admin: SupabaseClient<Database>, path: string): Promise<Buffer> {
  const { data, error } = await admin.storage.from(VISUALS_BUCKET).download(path);
  if (error || !data) throw new Error(`Visuel introuvable : ${error?.message ?? path}`);
  return Buffer.from(await data.arrayBuffer());
}
