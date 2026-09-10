/**
 * Les filtres et le tri du tableau des contenus relevés.
 *
 * Purs : l'écran lit l'URL, passe des valeurs, récupère des lignes rangées.
 * Rien ici ne touche la base — c'est ce qui permet de les tester, et c'est
 * aussi ce qui les rend réutilisables par le relevé, qui applique les mêmes
 * seuils avant d'écrire.
 */

import type { PostMetrics, PostPlatform } from "../types";

export type ContentFilters = {
  platform: PostPlatform | null;
  /** Fenêtre en jours ; `null` pour tout l'historique. */
  days: number | null;
  minViews: number | null;
  minLikes: number | null;
  minComments: number | null;
  minShares: number | null;
  minSaves: number | null;
  sort: ContentSort;
  /** `desc` par défaut : sur toutes ces colonnes, c'est le haut qui intéresse. */
  direction: SortDirection;
  /** Ce qu'on regarde : la veille, mes propres posts, ou les deux. */
  source: ContentSource;
};

export type ContentSort =
  | "score"
  | "vues"
  | "likes"
  | "commentaires"
  | "partages"
  | "enregistrements"
  | "date";

export type SortDirection = "asc" | "desc";

export type ContentSource = "tout" | "veille" | "moi";

export const CONTENT_SORT_LABELS: Record<ContentSort, string> = {
  score: "Score",
  vues: "Vues",
  likes: "Likes",
  commentaires: "Commentaires",
  partages: "Partages",
  enregistrements: "Enregistrements",
  date: "Date",
};

export const CONTENT_SOURCE_LABELS: Record<ContentSource, string> = {
  tout: "Tout",
  veille: "La veille",
  moi: "Mes posts",
};

/** Les périodes proposées ; `null` = tout. */
export const CONTENT_PERIODS: { value: number | null; label: string }[] = [
  { value: 7, label: "7 j" },
  { value: 30, label: "30 j" },
  { value: 90, label: "90 j" },
  { value: null, label: "Tout" },
];

const PLATFORMS: PostPlatform[] = ["linkedin", "instagram", "youtube", "tiktok", "x"];

