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
  sort: ContentSort;
};

export type ContentSort = "score" | "vues" | "likes" | "commentaires" | "date";

export const CONTENT_SORT_LABELS: Record<ContentSort, string> = {
  score: "Score",
  vues: "Vues",
  likes: "Likes",
  commentaires: "Commentaires",
  date: "Date",
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

export function parseSort(raw: string | undefined): ContentSort {
  return raw === "vues" || raw === "likes" || raw === "commentaires" || raw === "date" ? raw : "score";
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
    sort: parseSort(params.tri),
  };
}

/** Ce qu'une ligne du tableau doit porter pour être filtrée et rangée. */
export type ContentRow = {
  platform: PostPlatform;
  metrics: PostMetrics;
  published_at: string | null;
  score: { sortKey: number };
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
  if (filters.days !== null) {
    if (!row.published_at) return false;
    const at = Date.parse(row.published_at);
    if (!Number.isFinite(at) || at < now - filters.days * 86_400_000) return false;
  }
  return (
    passesThreshold(row.metrics.views, filters.minViews) &&
    passesThreshold(row.metrics.likes, filters.minLikes) &&
    passesThreshold(row.metrics.comments, filters.minComments)
  );
}

export function sortRows<T extends ContentRow>(rows: readonly T[], sort: ContentSort): T[] {
  const value = (row: ContentRow): number => {
    switch (sort) {
      case "vues":
        return row.metrics.views ?? 0;
      case "likes":
        return row.metrics.likes ?? 0;
      case "commentaires":
        return row.metrics.comments ?? 0;
      case "date":
        return row.published_at ? Date.parse(row.published_at) : 0;
      default:
        return row.score.sortKey;
    }
  };
  return [...rows].sort((a, b) => value(b) - value(a));
}

export function applyContentFilters<T extends ContentRow>(
  rows: readonly T[],
  filters: ContentFilters,
  now: number,
): T[] {
  return sortRows(rows.filter((row) => matchesFilters(row, filters, now)), filters.sort);
}

/** Les paramètres d'URL d'un jeu de filtres — l'inverse de `parseContentFilters`. */
export function contentFiltersToParams(filters: Partial<ContentFilters>): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.platform) params.reseau = filters.platform;
  if (filters.days !== undefined) params.jours = filters.days === null ? "tout" : String(filters.days);
  if (filters.minViews) params.vues = String(filters.minViews);
  if (filters.minLikes) params.likes = String(filters.minLikes);
  if (filters.minComments) params.commentaires = String(filters.minComments);
  if (filters.sort && filters.sort !== "score") params.tri = filters.sort;
  return params;
}
