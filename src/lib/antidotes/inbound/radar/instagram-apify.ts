/**
 * Instagram par l'acteur Apify `apify~instagram-scraper`.
 *
 * Pourquoi doubler la Business Discovery de Meta, déjà écrite à côté : elle
 * ne rend **ni les vues d'un reel ni son fichier vidéo**. Or c'est
 * exactement ce que l'inbound vient chercher — le score d'un reel se lit en
 * vues, et son script se transcrit du média. L'acteur rend les deux, et
 * `assemble.ts` le préfère dès qu'`APIFY_TOKEN` est là ; la Business
 * Discovery reste le repli gratuit.
 *
 * Mapping pur et testé, transport injecté. Coût observé côté Apify :
 * quelques dixièmes de centime par profil, un appel par compte veillé et par
 * jour. **Jamais lancé contre le vrai service.**
 */

import type { Fetcher } from "../../sourcing/providers";
import { runApifyActor } from "./apify";
import { asIso, asNumber, normalizeHandle, POSTS_PER_ACCOUNT, type RadarCollector, type RadarPost } from "./types";

export const INSTAGRAM_ACTOR = "apify~instagram-scraper";

/** Une entrée du jeu de résultats de l'acteur, telle qu'il la rend. */
export type ApifyInstagramItem = {
  type?: string;
  shortCode?: string;
  url?: string;
  caption?: string | null;
  timestamp?: string;
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  videoUrl?: string;
  displayUrl?: string;
  ownerUsername?: string;
  ownerFullName?: string;
  /** Présent sur la première entrée quand l'acteur a lu le profil. */
  followersCount?: number;
};

/**
 * `Video` couvre les reels ; `Sidecar` est un carrousel ; le reste est une
 * image. L'acteur ne dit pas « reel » : c'est le type de média qui compte,
 * pas l'emballage marketing du réseau.
 */
function mediaKindOf(type: string | undefined): "video" | "carousel" | "image" {
  if (type === "Video") return "video";
  if (type === "Sidecar") return "carousel";
  return "image";
}

export function mapApifyInstagramItem(item: ApifyInstagramItem, handle: string, followers: number | null): RadarPost | null {
  const url = item.url?.trim() || (item.shortCode ? `https://www.instagram.com/p/${item.shortCode}/` : "");
  if (!url) return null;
  const kind = mediaKindOf(item.type);
  const caption = item.caption?.trim();
  // Les deux compteurs de l'acteur disent la même chose selon l'âge du post :
  // prendre le plus grand, c'est prendre celui qui a été rempli.
  const views = Math.max(asNumber(item.videoViewCount) ?? 0, asNumber(item.videoPlayCount) ?? 0);
  return {
    url,
    content: caption || `(${kind === "video" ? "Reel" : kind === "carousel" ? "Carrousel" : "Publication"} sans légende)`,
    published_at: asIso(item.timestamp),
    metrics: {
      likes: asNumber(item.likesCount),
      comments: asNumber(item.commentsCount),
      ...(views > 0 ? { views } : {}),
      ...(followers !== null ? { followers_at_collect: followers } : {}),
    },
    author_handle: item.ownerUsername?.trim() || handle,
    media_kind: kind,
    media_url: kind === "video" ? (item.videoUrl?.trim() ?? null) : null,
  };
}

export function createInstagramApifyCollector(options: { token: string; fetcher?: Fetcher }): RadarCollector {
  return async (account) => {
    const handle = normalizeHandle(account.handle);
    const items = await runApifyActor<ApifyInstagramItem>({
      fetcher: options.fetcher ?? fetch,
      token: options.token,
      actor: INSTAGRAM_ACTOR,
      label: "Instagram (Apify)",
      input: {
        directUrls: [account.url?.trim() || `https://www.instagram.com/${handle}/`],
        resultsType: "posts",
        resultsLimit: POSTS_PER_ACCOUNT,
        addParentData: true,
      },
    });
    const followers = items.map((item) => asNumber(item.followersCount)).find((value) => value !== undefined) ?? null;
    return {
      posts: items.flatMap((item) => {
        const post = mapApifyInstagramItem(item, handle, followers);
        return post ? [post] : [];
      }),
      followers,
    };
  };
}