/** Un entier positif lu d'un paramètre d'URL, ou `null` — jamais NaN. */
export function parseThreshold(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

export function parsePlatform(raw: string | undefined): PostPlatform | null {
  return raw && (PLATFORMS as string[]).includes(raw) ? (raw as PostPlatform) : null;
}

const SORTS: ContentSort[] = [
  "score",
  "vues",
  "likes",
  "commentaires",
  "partages",
  "enregistrements",
  "date",
];

export function parseSort(raw: string | undefined): ContentSort {
  return SORTS.includes(raw as ContentSort) ? (raw as ContentSort) : "score";
}

export function parseDirection(raw: string | undefined): SortDirection {
  return raw === "asc" ? "asc" : "desc";
}

export function parseSource(raw: string | undefined): ContentSource {
  return raw === "veille" || raw === "moi" ? raw : "tout";
}

/**
 * La période : `tout` pour l'historique entier, un nombre de jours sinon.
 * Trente jours par défaut — la fenêtre d'une vague.
 */
export function parseDays(raw: string | undefined): number | null {
  if (raw === "tout") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 30;
}

export function parseContentFilters(params: Record<string, string | undefined>): ContentFilters {
  return {
    platform: parsePlatform(params.reseau),
    days: parseDays(params.jours),
    minViews: parseThreshold(params.vues),
    minLikes: parseThreshold(params.likes),
    minComments: parseThreshold(params.commentaires),
    minShares: parseThreshold(params.partages),
    minSaves: parseThreshold(params.enregistrements),
    sort: parseSort(params.tri),
    direction: parseDirection(params.sens),
    source: parseSource(params.source),
  };
}

/** Ce qu'une ligne du tableau doit porter pour être filtrée et rangée. */
export type ContentRow = {
  platform: PostPlatform;
  metrics: PostMetrics;
  published_at: string | null;
  score: { sortKey: number };
  /** Vrai pour un de mes posts : le tableau mêle la veille et ma production. */
  is_mine?: boolean;
};

/**
 * Un seuil ne rejette que ce qu'il peut juger : un post dont le réseau ne
 * rend pas les vues n'est pas écarté par « ≥ 10 000 vues », il ne se compare
 * pas. Rejeter sur une grandeur absente reviendrait à vider le tableau des
 * réseaux qui ne la donnent pas — LinkedIn n'a pas de vues.
 */
function passesThreshold(value: number | undefined, minimum: number | null): boolean {
  if (minimum === null) return true;
  if (value === undefined) return true;
  return value >= minimum;
}

export function matchesFilters(row: ContentRow, filters: ContentFilters, now: number): boolean {
  if (filters.platform && row.platform !== filters.platform) return false;
  if (filters.source === "veille" && row.is_mine) return false;
  if (filters.source === "moi" && !row.is_mine) return false;
  if (filters.days !== null) {
    if (!row.published_at) return false;
    const at = Date.parse(row.published_at);
    if (!Number.isFinite(at) || at < now - filters.days * 86_400_000) return false;
  }
  return (
    passesThreshold(row.metrics.views, filters.minViews) &&
    passesThreshold(row.metrics.likes, filters.minLikes) &&
    passesThreshold(row.metrics.comments, filters.minComments) &&
    passesThreshold(row.metrics.shares, filters.minShares) &&
    passesThreshold(row.metrics.saves, filters.minSaves)
  );
}

export function sortRows<T extends ContentRow>(
  rows: readonly T[],
  sort: ContentSort,
  direction: SortDirection = "desc",
): T[] {
  const value = (row: ContentRow): number => {
    switch (sort) {
      case "vues":
        return row.metrics.views ?? 0;
      case "likes":
        return row.metrics.likes ?? 0;
      case "commentaires":
        return row.metrics.comments ?? 0;
      case "partages":
        return row.metrics.shares ?? 0;
      case "enregistrements":
        return row.metrics.saves ?? 0;
      case "date":
        return row.published_at ? Date.parse(row.published_at) : 0;
      default:
        return row.score.sortKey;
    }
  };
  const sign = direction === "asc" ? -1 : 1;
  return [...rows].sort((a, b) => sign * (value(b) - value(a)));
}

export function applyContentFilters<T extends ContentRow>(
  rows: readonly T[],
  filters: ContentFilters,
  now: number,
): T[] {
  return sortRows(
    rows.filter((row) => matchesFilters(row, filters, now)),
    filters.sort,
    filters.direction,
  );
}

/** Le nombre de filtres réellement posés — ce que la pastille du bouton affiche. */
export function activeFilterCount(filters: ContentFilters): number {
  return [
    filters.platform !== null,
    filters.days !== 30,
    filters.minViews !== null,
    filters.minLikes !== null,
    filters.minComments !== null,
    filters.minShares !== null,
    filters.minSaves !== null,
    filters.source !== "tout",
  ].filter(Boolean).length;
}

/** Les paramètres d'URL d'un jeu de filtres — l'inverse de `parseContentFilters`. */
export function contentFiltersToParams(filters: Partial<ContentFilters>): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.platform) params.reseau = filters.platform;
  if (filters.days !== undefined) params.jours = filters.days === null ? "tout" : String(filters.days);
  if (filters.minViews) params.vues = String(filters.minViews);
  if (filters.minLikes) params.likes = String(filters.minLikes);
  if (filters.minComments) params.commentaires = String(filters.minComments);
  if (filters.minShares) params.partages = String(filters.minShares);
  if (filters.minSaves) params.enregistrements = String(filters.minSaves);
  if (filters.sort && filters.sort !== "score") params.tri = filters.sort;
  if (filters.direction === "asc") params.sens = "asc";
  if (filters.source && filters.source !== "tout") params.source = filters.source;
  return params;
}

/** Les clés d'URL que le tableau possède — à effacer quand on quitte sa vue. */
export const CONTENT_FILTER_KEYS = [
  "reseau",
  "jours",
  "vues",
  "likes",
  "commentaires",
  "partages",
  "enregistrements",
  "tri",
  "sens",
  "source",
] as const;
