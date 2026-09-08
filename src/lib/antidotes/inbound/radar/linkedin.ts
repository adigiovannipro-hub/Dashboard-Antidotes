/**
 * Les posts d'un profil LinkedIn, par l'acteur Apify
 * `apimaestro/linkedin-profile-posts` — LinkedIn n'expose les publications
 * d'un autre membre à aucune API officielle, et interdit le scraping direct ;
 * l'acteur est le passage que tout le monde emprunte.
 *
 * Forme de sortie lue sur la documentation de l'acteur : `text`, `url`,
 * `posted_at.timestamp`, `stats.{total_reactions, comments, reposts}`. Le
 * nombre d'abonnés de l'auteur n'y figure pas : il se saisit sur le compte
 * veillé, ou reste inconnu — le score se dit alors en absolu.
 */

import type { Fetcher } from "../../sourcing/providers";
import { runApifyActor } from "./apify";
import { asIso, asNumber, POSTS_PER_ACCOUNT, type RadarCollector, type RadarPost } from "./types";

export const LINKEDIN_ACTOR = "apimaestro~linkedin-profile-posts";

export type LinkedinActorPost = {
  text?: string | null;
  url?: string | null;
  posted_at?: { timestamp?: number | null; date?: string | null } | null;
  stats?: {
    total_reactions?: number | null;
    comments?: number | null;
    reposts?: number | null;
  } | null;
  author?: { username?: string | null } | null;
};

export function mapLinkedinPost(item: LinkedinActorPost, handle: string): RadarPost | null {
  const url = item.url?.trim();
  const content = item.text?.trim();
  if (!url || !content) return null;
  return {
    url,
    content,
    published_at: asIso(item.posted_at?.timestamp ?? item.posted_at?.date),
    metrics: {
      likes: asNumber(item.stats?.total_reactions),
      comments: asNumber(item.stats?.comments),
      shares: asNumber(item.stats?.reposts),
    },
    author_handle: item.author?.username?.trim() || handle,
  };
}

export function createLinkedinCollector(options: { token: string; fetcher?: Fetcher }): RadarCollector {
  const fetcher = options.fetcher ?? fetch;
  return async (account) => {
    const items = await runApifyActor<LinkedinActorPost>({
      fetcher,
      token: options.token,
      actor: LINKEDIN_ACTOR,
      label: "Apify LinkedIn",
      input: { username: account.handle, limit: POSTS_PER_ACCOUNT },
    });
    return {
      posts: items.map((item) => mapLinkedinPost(item, account.handle)).filter((post): post is RadarPost => post !== null),
      followers: null,
    };
  };
}
