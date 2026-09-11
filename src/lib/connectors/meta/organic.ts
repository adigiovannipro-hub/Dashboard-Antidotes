/**
 * Traduction de l'organique Meta — médias Instagram et posts de Page — vers
 * les colonnes de `social_posts`. Pure et testée, comme `mapping.ts`.
 *
 * Deux réalités de l'API à connaître :
 *
 *   • les statistiques d'un média se demandent en **expansion de champ**
 *     (`insights.metric(...)`) pour ne payer qu'un appel par page de médias,
 *     et Meta rend alors `{ data: [{ name, values: [{ value }] }] }` — ou
 *     rien du tout quand le média ne connaît pas la métrique. Une story ou un
 *     vieux post sans `views` ne doit pas faire tomber la ligne : absent vaut
 *     zéro ;
 *   • `impressions` est en cours de retrait chez Meta au profit de `views`.
 *     On demande `views` et on le range dans notre colonne `impressions` :
 *     même grandeur — combien de fois le contenu s'est affiché.
 */

import { toNumber } from "./mapping";

/** `{ data: [{ name, values: [{ value }] }] }` tel que Graph le rend. */
export type MetaInsightsField = {
  data?: { name?: string; values?: { value?: number | string }[] }[];
};

/** La valeur d'une métrique d'insights, ou 0 — absente vaut zéro. */
export function insightValue(
  insights: MetaInsightsField | undefined,
  name: string,
): number {
  const metric = insights?.data?.find((entry) => entry.name === name);
  const value = metric?.values?.[0]?.value;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  return toNumber(value);
}

/** Un média Instagram tel que `/{ig-user-id}/media` le rend. */
export type MetaMediaRow = {
  id: string;
  caption?: string;
  permalink?: string;
  media_type?: string;
  media_product_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
  insights?: MetaInsightsField;
};

export type OrganicPostColumns = {
  external_id: string;
  published_at: string;
  caption: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  media_kind: "image" | "carousel" | "video";
  reach: number;
  impressions: number;
  video_views: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
};

/** La nature d'un média Instagram — reel, carrousel, ou image fixe. */
export function mediaKind(media: {
  media_type?: string;
  media_product_type?: string;
}): "image" | "carousel" | "video" {
  if (media.media_product_type === "REELS") return "video";
  if (media.media_type === "VIDEO") return "video";
  if (media.media_type === "CAROUSEL_ALBUM") return "carousel";
  return "image";
}

/**
 * Un média Instagram vers une ligne de `social_posts`.
 *
 * `null` pour un média sans date : sans `published_at`, la ligne ne peut ni
 * se trier ni entrer dans une période — mieux vaut la sauter que d'inventer
 * une date.
 *
 * La vignette d'une vidéo est `thumbnail_url`, celle d'une image `media_url` :
 * Meta ne remplit que l'un des deux selon le type.
 */
export function mediaToPost(media: MetaMediaRow): OrganicPostColumns | null {
  if (!media.timestamp) return null;

  const kind = mediaKind(media);
  // `views` d'un reel **est** sa lecture : Meta a fusionné les deux compteurs.
  const views = insightValue(media.insights, "views");

  return {
    external_id: media.id,
    published_at: media.timestamp,
    caption: media.caption ?? null,
    permalink: media.permalink ?? null,
    thumbnail_url: media.thumbnail_url ?? media.media_url ?? null,
    media_kind: kind,
    reach: insightValue(media.insights, "reach"),
    impressions: views,
    video_views: kind === "video" ? views : 0,
    // Les compteurs publics vivent sur le média même, pas dans les insights.
    likes: media.like_count ?? 0,
    comments: media.comments_count ?? 0,
    saves: insightValue(media.insights, "saved"),
    shares: insightValue(media.insights, "shares"),
  };
}

/** Un post de Page tel que `/{page-id}/published_posts` le rend. */
export type MetaPagePostRow = {
  id: string;
  message?: string;
  permalink_url?: string;
  full_picture?: string;
  created_time?: string;
  /** `photo`, `video`, `album`, `link`… selon la pièce jointe. */
  attachments?: { data?: { media_type?: string }[] };
  shares?: { count?: number };
  comments?: { summary?: { total_count?: number } };
  reactions?: { summary?: { total_count?: number } };
  insights?: MetaInsightsField;
};

/**
 * La nature d'un post de Page, lue sur sa pièce jointe.
 *
 * Facebook ne porte pas de champ « type de média » sur le post : c'est
 * l'attachement qui le dit. Sans lui, tout partait en « Post » et la colonne
 * des vues vidéo restait vide sur des reels bien réels.
 */
export function pagePostKind(
  post: MetaPagePostRow,
): "image" | "carousel" | "video" {
  const type = post.attachments?.data?.[0]?.media_type?.toLowerCase();
  if (type === "video") return "video";
  if (type === "album") return "carousel";
  return "image";
}

/**
 * Un post de Page vers une ligne de `social_posts`.
 *
 * Les réactions tiennent lieu de « likes » : Facebook n'a plus de compteur de
 * likes seul, et distinguer un cœur d'un pouce n'apporte rien au reporting.
 */
