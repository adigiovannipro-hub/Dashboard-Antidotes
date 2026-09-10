import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

/**
 * Le script d'une vidéo relevée.
 *
 * Un reel ne se juge pas à sa légende — trois mots et un emoji — mais à ce
 * qui s'y dit. Le relevé garde l'URL du média (`media_url`, périssable
 * quelques heures chez Instagram) ; ce passage la télécharge et la fait
 * transcrire, puis range le texte dans `transcript`. C'est lui que le
 * tableau affiche et que le studio reçoit comme matière.
 *
 * Modèle : `gpt-4o-mini-transcribe` d'OpenAI, la transcription la moins
 * chère qui tienne le français — environ 0,3 centime la minute, soit
 * quelques centimes par jour pour une veille de trente comptes. La langue
 * n'est pas forcée : un concurrent anglophone se transcrit tel quel.
 *
 * Les parties qui décident — qui transcrire, comment lire la réponse — sont
 * pures et testées ; le réseau passe par un `fetcher` injecté, et le client
 * Supabase aussi. Pas de `server-only` pour cette raison : comme
 * `collect.ts`, ce module ne lit rien de secret par lui-même, il reçoit ce
 * dont il a besoin — c'est ce qui le rend testable.
 */

export const TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe";
export const TRANSCRIBE_ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";

/** Au-delà, on ne télécharge pas : un reel de plus de 25 Mo est une exception. */
export const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

export type TranscribableRow = {
  id: string;
  media_url: string | null;
  media_kind: string | null;
  transcript: string | null;
};

/**
 * Ce qui mérite une transcription : une vidéo, dont on a le média, et dont
 * on n'a pas encore le texte. Le plafond borne la facture d'un passage.
 */
export function pickTranscribable<T extends TranscribableRow>(rows: readonly T[], limit: number): T[] {
  return rows
    .filter((row) => row.media_kind === "video" && Boolean(row.media_url?.trim()) && !row.transcript?.trim())
    .slice(0, Math.max(0, limit));
}

/** Le texte d'une réponse de l'API, ou la raison pour laquelle il n'y en a pas. */
export function readTranscription(payload: unknown): { text: string } | { error: string } {
  if (!payload || typeof payload !== "object") return { error: "Réponse illisible." };
  const body = payload as { text?: unknown; error?: { message?: unknown } };
  if (typeof body.error?.message === "string") return { error: body.error.message };
  if (typeof body.text === "string" && body.text.trim()) return { text: body.text.trim() };
  return { error: "Transcription vide." };
}

export type TranscribeReport = {
  transcribed: number;
  skipped: number;
  errors: string[];
};

export async function transcribeMissing(options: {
  admin: SupabaseClient<Database>;
  orgId?: string;
  limit?: number;
  fetcher?: typeof fetch;
}): Promise<TranscribeReport> {
  const report: TranscribeReport = { transcribed: 0, skipped: 0, errors: [] };
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    report.errors.push("OPENAI_API_KEY absente : pas de transcription.");
    return report;
  }
  const fetcher = options.fetcher ?? fetch;
  const limit = options.limit ?? 20;

  let query = options.admin
    .from("antidotes_reference_posts")
    .select("id, media_url, media_kind, transcript")
    .eq("media_kind", "video")
    .is("transcript", null)
    .not("media_url", "is", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit * 2);
  if (options.orgId) query = query.eq("org_id", options.orgId);

  const { data, error } = await query;
  if (error) {
    report.errors.push(error.message);
    return report;
  }

  for (const row of pickTranscribable((data ?? []) as unknown as TranscribableRow[], limit)) {
    try {
      const media = await fetcher(row.media_url!);
      if (!media.ok) throw new Error(`média ${media.status}`);
      const length = Number(media.headers.get("content-length") ?? 0);
      if (length > MAX_MEDIA_BYTES) {
        report.skipped += 1;
        continue;
      }
      const buffer = await media.arrayBuffer();
      if (buffer.byteLength > MAX_MEDIA_BYTES) {
        report.skipped += 1;
        continue;
      }

      const form = new FormData();
      form.append("file", new Blob([buffer], { type: "video/mp4" }), `${row.id}.mp4`);
      form.append("model", TRANSCRIBE_MODEL);
      const response = await fetcher(TRANSCRIBE_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: form,
      });
      const read = readTranscription(await response.json().catch(() => null));
      if ("error" in read) throw new Error(read.error);

      const { error: writeError } = await options.admin
        .from("antidotes_reference_posts")
        .update({ transcript: read.text } as never)
        .eq("id", row.id);
      if (writeError) throw new Error(writeError.message);
      report.transcribed += 1;
    } catch (cause) {
      report.errors.push(`${row.id} : ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }
  return report;
}
