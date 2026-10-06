/**
 * Recompression d'une vidéo trop lourde pour le bucket, décidée avant d'encoder.
 *
 * Le plan gratuit de Supabase plafonne chaque fichier à 50 Mo, et ce plafond
 * ne se lève pas : un master de reel en pèse souvent le double. Plutôt que de
 * refuser, le navigateur qui envoie réencode la vidéo en H.264 sous la barre.
 * Ce module ne fait que décider — débit, définition, ou refus — à partir de la
 * durée et des dimensions ; l'encodage lui-même vit dans
 * `video-compression-client.ts`, seul à toucher WebCodecs.
 */

import { MAX_SOURCE_VIDEO_BYTES, MAX_VISUAL_BYTES, isVideoFile } from "./storage";

/** Ce qu'on vise : 45 Mo, pour qu'un encodeur qui déborde un peu tienne
    encore sous les 50 du bucket sans second passage. */
export const COMPRESSION_TARGET_BYTES = 45 * 1024 * 1024;

/** Inutile de dépasser : Instagram réencode tout reel bien en dessous. */
export const MAX_VIDEO_BITRATE = 12_000_000;

/** En dessous, l'image se dégrade à vue : on refuse plutôt que de publier ça. */
export const MIN_VIDEO_BITRATE = 800_000;

/** Sous ce débit, du 1080p bave ; du 720p reste net. */
const HD_BITRATE_FLOOR = 2_500_000;

/** Le conteneur MP4 et ses index mangent quelques pourcents du budget. */
const CONTAINER_OVERHEAD = 0.97;

/** Une vidéo au-dessus du plafond du bucket, mais qu'on sait ramener dessous. */
export function needsCompression(file: { name: string; type: string; size: number }): boolean {
  return (
    isVideoFile(file) &&
    file.size > MAX_VISUAL_BYTES &&
    file.size <= MAX_SOURCE_VIDEO_BYTES
  );
}

export type CompressionPlan =
  | { ok: true; videoBitrate: number; width: number; height: number }
  | { ok: false; reason: "too_long" | "unreadable" };

/**
 * Débit et définition de sortie.
 *
 * Le budget est la cible moins le son, réparti sur la durée. Le plus petit
 * côté descend à 1080 px — la définition d'un reel — et à 720 px quand le
 * débit disponible est trop maigre pour du 1080 propre. Les dimensions sont
 * paires : H.264 en 4:2:0 n'en accepte pas d'autres.
 */
export function planCompression(input: {
  durationSeconds: number;
  displayWidth: number;
  displayHeight: number;
  audioBitrate: number;
  targetBytes?: number;
}): CompressionPlan {
  const { durationSeconds, displayWidth, displayHeight } = input;
  if (!(durationSeconds > 0) || !(displayWidth > 0) || !(displayHeight > 0)) {
    return { ok: false, reason: "unreadable" };
  }

  const budget = (input.targetBytes ?? COMPRESSION_TARGET_BYTES) * 8 * CONTAINER_OVERHEAD;
  const videoBitrate = Math.min(
    Math.floor(budget / durationSeconds - Math.max(0, input.audioBitrate)),
    MAX_VIDEO_BITRATE,
  );
  if (videoBitrate < MIN_VIDEO_BITRATE) return { ok: false, reason: "too_long" };

  const shortEdgeCap = videoBitrate < HD_BITRATE_FLOOR ? 720 : 1080;
  const scale = Math.min(1, shortEdgeCap / Math.min(displayWidth, displayHeight));

  return {
    ok: true,
    videoBitrate,
    width: even(displayWidth * scale),
    height: even(displayHeight * scale),
  };
}

/**
 * Le passage suivant, quand le précédent a débordé du bucket.
 *
 * Le débit baisse dans la proportion du débordement, plus une marge — un
 * encodeur à débit variable vise une moyenne, pas un plafond. Et la
 * définition descend d'un cran (720 puis 540 px de petit côté) : un encodeur
 * logiciel peut ignorer un débit trop bas pour sa définition — mesuré sur
 * Chrome, 3 Mb/s demandés en 1080 ressortaient à 16, et à 3 en 720.
 */
export function planRetry(
  previous: { videoBitrate: number; width: number; height: number },
  actualBytes: number,
): { videoBitrate: number; width: number; height: number } {
  const shortEdge = Math.min(previous.width, previous.height);
  const nextShortEdge = shortEdge > 720 ? 720 : shortEdge > 540 ? 540 : shortEdge;
  const scale = nextShortEdge / shortEdge;
  return {
    videoBitrate: Math.floor(
      previous.videoBitrate * (COMPRESSION_TARGET_BYTES / actualBytes) * 0.85,
    ),
    width: even(previous.width * scale),
    height: even(previous.height * scale),
  };
}

/** « 4 min 12 s » — ce qu'on dit quand une vidéo est trop longue. */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes === 0) return `${rest} s`;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
}

/** `master.mov` → `master.mp4` : la sortie est toujours un MP4. */
export function compressedName(fileName: string): string {
  const base = fileName.replace(/\.[^./]+$/, "");
  return `${base || "video"}.mp4`;
}

function even(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}
