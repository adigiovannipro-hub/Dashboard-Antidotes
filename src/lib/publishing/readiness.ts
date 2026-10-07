/**
 * Ce qui peut partir, où, et ce qui bloque.
 *
 * Fonctions pures, testées à part : c'est le contrat de la publication
 * automatique. La règle d'or est de **ne jamais publier un post douteux** —
 * un blocage se lit sur la ligne, une publication ratée chez le client ne se
 * rattrape pas.
 */

export type PublishTarget = "instagram" | "facebook" | "tiktok" | "linkedin";

export const PUBLISH_TARGET_LABELS: Record<PublishTarget, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
};

/**
 * Où publie un couloir. Le couloir META historique du board couvre les deux
 * réseaux — c'est sa définition côté Monday. TikTok part en **brouillon**
 * dans l'application du compte (le client appuie sur « publier ») et LinkedIn
 * sur le **profil personnel** du client ; X, YouTube et les autres ne se
 * publient pas automatiquement.
 */
export function publishTargets(platform: string): PublishTarget[] {
  if (platform === "meta") return ["instagram", "facebook"];
  if (platform === "instagram") return ["instagram"];
  if (platform === "facebook") return ["facebook"];
  if (platform === "tiktok") return ["tiktok"];
  if (platform === "linkedin") return ["linkedin"];
  return [];
}

export type PublishBlocker =
  | "sans-visuel"
  | "sans-wording"
  | "reel-sans-video"
  | "carrousel-trop-long"
  | "pdf-hors-linkedin"
  | "facebook-carrousel-video"
  | "tiktok-video-seule"
  | "linkedin-melange"
  | "legende-trop-longue";

export const PUBLISH_BLOCKER_LABELS: Record<PublishBlocker, string> = {
  "sans-visuel": "aucun visuel accroché",
  "sans-wording": "wording absent ou non rédigé",
  "reel-sans-video": "un reel demande un fichier vidéo",
  "carrousel-trop-long": "un carrousel Meta accepte 10 visuels au plus",
  "pdf-hors-linkedin": "un PDF ne se publie que sur LinkedIn",
  "facebook-carrousel-video":
    "Facebook ne publie pas un carrousel qui contient une vidéo",
  "tiktok-video-seule":
    "le brouillon TikTok ne prend qu'une vidéo seule — les carrousels photo attendent l'app TikTok d'Antidotes",
  "linkedin-melange":
    "LinkedIn ne mêle pas une vidéo ou un PDF à d'autres visuels",
  "legende-trop-longue":
    "légende trop longue pour ce réseau (Instagram 2 200 caractères, LinkedIn 3 000)",
};

/** La forme sous laquelle le post part. */
export type PublishShape = "image" | "video" | "carousel" | "document";

const VIDEO_EXTENSIONS = [".mp4", ".mov", ".m4v"];

function cleanPath(path: string): string {
  return path.split("?")[0]?.toLowerCase() ?? "";
}

export function isVideoPath(path: string): boolean {
  const clean = cleanPath(path);
  return VIDEO_EXTENSIONS.some((extension) => clean.endsWith(extension));
}

export function isPdfPath(path: string): boolean {
  return cleanPath(path).endsWith(".pdf");
}

/** Instagram ne prend que du JPEG : tout autre format d'image se convertit. */
export function isJpegPath(path: string): boolean {
  const clean = cleanPath(path);
  return clean.endsWith(".jpg") || clean.endsWith(".jpeg");
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
 * Le plan de publication d'un sujet, tous réseaux confondus, ou ce qui
 * l'empêche. Ce que chaque réseau refuse en plus se lit dans `targetPlan`.
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

  const wording = subject.wording?.trim().toLowerCase() ?? "";
  if (!wording || WORDING_PLACEHOLDERS.has(wording)) {
    blockers.push("sans-wording");
  }

  if (subject.format === "reel" && visuals.length > 0 && !isVideoPath(visuals[0]!)) {
    blockers.push("reel-sans-video");
  }

  if (blockers.length > 0) return { ready: false, blockers };
  return { ready: true, shape: shapeOf(visuals) };
}

/**
 * La forme découle des fichiers plus que de l'étiquette : deux visuels sur
 * un « post » sont un carrousel, une vidéo seule part en reel — c'est le
 * seul format vidéo que le feed Instagram connaisse encore —, un PDF seul
 * est un document LinkedIn.
 */
