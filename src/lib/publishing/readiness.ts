/**
 * Ce qui peut partir, où, et ce qui bloque.
 *
 * Fonctions pures, testées à part : c'est le contrat de la publication
 * automatique. La règle d'or est de **ne jamais publier un post douteux** —
 * un blocage se lit sur la ligne, une publication ratée chez le client ne se
 * rattrape pas.
 */

export type PublishTarget = "instagram" | "facebook";

export const PUBLISH_TARGET_LABELS: Record<PublishTarget, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
};

/**
 * Où publie un couloir. Le couloir META historique du board couvre les deux
 * réseaux — c'est sa définition côté Monday. Tout le reste (LinkedIn,
 * TikTok…) n'est pas publiable automatiquement aujourd'hui.
 */
export function publishTargets(platform: string): PublishTarget[] {
  if (platform === "meta") return ["instagram", "facebook"];
  if (platform === "instagram") return ["instagram"];
  if (platform === "facebook") return ["facebook"];
  return [];
}

export type PublishBlocker =
  | "sans-visuel"
  | "sans-wording"
  | "reel-sans-video"
  | "carrousel-trop-long";

export const PUBLISH_BLOCKER_LABELS: Record<PublishBlocker, string> = {
  "sans-visuel": "aucun visuel accroché",
  "sans-wording": "wording absent ou non rédigé",
  "reel-sans-video": "un reel demande un fichier vidéo",
  "carrousel-trop-long": "un carrousel Meta accepte 10 visuels au plus",
};

/** La forme sous laquelle le post part chez Meta. */
export type PublishShape = "image" | "video" | "carousel";

const VIDEO_EXTENSIONS = [".mp4", ".mov", ".m4v"];

export function isVideoPath(path: string): boolean {
  const clean = path.split("?")[0]?.toLowerCase() ?? "";
  return VIDEO_EXTENSIONS.some((extension) => clean.endsWith(extension));
}

/** Les libellés de wording qui veulent dire « pas encore écrit ». */
const WORDING_PLACEHOLDERS = new Set(["—", "-", "wording à faire"]);

export type PublishableSubject = {
  format: string;
  wording: string | null;
  visual_urls: string[];
};

export type PublishPlan =
  | { ready: true; shape: PublishShape }
  | { ready: false; blockers: PublishBlocker[] }
  | { ready: false; story: true };

/**
 * Le plan de publication d'un sujet, ou ce qui l'empêche.
 *
 * Une story n'est jamais publiée automatiquement : les widgets — sondage,
 * lien, musique — ne se posent pas par l'API, et une story nue serait une
 * story ratée. Ce n'est pas un blocage à corriger, c'est une exclusion : la
 * ligne reste à publier à la main.
 */
export function publishPlan(subject: PublishableSubject): PublishPlan {
  if (subject.format === "story") return { ready: false, story: true };

  const blockers: PublishBlocker[] = [];
  const visuals = subject.visual_urls;

  if (visuals.length === 0) blockers.push("sans-visuel");
  if (visuals.length > 10) blockers.push("carrousel-trop-long");

  const wording = subject.wording?.trim().toLowerCase() ?? "";
  if (!wording || WORDING_PLACEHOLDERS.has(wording)) {
    blockers.push("sans-wording");
  }

  if (subject.format === "reel" && visuals.length > 0 && !isVideoPath(visuals[0]!)) {
    blockers.push("reel-sans-video");
  }

  if (blockers.length > 0) return { ready: false, blockers };

  // La forme découle des fichiers plus que de l'étiquette : deux visuels sur
  // un « post » sont un carrousel, une vidéo seule part en reel — c'est le
  // seul format vidéo que le feed Instagram connaisse encore.
  const shape: PublishShape =
    visuals.length > 1 ? "carousel" : isVideoPath(visuals[0]!) ? "video" : "image";

  return { ready: true, shape };
}

/**
 * L'heure et la date **de Paris** pour un instant donné.
 *
 * C'est la seule horloge métier du module : « publier à 16h » veut dire 16h
 * heure française, été comme hiver. Le décalage UTC changeant deux fois par
 * an, on demande au fuseau plutôt que de coder un offset.
 */
export function parisStamp(now: Date): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
  };
}

/** L'heure de Paris à laquelle la publication automatique part. */
export const PUBLISH_HOUR_PARIS = 16;
