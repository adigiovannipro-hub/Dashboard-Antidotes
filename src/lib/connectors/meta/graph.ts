import "server-only";

import { GRAPH_API, MetaError } from "@/lib/social/meta";
import type { MetaInsightRow } from "./mapping";
import type { MetaMediaRow, MetaPagePostRow } from "./organic";

/**
 * Les appels Graph du connecteur — Insights publicitaires, médias organiques,
 * abonnés. La traduction des réponses vit dans `mapping.ts` et `organic.ts` ;
 * ici, uniquement le transport : URL, pagination, erreurs.
 *
 * Deux règles de transport :
 *
 *   • **suivre `paging.next` tel quel** — c'est une URL complète signée par
 *     Meta, la reconstruire ferait dériver les curseurs ;
 *   • **ne jamais mettre l'URL dans une erreur** — elle porte le jeton.
 */

type GraphErrorPayload = {
  error?: { message?: string; code?: number };
};

type PagedPayload<T> = GraphErrorPayload & {
  data?: T[];
  paging?: { next?: string };
};

/** Garde-fou : au-delà, on considère que la pagination boucle. */
const MAX_PAGES = 60;

async function fetchGraph<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json().catch(() => ({}))) as T &
    GraphErrorPayload;

  if (!response.ok || payload.error) {
    throw new MetaError(
      payload.error?.message ?? `Appel Meta refusé (${response.status}).`,
      response.status,
      response.status >= 500 || response.status === 429,
    );
  }

  return payload;
}

/** Toutes les pages d'un listing Graph, dans l'ordre où Meta les rend. */
async function fetchAllPages<T>(firstUrl: string): Promise<T[]> {
  const rows: T[] = [];
  let url: string | undefined = firstUrl;

  for (let page = 0; url && page < MAX_PAGES; page += 1) {
    const payload: PagedPayload<T> = await fetchGraph<PagedPayload<T>>(url);
    rows.push(...(payload.data ?? []));
    url = payload.paging?.next;
  }

  return rows;
}

