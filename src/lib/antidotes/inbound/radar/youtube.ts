/**
 * Les dernières vidéos d'une chaîne YouTube, par l'API Data v3 avec une clé
 * d'API — pas d'OAuth : ce sont des données publiques. Trois appels par
 * chaîne (chaîne → playlist des envois → statistiques des vidéos), trois
 * unités sur les dix mille quotidiennes du quota gratuit.
 */

import { fetchJson, type Fetcher } from "../../sourcing/providers";
import { asIso, asNumber, POSTS_PER_ACCOUNT, type RadarCollector, type RadarPost } from "./types";

const API = "https://www.googleapis.com/youtube/v3";

export type YoutubeChannelPayload = {
  items?: {
    id?: string;
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
    statistics?: { subscriberCount?: string };
  }[];
};

export type YoutubeVideoPayload = {
  items?: {
    id?: string;
    snippet?: { title?: string; description?: string; publishedAt?: string; channelTitle?: string };
    statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  }[];
};

export function mapYoutubeVideo(item: NonNullable<YoutubeVideoPayload["items"]>[number], handle: string): RadarPost | null {
  if (!item.id || !item.snippet?.title) return null;
  const description = item.snippet.description?.trim().slice(0, 600) ?? "";
  return {
    url: `https://www.youtube.com/watch?v=${item.id}`,
    content: description ? `${item.snippet.title.trim()}\n\n${description}` : item.snippet.title.trim(),
    published_at: asIso(item.snippet.publishedAt),
    metrics: {
      views: asNumber(Number(item.statistics?.viewCount)),
      likes: asNumber(Number(item.statistics?.likeCount)),
      comments: asNumber(Number(item.statistics?.commentCount)),
    },
    author_handle: item.snippet.channelTitle?.trim() || handle,
  };
}

export function createYoutubeCollector(options: { apiKey: string; fetcher?: Fetcher }): RadarCollector {
  const fetcher = options.fetcher ?? fetch;
  const key = encodeURIComponent(options.apiKey);
  return async (account) => {
    const handle = account.handle.startsWith("UC") && account.handle.length === 24
      ? `id=${account.handle}`
      : `forHandle=${encodeURIComponent(account.handle.startsWith("@") ? account.handle : `@${account.handle}`)}`;
    const channel = await fetchJson<YoutubeChannelPayload>(
      fetcher,
      "YouTube",
      `${API}/channels?part=contentDetails,statistics&${handle}&key=${key}`,
    );
    const first = channel.items?.[0];
    const uploads = first?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploads) throw new Error("YouTube : chaîne introuvable pour ce handle.");
    const followers = asNumber(Number(first?.statistics?.subscriberCount)) ?? null;

    const playlist = await fetchJson<{ items?: { contentDetails?: { videoId?: string } }[] }>(
      fetcher,
      "YouTube",
      `${API}/playlistItems?part=contentDetails&playlistId=${uploads}&maxResults=${POSTS_PER_ACCOUNT}&key=${key}`,
    );
    const ids = (playlist.items ?? []).map((item) => item.contentDetails?.videoId).filter((id): id is string => Boolean(id));
    if (ids.length === 0) return { posts: [], followers };

    const videos = await fetchJson<YoutubeVideoPayload>(
      fetcher,
      "YouTube",
      `${API}/videos?part=snippet,statistics&id=${ids.join(",")}&key=${key}`,
    );
    const posts = (videos.items ?? [])
      .map((item) => mapYoutubeVideo(item, account.handle))
      .filter((post): post is RadarPost => post !== null)
      .map((post) => ({ ...post, metrics: { ...post.metrics, followers_at_collect: followers ?? undefined } }));
    return { posts, followers };
  };
}
