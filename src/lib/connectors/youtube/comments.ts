import { excerptOf } from "@/lib/moderation/ingest";
import type { IngestedMessage, IngestedThread } from "@/lib/moderation/ingest";

/**
 * Traduction des commentaires YouTube vers le modèle de la Modération.
 *
 * YouTube a exactement la forme que l'inbox attend : un `commentThread` est un
 * commentaire de tête (`topLevelComment`) et ses réponses. C'est donc un fil,
 * comme sur Instagram — la publication commentée étant la **vidéo**.
 *
 * Fonctions pures : le transport vit dans `api.ts`, l'écriture en base dans
 * `moderation/sync.ts`.
 */

export type YouTubeCommentSnippet = {
  textOriginal?: string;
  textDisplay?: string;
  authorDisplayName?: string;
  authorProfileImageUrl?: string;
  authorChannelId?: { value?: string };
  publishedAt?: string;
  updatedAt?: string;
  videoId?: string;
};

export type YouTubeComment = {
  id: string;
  snippet?: YouTubeCommentSnippet;
};

export type YouTubeCommentThread = {
  id: string;
  snippet?: {
    videoId?: string;
    totalReplyCount?: number;
    topLevelComment?: YouTubeComment;
  };
  replies?: { comments?: YouTubeComment[] };
};

/** Ce que l'API `videos.list` rend d'une vidéo, réduit à ce qu'on affiche. */
export type YouTubeVideoLite = {
  id: string;
  snippet?: {
    title?: string;
    publishedAt?: string;
    thumbnails?: Record<string, { url?: string } | undefined>;
  };
};

function toIso(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const time = Date.parse(value);
  return Number.isNaN(time) ? fallback : new Date(time).toISOString();
}

/**
 * La vignette la plus petite qui fasse l'affaire.
 *
 * L'inbox l'affiche en 36 px : `medium` suffit, et `maxres` ferait charger
 * une image de 1280 px par ligne de liste.
 */
function thumbnailOf(video: YouTubeVideoLite | undefined): string | null {
  const thumbnails = video?.snippet?.thumbnails ?? {};
  return (
    thumbnails.medium?.url ??
    thumbnails.default?.url ??
    thumbnails.high?.url ??
    null
  );
}

function toMessage(
  comment: YouTubeComment,
  options: { brandChannelId: string; fallbackDate: string },
): IngestedMessage {
  const snippet = comment.snippet ?? {};
  const authorId = snippet.authorChannelId?.value ?? null;

  return {
    externalId: comment.id,
    authorExternalId: authorId,
    authorHandle: snippet.authorDisplayName ?? null,
    authorAvatarUrl: snippet.authorProfileImageUrl ?? null,
    // Un commentaire YouTube est du texte : ni GIF, ni pièce jointe.
    attachments: [],
    // `textOriginal` et non `textDisplay` : le second porte le HTML de
    // YouTube (liens, sauts de ligne balisés) et s'afficherait tel quel.
    body: snippet.textOriginal ?? snippet.textDisplay ?? "",
    fromBrand: authorId === options.brandChannelId,
    sentAt: toIso(snippet.publishedAt, options.fallbackDate),
  };
}

/**
 * Un fil de commentaires YouTube, vidéo comprise.
 *
 * Rend `null` quand seul le propriétaire de la chaîne a parlé : la marque qui
 * commente sa propre vidéo n'est pas une conversation à modérer — même règle
 * que sur Instagram.
 */
export function threadToConversation(options: {
  thread: YouTubeCommentThread;
  video: YouTubeVideoLite | undefined;
  brandChannelId: string;
}): IngestedThread | null {
  const { thread, video, brandChannelId } = options;
  const top = thread.snippet?.topLevelComment;
  if (!top) return null;

  const fallbackDate = toIso(
    top.snippet?.publishedAt ?? video?.snippet?.publishedAt,
    new Date(0).toISOString(),
  );

  const messages = [top, ...(thread.replies?.comments ?? [])].map((comment) =>
    toMessage(comment, { brandChannelId, fallbackDate }),
  );
  messages.sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt));

  const participant = messages.find((message) => !message.fromBrand);
  if (!participant) return null;

  const videoId = thread.snippet?.videoId ?? top.snippet?.videoId ?? null;

  return {
    channel: "youtube",
    kind: "comment",
    externalThreadId: thread.id,
    participantExternalId: participant.authorExternalId,
    participantHandle: participant.authorHandle,
    participantAvatarUrl: participant.authorAvatarUrl,
    post: videoId
      ? {
          externalId: videoId,
          permalink: `https://www.youtube.com/watch?v=${videoId}`,
          excerpt: excerptOf(video?.snippet?.title ?? "", 120),
          thumbnailUrl: thumbnailOf(video),
          publishedAt: video?.snippet?.publishedAt
            ? toIso(video.snippet.publishedAt, fallbackDate)
            : null,
        }
      : null,
    messages,
  };
}

export function threadsToConversations(options: {
  threads: YouTubeCommentThread[];
  /** Les vidéos déjà connues, par identifiant — le titre et la vignette. */
  videos: Map<string, YouTubeVideoLite>;
  brandChannelId: string;
}): IngestedThread[] {
  return options.threads.flatMap((thread) => {
    const videoId =
      thread.snippet?.videoId ?? thread.snippet?.topLevelComment?.snippet?.videoId;
    return (
      threadToConversation({
        thread,
        video: videoId ? options.videos.get(videoId) : undefined,
        brandChannelId: options.brandChannelId,
      }) ?? []
    );
  });
}

/** Les vidéos à décrire pour un lot de fils, sans doublon. */
export function videoIdsOf(threads: YouTubeCommentThread[]): string[] {
  const ids = new Set<string>();
  for (const thread of threads) {
    const id =
      thread.snippet?.videoId ?? thread.snippet?.topLevelComment?.snippet?.videoId;
    if (id) ids.add(id);
  }
  return [...ids];
}
