/**
 * Stockage des visuels.
 *
 * Les créas sont des documents clients : le bucket est privé, et l'affichage
 * passe par des URL signées générées à chaque rendu. Le chemin porte l'espace
 * en premier segment, ce qui rend la politique de stockage lisible — le
 * premier dossier dit à qui appartient le fichier.
 */

export const VISUALS_BUCKET = "planning-visuals";

/** 50 Mo : une vidéo de reel passe, un rush brut non. */
export const MAX_VISUAL_BYTES = 50 * 1024 * 1024;

export const ACCEPTED_VISUAL_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "video/mp4",
  "video/quicktime",
  "application/pdf",
];

/**
 * Plafond du corps d'un envoi, sous la limite déclarée à Next
 * (`bodySizeLimit`). Vérifié **avant** de partir : un corps refusé par le
 * serveur ne rend pas d'erreur lisible, il jette — et jetait l'écran entier.
 */
export const MAX_UPLOAD_BODY_BYTES = 95 * 1024 * 1024;

/** Ce qui bloquerait cet envoi, en une phrase — ou rien si tout passe. */
export function visualUploadError(files: File[]): string | null {
  for (const file of files) {
    if (file.size > MAX_VISUAL_BYTES) {
      return `${file.name} : trop lourd (50 Mo maximum par fichier).`;
    }
  }
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_UPLOAD_BODY_BYTES) {
    return "Envoi trop volumineux — garde l'ensemble sous 95 Mo, ou envoie en plusieurs fois.";
  }
  return null;
}

/**
 * Chemin d'un visuel : `<espace>/<publication>/<horodatage>-<nom>`.
 *
 * L'horodatage évite qu'un second envoi du même fichier écrase le premier, ce
 * qui arriverait sans lui à chaque « Plan de travail 1.png ».
 */
export function visualPath(input: {
  workspaceId: string;
  subjectId: string;
  fileName: string;
}): string {
  const safe = input.fileName
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${input.workspaceId}/${input.subjectId}/${Date.now()}-${safe || "visuel"}`;
}

/** Un chemin appartient-il bien à cet espace et à cette publication ? */
export function isOwnedVisualPath(
  path: string,
  workspaceId: string,
  subjectId: string,
): boolean {
  return path.startsWith(`${workspaceId}/${subjectId}/`);
}

export function isImagePath(pathOrUrl: string): boolean {
  return /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(pathOrUrl);
}
