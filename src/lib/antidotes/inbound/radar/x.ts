/**
 * Les tweets d'un compte X, par l'acteur Apify `apidojo/tweet-scraper` —
 * l'API officielle facture la lecture au-delà de ce qu'une veille justifie.
 *
 * Forme lue sur la documentation : `text`, `url`, `createdAt`, `likeCount`,
 * `retweetCount`, `replyCount`, `viewCount`, `author.followers`.
 */

import type { Fetcher } from "../../sourcing/providers";
import { runApifyActor } from "./apify";
import { asIso, asNumber, POSTS_PER_ACCOUNT, type RadarCollector, type RadarPost } from "./types";

export const X_ACTOR = "apidojo~tweet-scraper";

export type XActorPost = {
  text?: string | null;
  url?: string | null;
  createdAt?: string | null;
  likeCount?: number | null;
  retweetCount?: number | null;
  replyCount?: number | null;
  viewCount?: number | null;
  isRetweet?: boolean;
  author?: { userName?: string | null; followers?: number | null } | null;
};

export function mapXPost(item: XActorPost, handle: string): RadarPost | null {
  const url = item.url?.trim();
  const content = item.text?.trim();
  if (!url || !content || item.isRetweet) return null;
  return {
    url,
    content,
    published_at: asIso(item.createdAt),
    metrics: {
      likes: asNumber(item.likeCount),
      comments: asNumber(item.replyCount),
      shares: asNumber(item.retweetCount),
      views: asNumber(item.viewCount),
      followers_at_collect: asNumber(item.author?.followers),
    },
    author_handle: item.author?.userName?.trim() || handle,
  };
}

export function createXCollector(options: { token: string; fetcher?: Fetcher }): RadarCollector {
  const fetcher = options.fetcher ?? fetch;
  return async (account) => {
    const items = await runApifyActor<XActorPost>({
      fetcher,
      token: options.token,
      actor: X_ACTOR,
      label: "Apify X",
      input: { twitterHandles: [account.handle], maxItems: POSTS_PER_ACCOUNT, sort: "Top" },
    });
    const posts = items.map((item) => mapXPost(item, account.handle)).filter((post): post is RadarPost => post !== null);
    return { posts, followers: posts.find((post) => post.metrics.followers_at_collect)?.metrics.followers_at_collect ?? null };
  };
}
