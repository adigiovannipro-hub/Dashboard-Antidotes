/**
 * Normalisation du vocabulaire Monday vers le modèle du Planning Éditorial.
 *
 * Sert à **l'import** : reprendre une année déjà saisie dans Monday plutôt que
 * de la retaper. L'échange est à sens unique — une fois importé, le tableau du
 * dashboard fait autorité, et rien n'est réécrit dans Monday.
 *
 * Ce qui varie réellement d'un board client à l'autre, constaté en production :
 *
 *   • une colonne `Commentaires` chez l'un, absente chez l'autre ;
 *   • sept libellés de `Thématique` chez l'un, trois chez l'autre ;
 *   • des `Objectifs` différents (`Traffic` ici, `Followers` là) ;
 *   • des groupes de mois qui ne s'écrivent même pas pareil — « AOUT » contre
 *     « AOÛT ».
 *
 * D'où la règle : rien de tout cela n'est en dur. Le mapping est déduit à la
 * lecture du board.
 */

import type { PlanningFormat, PlanningPlatform, PlanningStatus } from "./types";

/**
 * Champ du modèle → identifiant de colonne Monday.
 *
 * Le `null` est explicite plutôt qu'une clé absente : « ce board n'a pas de
 * Commentaires » est une information, pas un oubli de configuration.
 */
export type ColumnMapping = {
  status: string | null;
  format: string | null;
  date: string | null;
  wording: string | null;
  comments: string | null;
  sponsoring: string | null;
  objective: string | null;
  adStatus: string | null;
  owner: string | null;
  visual: string | null;
};

