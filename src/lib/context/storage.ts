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

const ACCEPTED_EXTENSIONS = /\.(pdf|docx|txt|md|csv|png|jpe?g|webp)$/i;

/**
 * Un fichier sans type MIME est jugé sur son extension au lieu d'être refusé :
 * certains navigateurs et exports n'en posent pas.
 */
export function isAcceptedAsset(file: { name: string; type: string }): boolean {
  if (file.type) return ACCEPTED_ASSET_TYPES.includes(file.type);
  return ACCEPTED_EXTENSIONS.test(file.name);
}

/**
 * Ce qui bloquerait cet envoi, en une phrase — ou rien si tout passe.
 *
 * Pas de plafond de lot : les octets partent du navigateur droit au bucket,
 * fichier par fichier — le proxy de Next et Vercel ne voient jamais rien
 * passer. Seule compte la limite par fichier.
 */
export function assetUploadError(files: File[]): string | null {
  for (const file of files) {
    if (file.size > MAX_ASSET_BYTES) {
      return `${file.name} : trop lourd (50 Mo maximum par fichier).`;
    }
    if (!isAcceptedAsset(file)) {
      return `${file.name} : format non accepté (${file.type || "inconnu"}). PDF, DOCX, texte, CSV ou image.`;
    }
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
