/**
 * Règles d'envoi d'une vidéo de leçon — partagées entre le serveur (l'action
 * qui signe l'URL) et le navigateur (le refus avant l'envoi). Module sans
 * directive : importable des deux côtés, comme `ui-preferences.ts`.
 */

/** Le plafond du projet Supabase Free : au-delà, YouTube ou Vimeo. */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

/** Aligné sur `allowed_mime_types` du bucket `academy-videos` (0057). */
export const VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

export function videoUploadError(file: {
  name: string;
  type: string;
  size: number;
}): string | null {
  if (!VIDEO_MIME_TYPES.includes(file.type)) {
    return `${file.name} : format non accepté (${file.type || "inconnu"}) — MP4, MOV ou WebM.`;
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return (
      `${file.name} : au-delà de 50 Mo, le plafond du projet Supabase. ` +
      "Héberge cette vidéo sur YouTube ou Vimeo en non répertorié, et colle son URL."
    );
  }
  return null;
}
