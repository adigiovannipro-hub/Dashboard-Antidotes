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
  "video/webm",
  "application/pdf",
];

/** Le même contrat, lu sur l'extension — un glisser-déposer arrive parfois
    sans type MIME, et le refuser pour ça perdait des fichiers valides. */
const ACCEPTED_VISUAL_EXTENSIONS = /\.(png|jpe?g|webp|gif|avif|mp4|mov|webm|pdf)$/i;

export function isAcceptedVisual(file: { name: string; type: string }): boolean {
  if (file.type) return ACCEPTED_VISUAL_TYPES.includes(file.type);
  return ACCEPTED_VISUAL_EXTENSIONS.test(file.name);
}

/**
 * Ce qui bloquerait cet envoi, en une phrase — ou rien si tout passe.
 *
 * Vérifié **avant** de partir. Pas de plafond de lot : chaque fichier part
 * seul, du navigateur vers le bucket.
 */
export function visualUploadError(files: File[]): string | null {
  for (const file of files) {
    if (file.size > MAX_VISUAL_BYTES) {
      return `${file.name} : trop lourd (50 Mo maximum par fichier).`;
    }
    if (!isAcceptedVisual(file)) {
      return `${file.name} : format non accepté (${file.type || "inconnu"}).`;
    }
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
