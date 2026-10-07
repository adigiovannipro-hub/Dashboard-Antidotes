/**
 * Ce que rendent X et TikTok, ramené aux colonnes du Reporting.
 *
 * Pur et testé : aucune requête ici, seulement la lecture de charges utiles
 * dont la forme n'est pas garantie — un champ absent vaut zéro ou `null`,
 * jamais une exception qui ferait tomber le passage entier.
 *
 * Deux sources, deux chemins :
 *
 *   • **TikTok** — les outils emballés de Composio (`TIKTOK_GET_USER_STATS`,
 *     `TIKTOK_LIST_VIDEOS`), qui enveloppent la Display API : la réponse de
 *     TikTok arrive sous `data`, son verdict sous `error.code` ;
 *   • **X** — l'API v2 en passage brut (`/2/users/me`,
 *     `/2/users/:id/tweets`) : aucun outil emballé ne rend le fil d'un
 *     compte avec ses mesures.
 */

export type ClientProfile = {
  externalId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  biography: string | null;
  followers: number | null;
  mediaCount: number | null;
};

export type ClientPost = {
  externalId: string;
  /** ISO 8601. */
  publishedAt: string;
  caption: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  mediaKind: "image" | "carousel" | "video";
  impressions: number;
  videoViews: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
};

type Json = Record<string, unknown>;

const asObject = (value: unknown): Json =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};

const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const count = (value: unknown): number => {
  const number = typeof value === "string" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) && number > 0 ? number : 0;
};

const countOrNull = (value: unknown): number | null => {
  const number = typeof value === "string" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) ? number : null;
};

/* -------------------------------------------------------------------------- */
/*                                   TikTok                                   */
/* -------------------------------------------------------------------------- */

/**
 * La réponse de TikTok sous l'enveloppe de Composio — ou la raison du refus.
 *
 * TikTok répond `error.code = "ok"` quand tout va bien : tout autre code est
 * un refus, qu'on rend avec son message plutôt que de lire une liste vide.
 */
export function tiktokPayload(payload: unknown): Json {
  let body = asObject(payload);
  // Une enveloppe de plus (`{ data: { data, error } }`) se descend une fois.
  const nested = asObject(body.data);
  if ("error" in nested && "data" in nested) body = nested;

  const error = asObject(body.error);
  const code = text(error.code);
  if (code && code.toLowerCase() !== "ok") {
    throw new Error(`TikTok ${code} ${text(error.message) ?? ""}`.trim());
  }
  return asObject(body.data);
}

export function tiktokProfile(payload: unknown): ClientProfile | null {
  const user = asObject(tiktokPayload(payload).user);
  const id = text(user.open_id) ?? text(user.union_id);
  if (!id) return null;
  return {
    externalId: id,
    username: text(user.username),
    displayName: text(user.display_name),
    avatarUrl: text(user.avatar_url_100) ?? text(user.avatar_url),
    biography: text(user.bio_description),
    followers: countOrNull(user.follower_count),
    mediaCount: countOrNull(user.video_count),
  };
}

/**
 * Une page de vidéos. `create_time` est en secondes UNIX ; le curseur, lui,
 * en millisecondes — c'est TikTok qui le rend, on ne le fabrique jamais.
 *
 * TikTok rend les vues, les j'aime, les commentaires et les partages ; il ne
 * rend ni la portée ni les enregistrements. Une vidéo TikTok est vue par
 * définition : les vues sont aussi ses vues vidéo.
 */
