/**
 * Les vidéos d'un compte TikTok, par l'acteur Apify `clockworks/tiktok-scraper`.
 *
 * Forme lue sur la documentation : `text`, `webVideoUrl`, `createTimeISO`,
 * `diggCount`, `commentCount`, `shareCount`, `playCount`, `authorMeta.fans`.
 */

import type { Fetcher } from "../../sourcing/providers";
import { runApifyActor } from "./apify";
import { asIso, asNumber, POSTS_PER_ACCOUNT, type RadarCollector, type RadarPost } from "./types";

export const TIKTOK_ACTOR = "clockworks~tiktok-scraper";

export type TiktokActorPost = {
  text?: string | null;
  webVideoUrl?: string | null;
  createTimeISO?: string | null;
  diggCount?: number | null;
  commentCount?: number | null;
  shareCount?: number | null;
  playCount?: number | null;
  authorMeta?: { name?: string | null; fans?: number | null } | null;
};

export function mapTiktokPost(item: TiktokActorPost, handle: string): RadarPost | null {
  const url = item.webVideoUrl?.trim();
  if (!url) return null;
  const content = item.text?.trim() || "(vidéo sans texte)";
  return {
    url,
    content,
    published_at: asIso(item.createTimeISO),
    metrics: {
      likes: asNumber(item.diggCount),
      comments: asNumber(item.commentCount),
      shares: asNumber(item.shareCount),
      views: asNumber(item.playCount),
      followers_at_collect: asNumber(item.authorMeta?.fans),
    },
    author_handle: item.authorMeta?.name?.trim() || handle,
  };
}

export function createTiktokCollector(options: { token: string; fetcher?: Fetcher }): RadarCollector {
  const fetcher = options.fetcher ?? fetch;
  return async (account) => {
    const items = await runApifyActor<TiktokActorPost>({
      fetcher,
      token: options.token,
      actor: TIKTOK_ACTOR,
      label: "Apify TikTok",
      input: { profiles: [account.handle], resultsPerPage: POSTS_PER_ACCOUNT, shouldDownloadVideos: false },
    });
    const posts = items.map((item) => mapTiktokPost(item, account.handle)).filter((post): post is RadarPost => post !== null);
    return { posts, followers: posts.find((post) => post.metrics.followers_at_collect)?.metrics.followers_at_collect ?? null };
  };
}