function shapeOf(visuals: string[]): PublishShape {
  if (visuals.length > 1) return "carousel";
  const only = visuals[0] ?? "";
  if (isVideoPath(only)) return "video";
  if (isPdfPath(only)) return "document";
  return "image";
}

/** Les plafonds de légende, en caractères — TikTok n'en reçoit pas en brouillon. */
const CAPTION_LIMITS: Partial<Record<PublishTarget, number>> = {
  instagram: 2200,
  linkedin: 3000,
};

/**
 * Ce que **ce réseau** refuse, une fois le plan commun passé.
 *
 * LinkedIn reçoit un carrousel en **PDF** — la forme qu'on y fait défiler :
 * plusieurs images sont assemblées en un document, page après page, dans
 * l'ordre de la ligne. Une vidéo ou un PDF déjà fait, eux, partent seuls.
 */
export function targetPlan(
  target: PublishTarget,
  subject: PublishableSubject,
): { ready: true; shape: PublishShape } | { ready: false; blockers: PublishBlocker[] } {
  const visuals = subject.visual_urls;
  const videos = visuals.filter(isVideoPath).length;
  const pdfs = visuals.filter(isPdfPath).length;
  const blockers: PublishBlocker[] = [];

  if (target !== "linkedin" && pdfs > 0) blockers.push("pdf-hors-linkedin");

  if (target === "instagram" || target === "facebook") {
    if (visuals.length > 10) blockers.push("carrousel-trop-long");
  }
  if (target === "facebook" && visuals.length > 1 && videos > 0) {
    blockers.push("facebook-carrousel-video");
  }
  if (target === "tiktok" && !(visuals.length === 1 && videos === 1)) {
    blockers.push("tiktok-video-seule");
  }
  if (target === "linkedin" && visuals.length > 1 && videos + pdfs > 0) {
    blockers.push("linkedin-melange");
  }

  const limit = CAPTION_LIMITS[target];
  if (limit !== undefined && [...(subject.wording?.trim() ?? "")].length > limit) {
    blockers.push("legende-trop-longue");
  }

  if (blockers.length > 0) return { ready: false, blockers };
  const shape = shapeOf(visuals);
  return { ready: true, shape: target === "linkedin" && shape === "carousel" ? "document" : shape };
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

/**
 * Le statut qui arme la publication automatique : « Programmé ». « Validé »
 * est l'accord du client, il ne publie rien — c'est l'agence qui programme.
 */
export const PUBLISH_TRIGGER_STATUS = "scheduled";

/**
 * Ce que « Publier maintenant » accepte, et d'où une ligne passe « Publié » :
 * le geste manuel de l'agence vaut aussi pour une ligne seulement validée.
 */
export const PUBLISHABLE_NOW_STATUSES: string[] = ["scheduled", "validated"];

/** L'heure de Paris à laquelle la publication automatique part. */
export const PUBLISH_HOUR_PARIS = 16;

/**
 * La fenêtre de publication : de 16h à minuit, heure de Paris.
 *
 * Le passage de 16h00 pile vient de `pg_cron` (Supabase), qui appelle
 * `/api/cron/publier` à la minute. La fenêtre reste ouverte jusqu'à minuit
 * pour les filets : un `schedule` GitHub arrive des heures en retard et en
 * saute près d'un sur deux, sans ligne rouge ni notification.
 *
 * Ouverte de 16h à minuit, elle reçoit le passage du soir d'`airwallex-sync.yml`
 * (programmé à 15h UTC, lancé par GitHub des heures plus tard — la fenêtre de
 * huit heures absorbe le retard) et, souvent, celui du matin, qui rattrape.
 * La borne haute n'a pas à s'écrire : à
 * minuit, la date de Paris avance et les sujets du jour deviennent des
 * retards, que le passage refuse déjà de publier.
 *
 * Ce qui rend l'élargissement sûr, c'est `planning_publications` : revendiquer
 * un couple (sujet, réseau) est une insertion sous contrainte d'unicité. Un
 * sujet parti à 16h est ignoré à 17h. Effet de bord voulu : une ligne en
 * `error` est reprise à chaque passage, donc un compte affecté ou un wording
 * corrigé à 18h publie à 19h au lieu de ne jamais partir.
 */
export function isPublishWindow(parisHour: number): boolean {
  return parisHour >= PUBLISH_HOUR_PARIS;
}