export function tiktokVideosPage(payload: unknown): {
  posts: ClientPost[];
  cursor: number | null;
  hasMore: boolean;
} {
  const data = tiktokPayload(payload);
  const posts = asList(data.videos).flatMap((entry): ClientPost[] => {
    const video = asObject(entry);
    const id = text(video.id);
    const created = countOrNull(video.create_time);
    if (!id || created === null) return [];
    const views = count(video.view_count);
    return [
      {
        externalId: id,
        publishedAt: new Date(created * 1000).toISOString(),
        caption: text(video.video_description) ?? text(video.title),
        permalink: text(video.share_url),
        thumbnailUrl: text(video.cover_image_url),
        mediaKind: "video",
        impressions: views,
        videoViews: views,
        likes: count(video.like_count),
        comments: count(video.comment_count),
        shares: count(video.share_count),
        saves: 0,
      },
    ];
  });

  return {
    posts,
    cursor: countOrNull(data.cursor),
    hasMore: data.has_more === true,
  };
}

/* -------------------------------------------------------------------------- */
/*                                      X                                     */
/* -------------------------------------------------------------------------- */

/** X porte ses refus dans `errors` ou `title`/`detail`, même sur un 200. */
function xPayload(payload: unknown): Json {
  const body = asObject(payload);
  if (!("data" in body)) {
    const first = asObject(asList(body.errors)[0]);
    const reason =
      text(body.detail) ?? text(first.detail) ?? text(first.message) ?? text(body.title);
    if (reason) throw new Error(`X : ${reason}`);
  }
  return body;
}

export function xProfile(payload: unknown): ClientProfile | null {
  const user = asObject(xPayload(payload).data);
  const id = text(user.id);
  if (!id) return null;
  const metrics = asObject(user.public_metrics);
  return {
    externalId: id,
    username: text(user.username),
    displayName: text(user.name),
    // `_normal` est une vignette de 48 px : la version pleine se lit mieux.
    avatarUrl: text(user.profile_image_url)?.replace("_normal.", "_400x400.") ?? null,
    biography: text(user.description),
    followers: countOrNull(metrics.followers_count),
    mediaCount: countOrNull(metrics.tweet_count),
  };
}

/**
 * Une page du fil d'un compte. Les mesures viennent de `public_metrics` —
 * `impression_count` compris, rendu au propriétaire du compte.
 *
 * Partages = reposts + citations : les deux remettent la publication devant
 * une autre audience. Enregistrements = signets (`bookmark_count`).
 */
export function xTweetsPage(
  payload: unknown,
  username: string | null,
): { posts: ClientPost[]; nextToken: string | null } {
  const body = xPayload(payload);
  const media = new Map<string, Json>();
  for (const entry of asList(asObject(body.includes).media)) {
    const item = asObject(entry);
    const key = text(item.media_key);
    if (key) media.set(key, item);
  }

  const posts = asList(body.data).flatMap((entry): ClientPost[] => {
    const tweet = asObject(entry);
    const id = text(tweet.id);
    const created = text(tweet.created_at);
    if (!id || !created) return [];
    const metrics = asObject(tweet.public_metrics);
    const attached = asList(asObject(tweet.attachments).media_keys)
      .map((key) => media.get(String(key)))
      .filter((item): item is Json => item !== undefined);
    const first = attached[0];
    const isVideo = attached.some((item) => item.type === "video" || item.type === "animated_gif");
    const videoViews = attached.reduce(
      (total, item) => total + count(asObject(item.public_metrics).view_count),
      0,
    );

    return [
      {
        externalId: id,
        publishedAt: new Date(created).toISOString(),
        caption: text(tweet.text),
        permalink: `https://x.com/${username ?? "i"}/status/${id}`,
        thumbnailUrl: first ? (text(first.preview_image_url) ?? text(first.url)) : null,
        mediaKind: isVideo ? "video" : attached.length > 1 ? "carousel" : "image",
        impressions: count(metrics.impression_count),
        videoViews: isVideo ? videoViews : 0,
        likes: count(metrics.like_count),
        comments: count(metrics.reply_count),
        shares: count(metrics.retweet_count) + count(metrics.quote_count),
        saves: count(metrics.bookmark_count),
      },
    ];
  });

  return { posts, nextToken: text(asObject(body.meta).next_token) };
}
