/**
 * Les publications d'un compte Instagram tiers, par la **Business Discovery**
 * de l'API Graph : un compte professionnel autorisé (n'importe lequel de
 * l'inventaire de l'agence) peut lire les médias publics d'un autre compte
 * professionnel, avec ses likes, commentaires et abonnés. Aucun scraping,
 * aucun acteur, le jeton Meta déjà branché. Les Reels vivent ici.
 *
 * Forme lue sur la documentation : `business_discovery.{followers_count,
 * media.data[].{caption, like_count, comments_count, media_product_type,
 * permalink, timestamp}}`. Un compte personnel ou privé répond une erreur
 * (#100), qui se dit telle quelle.
 */

import { fetchJson, type Fetcher } from "../../sourcing/providers";
import { asIso, asNumber, POSTS_PER_ACCOUNT, type RadarCollector, type RadarPost } from "./types";

const GRAPH = "https://graph.facebook.com/v21.0";

export type InstagramDiscoveryPayload = {
  business_discovery?: {
    username?: string;
    followers_count?: number;
    media?: {
      data?: {
        id?: string;
        caption?: string | null;
        like_count?: number;
        comments_count?: number;
        media_product_type?: string;
        permalink?: string;
        timestamp?: string;
      }[];
    };
  };
  error?: { message?: string; code?: number };
};

export function mapInstagramMedia(
  item: NonNullable<NonNullable<InstagramDiscoveryPayload["business_discovery"]>["media"]>["data"] extends (infer T)[] | undefined ? T : never,
  handle: string,
  followers: number | null,
): RadarPost | null {
  const url = item.permalink?.trim();
  if (!url) return null;
  const caption = item.caption?.trim();
  const kind = item.media_product_type === "REELS" ? "Reel" : "Publication";
  return {
    url,
    content: caption || `(${kind} sans légende)`,
    published_at: asIso(item.timestamp),
    metrics: {
      likes: asNumber(item.like_count),
      comments: asNumber(item.comments_count),
      followers_at_collect: followers ?? undefined,
    },
    author_handle: handle,
  };
}

export function discoveryUrl(igUserId: string, handle: string, accessToken: string): string {
  const fields = `business_discovery.username(${handle}){username,followers_count,media.limit(${POSTS_PER_ACCOUNT}){caption,like_count,comments_count,media_product_type,permalink,timestamp}}`;
  return `${GRAPH}/${igUserId}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(accessToken)}`;
}

export function createInstagramCollector(options: {
  igUserId: string;
  accessToken: string;
  fetcher?: Fetcher;
}): RadarCollector {
  const fetcher = options.fetcher ?? fetch;
  return async (account) => {
    const payload = await fetchJson<InstagramDiscoveryPayload>(
      fetcher,
      "Instagram",
      discoveryUrl(options.igUserId, account.handle, options.accessToken),
    );
    if (payload.error) throw new Error(`Instagram (#${payload.error.code ?? "?"}) ${payload.error.message ?? ""}`.trim());
    const discovery = payload.business_discovery;
    const followers = asNumber(discovery?.followers_count) ?? null;
    const posts = (discovery?.media?.data ?? [])
      .map((item) => mapInstagramMedia(item, discovery?.username ?? account.handle, followers))
      .filter((post): post is RadarPost => post !== null);
    return { posts, followers };
  };
}
