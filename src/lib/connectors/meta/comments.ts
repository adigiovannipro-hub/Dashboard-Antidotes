import { excerptOf } from "@/lib/moderation/ingest";
import type {
  IngestedMessage,
  IngestedPost,
  IngestedThread,
} from "@/lib/moderation/ingest";

/**
 * Traduction des commentaires Graph vers le modèle de la Modération.
 *
 * Le vocabulaire de l'inbox est le fil : **un commentaire de tête et ses
 * réponses forment une conversation**, comme dans la Boîte de réception Meta.
 * Les fonctions sont pures — le transport vit dans `graph.ts`, l'écriture en
 * base dans `moderation/sync.ts`.
 *
 * Un fil dont tous les messages viennent de la marque n'entre pas : la marque
 * qui commente son propre post (premier commentaire à hashtags, réponse à un
 * fil supprimé) n'est pas une conversation à modérer.
 */

export type MetaCommentAuthor = {
  id?: string;
  name?: string;
  username?: string;
};

/** Un commentaire Instagram, réponses imbriquées comprises. */
export type MetaIgCommentRow = {
  id: string;
  text?: string;
  timestamp?: string;
  username?: string;
  from?: MetaCommentAuthor;
  replies?: { data?: MetaIgCommentRow[] };
};

/** Un commentaire de Page, à plat (`filter=stream`), rattaché par `parent`. */
export type MetaPageCommentRow = {
  id: string;
  message?: string;
  created_time?: string;
  from?: MetaCommentAuthor;
  parent?: { id?: string };
};

/** Le strict nécessaire d'un média Instagram pour situer ses commentaires. */
export type MetaIgMediaLite = {
  id: string;
  caption?: string;
  permalink?: string;
  timestamp?: string;
  media_url?: string;
  thumbnail_url?: string;
  media_type?: string;
  media_product_type?: string;
  comments_count?: number;
};

/** Le strict nécessaire d'un post de Page. */
export type MetaPagePostLite = {
  id: string;
  message?: string;
  permalink_url?: string;
  full_picture?: string;
  created_time?: string;
  comments?: { summary?: { total_count?: number } };
};

/** Normalise les horodatages Graph (`+0000`) en ISO strict. */
function toIso(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const time = Date.parse(value);
  return Number.isNaN(time) ? fallback : new Date(time).toISOString();
}

export function mediaToCommentedPost(media: MetaIgMediaLite): IngestedPost {
  return {
    externalId: media.id,
    permalink: media.permalink ?? null,
    excerpt: excerptOf(media.caption ?? "", 120),
    // Une vidéo n'a pas de `media_url` affichable : sa vignette la remplace.
    thumbnailUrl: media.thumbnail_url ?? media.media_url ?? null,
    publishedAt: media.timestamp ? toIso(media.timestamp, media.timestamp) : null,
  };
}

export function pagePostToCommentedPost(post: MetaPagePostLite): IngestedPost {
  return {
    externalId: post.id,
    permalink: post.permalink_url ?? null,
    excerpt: excerptOf(post.message ?? "", 120),
    thumbnailUrl: post.full_picture ?? null,
    publishedAt: post.created_time
      ? toIso(post.created_time, post.created_time)
      : null,
  };
}

type BrandIdentity = {
  /** Identifiant Graph du compte connecté — IG user id ou Page id. */
  externalId: string;
  /** Nom d'utilisateur Instagram, second critère quand `from` est absent. */
  username?: string | null;
};

function isBrand(author: MetaCommentAuthor | undefined, username: string | undefined, brand: BrandIdentity): boolean {
  if (author?.id && author.id === brand.externalId) return true;
  const handle = username ?? author?.username;
  return Boolean(
    handle && brand.username && handle.toLowerCase() === brand.username.toLowerCase(),
  );
}

function byDate(a: IngestedMessage, b: IngestedMessage): number {
  return Date.parse(a.sentAt) - Date.parse(b.sentAt);
}

/** Le premier auteur qui n'est pas la marque donne son nom au fil. */
function toThread(options: {
  channel: "instagram" | "facebook";
  externalThreadId: string;
  post: IngestedPost;
  messages: IngestedMessage[];
}): IngestedThread | null {
  const participant = options.messages.find((message) => !message.fromBrand);
  if (!participant) return null;

  return {
    channel: options.channel,
    kind: "comment",
    externalThreadId: options.externalThreadId,
    participantExternalId: participant.authorExternalId,
    participantHandle: participant.authorHandle,
    participantAvatarUrl: null,
    post: options.post,
    messages: [...options.messages].sort(byDate),
  };
}

/**
 * Les commentaires d'un média Instagram, en fils.
 *
 * Graph rend les commentaires de tête avec leurs réponses imbriquées ; chaque
 * commentaire de tête devient une conversation, même quand il vient de la
 * marque — un client qui répond sous le commentaire de la marque doit
 * remonter.
 */
export function igCommentsToThreads(options: {
  media: MetaIgMediaLite;
  comments: MetaIgCommentRow[];
  brand: BrandIdentity;
}): IngestedThread[] {
  const post = mediaToCommentedPost(options.media);

  const threads: IngestedThread[] = [];
  for (const comment of options.comments) {
    const rows = [comment, ...(comment.replies?.data ?? [])];
    const messages = rows.map((row): IngestedMessage => {
      const fromBrand = isBrand(row.from, row.username, options.brand);
      return {
        externalId: row.id,
        authorExternalId: row.from?.id ?? null,
        authorHandle: row.username ?? row.from?.username ?? null,
        body: row.text ?? "",
        fromBrand,
        sentAt: toIso(row.timestamp, post.publishedAt ?? new Date(0).toISOString()),
      };
    });

    const thread = toThread({
      channel: "instagram",
      externalThreadId: comment.id,
      post,
      messages,
    });
    if (thread) threads.push(thread);
  }

  return threads;
}

/**
 * Les commentaires d'un post de Page, en fils.
 *
 * `filter=stream` rend tout à plat : les réponses se rattachent par `parent`.
 * Une réponse dont le commentaire de tête a disparu garde l'identifiant du
 * parent comme clé de fil — stable, même sans le message d'origine.
 */
export function pageCommentsToThreads(options: {
  post: MetaPagePostLite;
  comments: MetaPageCommentRow[];
  brand: BrandIdentity;
}): IngestedThread[] {
  const post = pagePostToCommentedPost(options.post);

  const byThread = new Map<string, IngestedMessage[]>();
  for (const row of options.comments) {
    const threadId = row.parent?.id ?? row.id;
    const messages = byThread.get(threadId) ?? [];
    messages.push({
      externalId: row.id,
      authorExternalId: row.from?.id ?? null,
      // Facebook masque l'auteur quand sa confidentialité l'exige : le fil
      // s'affiche alors « Inconnu », ce qui est la vérité.
      authorHandle: row.from?.name ?? null,
      body: row.message ?? "",
      fromBrand: isBrand(row.from, undefined, options.brand),
      sentAt: toIso(row.created_time, post.publishedAt ?? new Date(0).toISOString()),
    });
    byThread.set(threadId, messages);
  }

  const threads: IngestedThread[] = [];
  for (const [threadId, messages] of byThread) {
    const thread = toThread({
      channel: "facebook",
      externalThreadId: threadId,
      post,
      messages,
    });
    if (thread) threads.push(thread);
  }

  return threads;
}