/** Casse et accents écartés : « PUBLIÉ », « publie » et « Publié » convergent. */
export function normalizeLabel(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

// --- Mois -------------------------------------------------------------------

const MONTH_NAMES = [
  "JANVIER",
  "FEVRIER",
  "MARS",
  "AVRIL",
  "MAI",
  "JUIN",
  "JUILLET",
  "AOUT",
  "SEPTEMBRE",
  "OCTOBRE",
  "NOVEMBRE",
  "DECEMBRE",
];

/**
 * Libellé de groupe Monday → premier jour du mois, `YYYY-MM-01`.
 *
 * Le libellé seul ne suffit pas : il ne porte pas l'année, qui vient du board.
 * Renvoie `null` pour un groupe qui n'est pas un mois — les boards contiennent
 * parfois des groupes de travail (« IDÉES », « À CLASSER ») qu'il ne faut pas
 * confondre avec le planning.
 */
export function parseMonthLabel(label: string, year: number): string | null {
  const index = MONTH_NAMES.indexOf(normalizeLabel(label));
  if (index === -1) return null;
  return `${year}-${String(index + 1).padStart(2, "0")}-01`;
}

/** `2026-08-01` → « Août 2026 ». */
export function monthLabel(month: string): string {
  const date = new Date(`${month}T00:00:00Z`);
  const formatted = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/** `2026-08-01` → « AOÛT », le libellé par défaut d'un nouveau groupe. */
export function monthGroupLabel(month: string): string {
  const date = new Date(`${month}T00:00:00Z`);
  return new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" })
    .format(date)
    .toUpperCase();
}

// --- Nom de board -----------------------------------------------------------

/**
 * `LUNETTES BONDET I PE 2026` → client, année, archive.
 *
 * La convention de nommage est « CLIENT I PE ANNÉE », le séparateur étant un
 * i majuscule isolé. Un nom de client peut lui-même contenir un « I » collé
 * (`I-WAY`), d'où le `\s+I\s+` qui exige les espaces.
 */
export function parseBoardName(name: string): {
  clientName: string;
  year: number | null;
  isArchive: boolean;
} | null {
  const match = /^(.*?)\s+I\s+PE\s+(\d{4})\s*(\[ARCHIVE\])?\s*$/i.exec(name.trim());
  if (!match) return null;
  return {
    clientName: match[1]!.trim(),
    year: Number(match[2]),
    isArchive: Boolean(match[3]),
  };
}

// --- Statuts ----------------------------------------------------------------

const STATUS_BY_LABEL: Record<string, PlanningStatus> = {
  "EN COURS": "in_progress",
  PUBLIE: "published",
  "A VALIDER": "to_validate",
  VALIDE: "validated",
  "EN ATTENTE": "on_hold",
  "NON RETENU": "dropped",
  "WORDING A FAIRE": "wording_todo",
  PROGRAMME: "scheduled",
  "EN BROUILLON": "draft",
};

/**
 * Libellé Monday → statut du modèle.
 *
 * Un libellé inconnu retombe sur `idea` : la publication existe, on ne sait
 * juste rien de son avancement.
 */
export function normalizeStatus(raw: string | null | undefined): PlanningStatus {
  const key = normalizeLabel(raw);
  if (!key) return "idea";
  return STATUS_BY_LABEL[key] ?? "idea";
}

// --- Formats ----------------------------------------------------------------

const FORMAT_BY_LABEL: Record<string, PlanningFormat> = {
  REELS: "reel",
  REEL: "reel",
  POST: "post",
  POSTS: "post",
  STORIE: "story",
  STORIES: "story",
  STORY: "story",
  CARROUSEL: "carousel",
  CAROUSEL: "carousel",
  THREAD: "thread",
  VIDEO: "video",
  DARK: "dark",
};

export function normalizeFormat(raw: string | null | undefined): PlanningFormat {
  return FORMAT_BY_LABEL[normalizeLabel(raw)] ?? "other";
}

// --- Plateformes ------------------------------------------------------------

const PLATFORM_BY_LABEL: Record<string, PlanningPlatform> = {
  META: "meta",
  INSTAGRAM: "instagram",
  IG: "instagram",
  FACEBOOK: "facebook",
  FB: "facebook",
  LINKEDIN: "linkedin",
  "LINKED IN": "linkedin",
  TIKTOK: "tiktok",
  "TIK TOK": "tiktok",
  YOUTUBE: "youtube",
  YT: "youtube",
  X: "x",
  TWITTER: "x",
  PINTEREST: "pinterest",
  SNAPCHAT: "snapchat",
};

/**
 * Nom de l'élément parent → plateforme du couloir.
 *
 * « DARK » n'en est pas une : c'est un format de diffusion, et le couloir garde
 * son nom d'origine. Le rendre `other` évite d'inventer une plateforme qui
 * n'existe pas.
 */
export function normalizePlatform(
  name: string | null | undefined,
): PlanningPlatform {
  return PLATFORM_BY_LABEL[normalizeLabel(name)] ?? "other";
}

// --- Statut publicitaire ----------------------------------------------------

const AD_STATUS_BY_LABEL: Record<string, "todo" | "doing" | "done" | "blocked"> = {
  "A FAIRE": "todo",
  "EN COURS": "doing",
  FAIT: "done",
  BLOCKED: "blocked",
  BLOQUE: "blocked",
};

export function normalizeAdStatus(
  raw: string | null | undefined,
): "todo" | "doing" | "done" | "blocked" | null {
  const key = normalizeLabel(raw);
  return key ? (AD_STATUS_BY_LABEL[key] ?? null) : null;
}

// --- Colonnes ---------------------------------------------------------------

export type MondayColumn = {
  id: string;
  title: string;
  type: string;
};

export const EMPTY_COLUMN_MAPPING: ColumnMapping = {
  status: null,
  format: null,
  date: null,
  wording: null,
  comments: null,
  sponsoring: null,
  objective: null,
  adStatus: null,
  owner: null,
  visual: null,
};

/**
 * Titre de colonne → champ du modèle.
 *
 * Le titre plutôt que l'identifiant : c'est ce que l'utilisateur voit et
 * maintient. Les identifiants Monday sont des restes d'historique (`texte5`,
 * `dup__of_status`) qui ne survivent pas toujours à la duplication d'un board.
 */
const FIELD_BY_TITLE: Record<string, keyof ColumnMapping> = {
  STATUS: "status",
  STATUT: "status",
  THEMATIQUE: "format",
  FORMAT: "format",
  TYPE: "format",
  DATE: "date",
  WORDING: "wording",
  COMMENTAIRES: "comments",
  SPONSORISATION: "sponsoring",
  OBJECTIFS: "objective",
  "STATUT ADS": "adStatus",
  PROPRIETAIRE: "owner",
  VISUEL: "visual",
};

/** Repli par identifiant, pour un board dont une colonne aurait été renommée. */
const FIELD_BY_ID: Record<string, keyof ColumnMapping> = {
  status: "status",
  dup__of_status: "format",
  date0: "date",
  texte5: "wording",
  chiffres: "sponsoring",
  statut: "objective",
  statut0: "adStatus",
  person: "owner",
  fichier: "visual",
};

/**
 * Déduit le mapping d'un board à partir de ses colonnes de sous-éléments.
 *
 * « Statut Ads » ne doit surtout pas atterrir sur `status` : la correspondance
 * par titre est donc exacte, jamais partielle.
 */
export function deriveColumnMapping(columns: MondayColumn[]): ColumnMapping {
  const mapping: ColumnMapping = { ...EMPTY_COLUMN_MAPPING };

  for (const column of columns) {
    const field = FIELD_BY_TITLE[normalizeLabel(column.title)];
    if (field && mapping[field] === null) mapping[field] = column.id;
  }

  for (const column of columns) {
    const field = FIELD_BY_ID[column.id];
    if (field && mapping[field] === null) mapping[field] = column.id;
  }

  return mapping;
}

// --- Valeurs de colonne -----------------------------------------------------

/** Colonne `numbers` : Monday rend une chaîne, parfois vide. */
export function parseSponsoring(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * Colonne `file`. Deux formes selon la façon dont la valeur est lue : le JSON
 * de l'API GraphQL, ou la liste d'URL séparées par des virgules du champ texte.
 */
export function parseVisualUrls(raw: string | null | undefined): string[] {
  if (!raw) return [];

  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      const files = (parsed as { files?: { url?: string; name?: string }[] }).files;
      if (Array.isArray(files)) {
        return files
          .map((file) => file.url ?? file.name ?? "")
          .filter((url) => url.length > 0);
      }
    } catch {
      // Valeur illisible : on retombe sur la découpe par virgules.
    }
  }

  return trimmed
    .split(",")
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
}

/** Colonne `date` : `YYYY-MM-DD`, ou rien. */
export function parseScheduledOn(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw.trim());
  return match ? match[1]! : null;
}