export function pagePostToPost(post: MetaPagePostRow): OrganicPostColumns | null {
  if (!post.created_time) return null;

  return {
    external_id: post.id,
    published_at: post.created_time,
    caption: post.message ?? null,
    permalink: post.permalink_url ?? null,
    thumbnail_url: post.full_picture ?? null,
    media_kind: pagePostKind(post),
    reach: insightValue(post.insights, "post_impressions_unique"),
    /* `views` d'abord, `post_impressions` en repli. Meta a déprécié la
       seconde fin 2025 et ne rend plus que la première sur les versions
       récentes — mais l'inverse reste vrai sur les Pages qui n'ont pas
       basculé, et une publication collectée avant la bascule porte encore
       l'ancienne. Prendre le nouveau nom d'abord sans jeter l'ancien évite
       de réécrire à zéro un historique bien réel. */
    impressions:
      insightValue(post.insights, "views") ||
      insightValue(post.insights, "post_impressions"),
    // Facebook compte les lectures à part des impressions — les déduire du
    // type de média donnerait un chiffre inventé.
    video_views: insightValue(post.insights, "post_video_views"),
    likes: post.reactions?.summary?.total_count ?? 0,
    comments: post.comments?.summary?.total_count ?? 0,
    saves: 0,
    shares: post.shares?.count ?? 0,
  };
}

/** `/{page}/insights?period=day` : une métrique, ses valeurs datées. */
export type MetaPageInsightRow = {
  name?: string;
  period?: string;
  values?: { value?: number | string; end_time?: string }[];
};

export type PageDailyColumns = {
  date: string;
  impressions: number;
  reach: number;
  engagements: number;
  video_views: number;
};

/**
 * Ce que chaque métrique de Page alimente dans `social_page_daily`, **par
 * ordre de préférence**.
 *
 * Deux noms alimentent les impressions : `page_media_view`, le nom vivant,
 * et `page_impressions`, que Meta a déprécié. Les deux peuvent répondre pour
 * la même journée — ce sont alors deux rendus de la même grandeur, pas deux
 * parts à additionner. Le premier de la liste qui porte un point pour ce
 * jour-là gagne ; sommer doublerait le chiffre en silence, et rien à
 * l'écran ne le dirait.
 */
const PAGE_METRIC_COLUMNS: Record<string, keyof Omit<PageDailyColumns, "date">> = {
  page_media_view: "impressions",
  page_impressions: "impressions",
  page_impressions_unique: "reach",
  page_post_engagements: "engagements",
  page_video_views: "video_views",
};

export const PAGE_DAILY_METRICS = Object.keys(PAGE_METRIC_COLUMNS);

/** L'inverse : par colonne, les noms qui la nourrissent, préférence d'abord. */
const PAGE_COLUMN_METRICS = Object.entries(PAGE_METRIC_COLUMNS).reduce<
  Partial<Record<keyof Omit<PageDailyColumns, "date">, string[]>>
>((byColumn, [name, column]) => {
  (byColumn[column] ??= []).push(name);
  return byColumn;
}, {});

/**
 * Les Page Insights vers des lignes journalières.
 *
 * Meta rend une série par métrique, chaque valeur portant `end_time` — la
 * **fin** de la journée mesurée, à 07:00 UTC le lendemain. La date du point
 * est donc celle de la veille de `end_time` : un `2026-09-01T07:00:00+0000`
 * décrit le 31 août. Même règle que les abonnés — un relevé porte la date du
 * jour qu'il clôture.
 */
export function pageInsightsToDaily(rows: MetaPageInsightRow[]): PageDailyColumns[] {
  /* Une valeur par (jour, **métrique**), et non par (jour, colonne) : deux
     noms peuvent nourrir la même colonne, et les additionner doublerait la
     journée. Le même nom rendu deux fois pour le même jour — deux tranches
     de 90 jours qui se recouvrent — écrase au lieu de s'ajouter, pour la
     même raison : c'est une seule mesure, rendue deux fois. */
  const byDate = new Map<string, Map<string, number>>();

  for (const row of rows) {
    if (!row.name || !PAGE_METRIC_COLUMNS[row.name]) continue;
    for (const point of row.values ?? []) {
      if (!point.end_time) continue;
      const closed = new Date(Date.parse(point.end_time) - 86_400_000);
      if (Number.isNaN(closed.getTime())) continue;
      const date = closed.toISOString().slice(0, 10);
      const value =
        typeof point.value === "number" ? point.value : toNumber(point.value);
      const metrics = byDate.get(date) ?? new Map<string, number>();
      metrics.set(row.name, Number.isFinite(value) ? value : 0);
      byDate.set(date, metrics);
    }
  }

  return [...byDate.entries()]
    .map(([date, metrics]) => {
      const line: PageDailyColumns = {
        date,
        impressions: 0,
        reach: 0,
        engagements: 0,
        video_views: 0,
      };
      // Premier nom qui porte un point pour ce jour-là, colonne par colonne.
      for (const [column, names] of Object.entries(PAGE_COLUMN_METRICS)) {
        const found = names.find((name) => metrics.has(name));
        if (found === undefined) continue;
        line[column as keyof Omit<PageDailyColumns, "date">] =
          metrics.get(found) ?? 0;
      }
      return line;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
