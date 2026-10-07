/**
 * Ce que rend l'API Data de YouTube, ramené aux colonnes du Reporting.
 *
 * Pur et testé : aucune requête ici. Un champ absent vaut zéro ou `null`,
 * jamais une exception qui ferait tomber le passage entier.
 *
 * L'API Data rend, par vidéo, les **vues**, les **j'aime** et les
 * **commentaires** — cumulés depuis la mise en ligne. Ni partages, ni
 * enregistrements, ni durée de visionnage : ceux-là vivent dans l'API
 * Analytics, qui demande une autre portée. Les colonnes absentes restent à
 * zéro en base et l'écran ne les montre pas.
 */

export type YouTubeChannelStats = {
  id: string;
  title: string | null;
  handle: string | null;
  avatarUrl: string | null;
  /** `null` quand la chaîne masque son compteur : jamais un zéro inventé. */
  subscribers: number | null;
  videoCount: number | null;
  /** La playlist « Mises en ligne » : c'est elle qui liste les vidéos. */
  uploadsPlaylistId: string | null;
};

export type YouTubeReportingVideo = {
  externalId: string;
  /** ISO 8601. */
  publishedAt: string;
  caption: string | null;
  permalink: string;
  thumbnailUrl: string | null;
  views: number;
  likes: number;
  comments: number;
};

type Json = Record<string, unknown>;

const asObject = (value: unknown): Json =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};

const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

/** YouTube rend ses compteurs en texte : ils peuvent dépasser l'entier sûr. */
const count = (value: unknown): number => {
  const number = typeof value === "string" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) && number > 0 ? number : 0;
};

const countOrNull = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "") return null;
  const number = typeof value === "string" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) ? number : null;
};

function bestThumbnail(thumbnails: unknown): string | null {
  const all = asObject(thumbnails);
  for (const size of ["high", "medium", "standard", "default", "maxres"]) {
    const url = text(asObject(all[size]).url);
    if (url) return url;
  }
  return null;
}

/** `channels.list` (`snippet,statistics,contentDetails`) — la chaîne demandée. */
export function channelStats(payload: unknown, channelId: string): YouTubeChannelStats | null {
  const item = asList(asObject(payload).items)
    .map(asObject)
    .find((entry) => entry.id === channelId);
  if (!item) return null;

  const snippet = asObject(item.snippet);
  const statistics = asObject(item.statistics);
  const uploads = text(
    asObject(asObject(item.contentDetails).relatedPlaylists).uploads,
  );

  return {
    id: channelId,
    title: text(snippet.title),
    handle: text(snippet.customUrl),
    avatarUrl: bestThumbnail(snippet.thumbnails),
    subscribers:
      statistics.hiddenSubscriberCount === true
        ? null
        : countOrNull(statistics.subscriberCount),
    videoCount: countOrNull(statistics.videoCount),
    uploadsPlaylistId: uploads,
  };
}

/**
 * Une page de la playlist des mises en ligne : les identifiants de vidéo,
 * dans l'ordre de YouTube (la plus récente d'abord).
 */
export function uploadsPage(payload: unknown): { videoIds: string[]; nextPageToken: string | null } {
  const body = asObject(payload);
  const videoIds = asList(body.items).flatMap((entry) => {
    const item = asObject(entry);
    const id =
      text(asObject(item.contentDetails).videoId) ??
      text(asObject(asObject(item.snippet).resourceId).videoId);
    return id ? [id] : [];
  });
  return { videoIds, nextPageToken: text(body.nextPageToken) };
}

/**
 * `videos.list` (`snippet,statistics,status`) — les vidéos publiées.
 *
 * Une vidéo **privée** est écartée : personne ne l'a vue, et une vidéo
 * programmée l'est jusqu'à sa date. Une vidéo non répertoriée reste — elle
 * se partage par lien et ses vues sont réelles.
 */
export function reportingVideos(payload: unknown): YouTubeReportingVideo[] {
  return asList(asObject(payload).items).flatMap((entry): YouTubeReportingVideo[] => {
    const video = asObject(entry);
    const id = text(video.id);
    const snippet = asObject(video.snippet);
    const published = text(snippet.publishedAt);
    if (!id || !published || Number.isNaN(Date.parse(published))) return [];
    if (asObject(video.status).privacyStatus === "private") return [];

    const statistics = asObject(video.statistics);
    return [
      {
        externalId: id,
        publishedAt: new Date(published).toISOString(),
        caption: text(snippet.title),
        permalink: `https://www.youtube.com/watch?v=${id}`,
        thumbnailUrl: bestThumbnail(snippet.thumbnails),
        views: count(statistics.viewCount),
        likes: count(statistics.likeCount),
        comments: count(statistics.commentCount),
      },
    ];
  });
}
