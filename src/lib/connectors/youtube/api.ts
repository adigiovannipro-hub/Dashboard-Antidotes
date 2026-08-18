import "server-only";

import { youtubeCall } from "@/lib/social/youtube";
import type {
  YouTubeCommentThread,
  YouTubeVideoLite,
} from "./comments";

/**
 * Les appels YouTube du connecteur — commentaires d'une chaîne, vidéos
 * commentées, réponse à un fil.
 *
 * Le quota gratuit est de 10 000 unités par jour et par projet. Une page de
 * commentaires coûte **1 unité**, une description de vidéos aussi, une
 * réponse **50**. Un relevé horaire d'une chaîne active tient donc très
 * largement dedans — c'est la réponse qui coûte, et elle est humaine.
 */

/** Garde-fou : au-delà, on considère que la pagination boucle. */
const MAX_PAGES = 20;

/**
 * Les fils de commentaires d'une chaîne, toutes vidéos confondues.
 *
 * `allThreadsRelatedToChannelId` et non `videoId` : un appel par vidéo
 * coûterait une unité par vidéo et raterait les commentaires des anciennes.
 * `order=time` rend les plus récents d'abord, ce qui permet de s'arrêter dès
 * qu'on remonte plus loin que la fenêtre.
 */
export async function fetchChannelCommentThreads(options: {
  channelId: string;
  accessToken: string;
  /** Borne basse `YYYY-MM-DD` : on cesse de paginer au-delà. */
  since: string;
  maxPages?: number;
}): Promise<YouTubeCommentThread[]> {
  const threads: YouTubeCommentThread[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < (options.maxPages ?? MAX_PAGES); page += 1) {
    const params: Record<string, string> = {
      part: "snippet,replies",
      allThreadsRelatedToChannelId: options.channelId,
      order: "time",
      maxResults: "100",
      textFormat: "plainText",
    };
    if (pageToken) params.pageToken = pageToken;

    const payload = await youtubeCall<{
      items?: YouTubeCommentThread[];
      nextPageToken?: string;
    }>("/commentThreads", params, options.accessToken);

    const items = payload.items ?? [];
    threads.push(...items);

    const oldest = items.at(-1)?.snippet?.topLevelComment?.snippet?.publishedAt;
    if (oldest && oldest.slice(0, 10) < options.since) break;

    pageToken = payload.nextPageToken;
    if (!pageToken) break;
  }

  // Un fil dont le commentaire de tête précède la fenêtre peut porter une
  // réponse récente : on garde tout ce que la pagination a rapporté, la
  // borne ne sert qu'à savoir quand s'arrêter de demander.
  return threads;
}

/** Le titre et la vignette des vidéos commentées, par paquets de cinquante. */
export async function fetchVideos(options: {
  ids: readonly string[];
  accessToken: string;
}): Promise<Map<string, YouTubeVideoLite>> {
  const found = new Map<string, YouTubeVideoLite>();

  for (let start = 0; start < options.ids.length; start += 50) {
    const batch = options.ids.slice(start, start + 50);
    const payload = await youtubeCall<{ items?: YouTubeVideoLite[] }>(
      "/videos",
      { part: "snippet", id: batch.join(","), maxResults: "50" },
      options.accessToken,
    );
    for (const video of payload.items ?? []) found.set(video.id, video);
  }

  return found;
}

/**
 * Répond à un fil de commentaires.
 *
 * `comments.insert` avec `parentId` : YouTube n'accepte les réponses qu'au
 * niveau du commentaire de tête, exactement comme Instagram. L'identifiant
 * du fil **est** celui de son commentaire de tête.
 */
export async function replyToCommentThread(options: {
  parentId: string;
  message: string;
  accessToken: string;
}): Promise<{ id: string }> {
  const url = new URL("https://www.googleapis.com/youtube/v3/comments");
  url.searchParams.set("part", "snippet");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${options.accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      snippet: { parentId: options.parentId, textOriginal: options.message },
    }),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as {
    id?: string;
    error?: { message?: string; errors?: { reason?: string }[] };
  };

  if (!response.ok || payload.error || !payload.id) {
    const reason = payload.error?.errors?.[0]?.reason;
    throw new Error(
      reason
        ? `${payload.error?.message ?? "Réponse refusée par YouTube"} (${reason})`
        : (payload.error?.message ?? `Réponse refusée par YouTube (${response.status}).`),
    );
  }

  return { id: payload.id };
}
