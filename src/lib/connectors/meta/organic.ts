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
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
};

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

  return {
    external_id: media.id,
    published_at: media.timestamp,
    caption: media.caption ?? null,
    permalink: media.permalink ?? null,
    thumbnail_url: media.thumbnail_url ?? media.media_url ?? null,
    reach: insightValue(media.insights, "reach"),
    impressions: insightValue(media.insights, "views"),
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
  shares?: { count?: number };
  comments?: { summary?: { total_count?: number } };
  reactions?: { summary?: { total_count?: number } };
  insights?: MetaInsightsField;
};

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
    reach: insightValue(post.insights, "post_impressions_unique"),
    impressions: insightValue(post.insights, "post_impressions"),
    likes: post.reactions?.summary?.total_count ?? 0,
    comments: post.comments?.summary?.total_count ?? 0,
    saves: 0,
    shares: post.shares?.count ?? 0,
  };
}
