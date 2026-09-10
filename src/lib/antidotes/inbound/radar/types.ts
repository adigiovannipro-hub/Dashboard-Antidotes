/**
 * Ce que le radar attend d'un réseau : les derniers posts d'un compte, avec
 * leurs grandeurs brutes, et le nombre d'abonnés quand le réseau le rend.
 *
 * Un connecteur par réseau, tous derrière la même signature, tous écrits sur
 * la documentation publique de leur source — aucun n'a encore tourné contre
 * le vrai service. Les mappings sont purs et testés ; le transport est une
 * fonction `fetch` injectée.
 */

import type { MediaKind, PostMetrics, PostPlatform } from "../../types";

export type RadarPost = {
  url: string;
  content: string;
  published_at: string | null;
  metrics: PostMetrics;
  author_handle: string | null;
  /** La nature du média, quand le réseau la dit — un reel se lit par son script. */
  media_kind?: MediaKind;
  /** L'URL du média, périssable : elle ne sert qu'à transcrire, jamais à l'affichage. */
  media_url?: string | null;
};

export type RadarCollection = {
  posts: RadarPost[];
  /** Les abonnés du compte au relevé, si le réseau les donne. */
  followers: number | null;
};

export type RadarCollector = (account: { handle: string; url: string | null }) => Promise<RadarCollection>;

export type RadarProviders = {
  collectors: Partial<Record<PostPlatform, RadarCollector>>;
  /** Les réseaux sans connecteur branché, et pourquoi — l'écran les nomme. */
  missing: Partial<Record<PostPlatform, string>>;
};

/** Combien de posts on demande par compte et par relevé. */
export const POSTS_PER_ACCOUNT = 30;

export function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function asIso(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value < 1e12 ? value * 1000 : value).toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }
  return null;
}

/** `@sandro`, `https://www.linkedin.com/in/sandro/` → `sandro`. */
export function normalizeHandle(raw: string): string {
  const trimmed = raw.trim();
  const fromUrl = trimmed.match(/^https?:\/\/[^/]+\/(?:in\/|@|company\/)?([^/?#]+)/i);
  const handle = (fromUrl ? fromUrl[1]! : trimmed).replace(/^@/, "").replace(/\/+$/, "");
  return handle;
}

/** Ce que le relevé garde d'un réseau — en dessous, un contenu n'entre pas. */
export type RadarThreshold = { min_views?: number; min_likes?: number; min_comments?: number };
