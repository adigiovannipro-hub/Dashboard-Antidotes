/**
 * Stockage des documents de contexte.
 *
 * Bucket privé `client-assets`, réservé à l'owner par les politiques de la
 * migration 0033. Le chemin porte l'espace en premier segment — c'est lui que
 * lisent les politiques de stockage. Les fichiers sont servis par URL signée
 * de courte durée, jamais en public, et ne sont jamais supprimés
 * automatiquement après extraction.
 */

export const ASSETS_BUCKET = "client-assets";

/** 50 Mo, la limite du bucket : un lookbook PDF passe, un rush vidéo non. */
export const MAX_ASSET_BYTES = 50 * 1024 * 1024;

/**
 * Plafond du corps d'un envoi, sous la limite déclarée à Next
 * (`bodySizeLimit`). Vérifié **avant** de partir : un corps refusé par le
 * serveur ne rend pas d'erreur lisible, il jette — et jetterait l'écran.
 */
export const MAX_UPLOAD_BODY_BYTES = 95 * 1024 * 1024;

export const ACCEPTED_ASSET_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/webp",
];

/** Ce qui bloquerait cet envoi, en une phrase — ou rien si tout passe. */
export function assetUploadError(files: File[]): string | null {
  for (const file of files) {
    if (file.size > MAX_ASSET_BYTES) {
      return `${file.name} : trop lourd (50 Mo maximum par fichier).`;
    }
    if (file.type && !ACCEPTED_ASSET_TYPES.includes(file.type)) {
      return `${file.name} : format non accepté (${file.type}). PDF, DOCX, texte, CSV ou image.`;
    }
  }
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_UPLOAD_BODY_BYTES) {
    return "Envoi trop volumineux — garde l'ensemble sous 95 Mo, ou envoie en plusieurs fois.";
  }
  return null;
}

/**
 * Chemin d'un document : `<espace>/contexte/<horodatage>-<nom>`.
 *
 * L'horodatage évite qu'un second envoi du même fichier écrase le premier.
 */
export function assetPath(input: { workspaceId: string; fileName: string }): string {
  const safe = input.fileName
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${input.workspaceId}/contexte/${Date.now()}-${safe || "document"}`;
}

/** Un chemin appartient-il bien à cet espace ? */
export function isOwnedAssetPath(path: string, workspaceId: string): boolean {
  return path.startsWith(`${workspaceId}/`);
}