function buildUrl(path: string, params: Record<string, string>): string {
  const url = new URL(`${GRAPH_API}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

// --- Publicitaire -------------------------------------------------------------

/**
 * Les Insights d'un compte publicitaire, au grain jour × ad set.
 *
 * `time_increment=1` déplie la période en jours : c'est ce grain qui permet à
 * la base de répondre à n'importe quelle plage ensuite, sans rappeler Meta.
 */
export async function fetchAdInsights(options: {
  adAccountId: string;
  accessToken: string;
  since: string;
  until: string;
}): Promise<MetaInsightRow[]> {
  return fetchAllPages<MetaInsightRow>(
    buildUrl(`/${options.adAccountId}/insights`, {
      access_token: options.accessToken,
      level: "adset",
      time_increment: "1",
      time_range: JSON.stringify({ since: options.since, until: options.until }),
      fields:
        "adset_id,adset_name,campaign_id,campaign_name,spend,impressions,reach,clicks,inline_link_clicks,actions,action_values",
      limit: "200",
    }),
  );
}

/**
 * Les mêmes Insights ventilés — âge × genre en un appel, région dans l'autre.
 *
 * Niveau compte : le Persona répond « qui a vu les campagnes », pas « qui a vu
 * tel ad set ». L'agrégation des cellules âge × genre vers chaque axe se fait
 * dans `aggregateBreakdown`.
 */
export async function fetchAdBreakdowns(options: {
  adAccountId: string;
  accessToken: string;
  since: string;
  until: string;
  breakdowns: "age,gender" | "region";
}): Promise<MetaInsightRow[]> {
  return fetchAllPages<MetaInsightRow>(
    buildUrl(`/${options.adAccountId}/insights`, {
      access_token: options.accessToken,
      level: "account",
      time_increment: "1",
      time_range: JSON.stringify({ since: options.since, until: options.until }),
      breakdowns: options.breakdowns,
      fields: "spend,impressions,clicks",
      limit: "200",
    }),
  );
}

// --- Organique ----------------------------------------------------------------

/**
 * Les derniers médias d'un compte Instagram, statistiques comprises.
 *
 * L'expansion `insights.metric(...)` évite un appel par média. Certains types
 * de média ne connaissent pas toutes les métriques et Meta peut alors refuser
 * la requête entière : dans ce cas on retombe sur les médias **sans**
 * insights — les compteurs publics (likes, commentaires) restent, et une ligne
 * incomplète vaut mieux qu'un écran vide.
 *
 * Pas de `since` côté Meta : le listing des médias est déjà antichronologique
 * et le paramètre s'est montré capricieux sur cette arête. On pagine et on
 * s'arrête soi-même dès qu'une page ne contient plus rien d'assez récent.
 */
export async function fetchInstagramMedia(options: {
  igUserId: string;
  accessToken: string;
  /** Borne basse `YYYY-MM-DD` — on remonte le fil jusqu'à elle. */
  since: string;
}): Promise<MetaMediaRow[]> {
  const baseFields =
    "id,caption,permalink,media_type,media_product_type,media_url,thumbnail_url,timestamp,like_count,comments_count";

  const fetchWith = async (fields: string): Promise<MetaMediaRow[]> => {
    const rows: MetaMediaRow[] = [];
    let url: string | undefined = buildUrl(`/${options.igUserId}/media`, {
      access_token: options.accessToken,
      fields,
      limit: "50",
    });

    for (let page = 0; url && page < MAX_PAGES; page += 1) {
      const payload: PagedPayload<MetaMediaRow> =
        await fetchGraph<PagedPayload<MetaMediaRow>>(url);
      const items = payload.data ?? [];
      rows.push(...items);

      const oldest = items.at(-1)?.timestamp;
      if (oldest && oldest.slice(0, 10) < options.since) break;
      url = payload.paging?.next;
    }

    return rows.filter(
      (item) => !item.timestamp || item.timestamp.slice(0, 10) >= options.since,
    );
  };

  try {
    return await fetchWith(
      `${baseFields},insights.metric(reach,views,saved,shares)`,
    );
  } catch (error) {
    if (error instanceof MetaError && error.retryable) throw error;
    return fetchWith(baseFields);
  }
}

/**
 * Les derniers posts publiés d'une Page, même mécanique de repli.
 *
 * `/published_posts` et non `/feed` : le feed mêle les posts de visiteurs à
 * ceux de la marque, et un reporting qui compte les messages des clients
 * comme des publications mentirait. L'arête demande
 * `pages_read_user_content` — dans les portées, accordée en accès standard
 * aux comptes ayant un rôle dans l'app.
 */
export async function fetchPagePosts(options: {
  pageId: string;
  accessToken: string;
  since: string;
}): Promise<MetaPagePostRow[]> {
  const baseFields =
    "id,message,permalink_url,full_picture,created_time,shares,comments.summary(true).limit(0),reactions.summary(true).limit(0)";

  const fetchWith = (fields: string) =>
    fetchAllPages<MetaPagePostRow>(
      buildUrl(`/${options.pageId}/published_posts`, {
        access_token: options.accessToken,
        fields,
        since: options.since,
        limit: "50",
      }),
    );

  try {
    return await fetchWith(
      `${baseFields},insights.metric(post_impressions,post_impressions_unique)`,
    );
  } catch (error) {
    if (error instanceof MetaError && error.retryable) throw error;
    return fetchWith(baseFields);
  }
}

/**
 * Le nombre d'abonnés du jour — la seule mémoire longue est notre table :
 * Meta ne garde que ~30 jours d'historique, chaque passage quotidien ajoute
 * donc un point que plus personne ne pourra redemander plus tard.
 */
export async function fetchFollowersCount(options: {
  nodeId: string;
  accessToken: string;
}): Promise<number | null> {
  const payload = await fetchGraph<{ followers_count?: number }>(
    buildUrl(`/${options.nodeId}`, {
      access_token: options.accessToken,
      fields: "followers_count",
    }),
  );
  return payload.followers_count ?? null;
}
