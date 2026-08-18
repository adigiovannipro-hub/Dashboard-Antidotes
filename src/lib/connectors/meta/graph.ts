import "server-only";

import { GRAPH_API, MetaError } from "@/lib/social/meta";
import type {
  MetaIgCommentRow,
  MetaIgMediaLite,
  MetaPageCommentRow,
  MetaPagePostLite,
} from "./comments";
import type { MetaInsightRow } from "./mapping";
import type {
  MetaInsightsField,
  MetaMediaRow,
  MetaPagePostRow,
} from "./organic";

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

/**
 * Combien de publications au plus voient leurs statistiques redemandées une
 * par une, en un passage.
 *
 * Le rattrapage initial couvre douze mois : sans plafond, une Page active
 * déclencherait des centaines d'appels d'un coup et se ferait plafonner par
 * Meta — perdant du même geste les statistiques déjà récupérées. Les
 * publications arrivent des plus récentes aux plus anciennes : ce sont donc
 * les plus utiles qui passent en premier, et le reste se complète au passage
 * suivant.
 */
const MAX_INSIGHT_RECOVERIES = 150;

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
 * Les statistiques d'une publication, demandées **une par une**.
 *
 * L'expansion `insights.metric(...)` dans le listing économise les appels,
 * mais Meta la refuse en bloc dès qu'une seule métrique ne s'applique pas au
 * type d'un seul média — et le listing revient alors entier sans la moindre
 * statistique. C'était la cause des colonnes à zéro : impressions et portée
 * vides pendant que les compteurs publics, eux, remontaient.
 *
 * Ce repli isole chaque publication : celle qui refuse une métrique ne prive
 * plus les autres des leurs. Un échec individuel rend `null`, jamais zéro —
 * une donnée absente n'est pas une donnée nulle.
 */
export async function fetchPostInsights(options: {
  ids: readonly string[];
  metrics: readonly string[];
  accessToken: string;
}): Promise<Map<string, MetaInsightsField>> {
  const collected = new Map<string, MetaInsightsField>();
  const metric = options.metrics.join(",");

  // Par paquets de dix : assez pour que ce soit rapide, assez peu pour ne pas
  // ouvrir cinquante connexions d'un coup vers Graph.
  for (let start = 0; start < options.ids.length; start += 10) {
    const batch = options.ids.slice(start, start + 10);
    const results = await Promise.all(
      batch.map(async (id) => {
        try {
          const payload = await fetchGraph<MetaInsightsField>(
            buildUrl(`/${id}/insights`, {
              access_token: options.accessToken,
              metric,
            }),
          );
          return [id, payload] as const;
        } catch {
          // Un média qui ne connaît pas ces métriques n'est pas une panne.
          return null;
        }
      }),
    );
    for (const entry of results) {
      if (entry) collected.set(entry[0], entry[1]);
    }
  }

  return collected;
}

/** Vrai quand Graph n'a rendu aucune statistique exploitable. */
function lacksInsights(insights: MetaInsightsField | undefined): boolean {
  return !insights?.data || insights.data.length === 0;
}

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

  const metrics = ["reach", "views", "saved", "shares"];

  let rows: MetaMediaRow[];
  try {
    rows = await fetchWith(`${baseFields},insights.metric(${metrics.join(",")})`);
  } catch (error) {
    if (error instanceof MetaError && error.retryable) throw error;
    rows = await fetchWith(baseFields);
  }

  // Ce que l'expansion n'a pas rendu se redemande média par média.
  const missing = rows
    .filter((row) => lacksInsights(row.insights))
    .map((row) => row.id)
    .slice(0, MAX_INSIGHT_RECOVERIES);
  if (missing.length > 0) {
    const recovered = await fetchPostInsights({
      ids: missing,
      metrics,
      accessToken: options.accessToken,
    });
    for (const row of rows) {
      const insights = recovered.get(row.id);
      if (insights) row.insights = insights;
    }
  }

  return rows;
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
    "id,message,permalink_url,full_picture,created_time,attachments{media_type},shares,comments.summary(true).limit(0),reactions.summary(true).limit(0)";

  const fetchWith = (fields: string) =>
    fetchAllPages<MetaPagePostRow>(
      buildUrl(`/${options.pageId}/published_posts`, {
        access_token: options.accessToken,
        fields,
        since: options.since,
        limit: "50",
      }),
    );

  const metrics = [
    "post_impressions",
    "post_impressions_unique",
    "post_video_views",
  ];

  let rows: MetaPagePostRow[];
  try {
    rows = await fetchWith(`${baseFields},insights.metric(${metrics.join(",")})`);
  } catch (error) {
    if (error instanceof MetaError && error.retryable) throw error;
    rows = await fetchWith(baseFields);
  }

  /* `post_video_views` n'existe pas sur un post photo : Meta refuse alors
     l'expansion entière, et tout le listing revient sans statistiques. On
     redemande donc au poste par poste, avec les métriques que chacun
     accepte — d'abord les trois, puis les deux qui valent pour tout type. */
  const missing = rows
    .filter((row) => lacksInsights(row.insights))
    .map((row) => row.id)
    .slice(0, MAX_INSIGHT_RECOVERIES);
  if (missing.length > 0) {
    const recovered = await fetchPostInsights({
      ids: missing,
      metrics,
      accessToken: options.accessToken,
    });
    const stillMissing = missing.filter((id) => !recovered.has(id));
    if (stillMissing.length > 0) {
      const fallback = await fetchPostInsights({
        ids: stillMissing,
        metrics: ["post_impressions", "post_impressions_unique"],
        accessToken: options.accessToken,
      });
      for (const [id, insights] of fallback) recovered.set(id, insights);
    }
    for (const row of rows) {
      const insights = recovered.get(row.id);
      if (insights) row.insights = insights;
    }
  }

  return rows;
}

// --- Commentaires (Modération) ------------------------------------------------

/**
 * Les médias récents d'un compte Instagram, version légère.
 *
 * La Modération n'a pas besoin des statistiques : uniquement de quoi situer
 * un commentaire (légende, permalien, vignette) et de savoir s'il y a quelque
 * chose à relever (`comments_count`). Même arrêt de pagination borné côté
 * client que le listing complet — le paramètre `since` de Meta est capricieux
 * sur cette arête.
 */
export async function fetchInstagramMediaLite(options: {
  igUserId: string;
  accessToken: string;
  /** Borne basse `YYYY-MM-DD`. */
  since: string;
}): Promise<MetaIgMediaLite[]> {
  const rows: MetaIgMediaLite[] = [];
  let url: string | undefined = buildUrl(`/${options.igUserId}/media`, {
    access_token: options.accessToken,
    fields:
      "id,caption,permalink,media_type,media_product_type,media_url,thumbnail_url,timestamp,comments_count",
    limit: "50",
  });

  for (let page = 0; url && page < MAX_PAGES; page += 1) {
    const payload: PagedPayload<MetaIgMediaLite> =
      await fetchGraph<PagedPayload<MetaIgMediaLite>>(url);
    const items = payload.data ?? [];
    rows.push(...items);

    const oldest = items.at(-1)?.timestamp;
    if (oldest && oldest.slice(0, 10) < options.since) break;
    url = payload.paging?.next;
  }

  return rows.filter(
    (item) => !item.timestamp || item.timestamp.slice(0, 10) >= options.since,
  );
}

/** Les posts récents d'une Page, version légère — même logique. */
export async function fetchPagePostsLite(options: {
  pageId: string;
  accessToken: string;
  /** Secondes Unix, le format que `/published_posts` accepte. */
  since: string;
}): Promise<MetaPagePostLite[]> {
  return fetchAllPages<MetaPagePostLite>(
    buildUrl(`/${options.pageId}/published_posts`, {
      access_token: options.accessToken,
      fields:
        "id,message,permalink_url,full_picture,created_time,comments.summary(true).limit(0)",
      since: options.since,
      limit: "50",
    }),
  );
}

/**
 * Les commentaires d'un média Instagram, réponses imbriquées comprises.
 *
 * Graph rend les commentaires de tête ; les réponses viennent par l'expansion
 * `replies{...}` — un seul appel par média, et un média n'en subit un que si
 * `comments_count` dit qu'il y a quelque chose à lire.
 */
export async function fetchInstagramComments(options: {
  mediaId: string;
  accessToken: string;
}): Promise<MetaIgCommentRow[]> {
  return fetchAllPages<MetaIgCommentRow>(
    buildUrl(`/${options.mediaId}/comments`, {
      access_token: options.accessToken,
      fields:
        "id,text,timestamp,username,from{id,username},replies{id,text,timestamp,username,from{id,username}}",
      limit: "50",
    }),
  );
}

/**
 * Les commentaires d'un post de Page, à plat.
 *
 * `filter=stream` déplie les réponses dans le même flux, rattachées par
 * `parent` — c'est `pageCommentsToThreads` qui regroupe.
 */
export async function fetchPageComments(options: {
  postId: string;
  accessToken: string;
}): Promise<MetaPageCommentRow[]> {
  return fetchAllPages<MetaPageCommentRow>(
    buildUrl(`/${options.postId}/comments`, {
      access_token: options.accessToken,
      filter: "stream",
      fields: "id,message,created_time,from{id,name},parent{id}",
      limit: "100",
    }),
  );
}

/**
 * Publie une réponse sous un commentaire. Rend l'identifiant du commentaire
 * créé — la preuve, stockée sur le message sortant.
 *
 * Le jeton part dans le **corps** de la requête, jamais dans l'URL : une URL
 * se retrouve dans les journaux d'erreur, un corps non.
 */
async function postGraph<T>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const response = await fetch(`${GRAPH_API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
    cache: "no-store",
  });
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

/** Réponse à un commentaire Instagram — `instagram_manage_comments` requise. */
export async function replyToInstagramComment(options: {
  commentId: string;
  message: string;
  accessToken: string;
}): Promise<{ id: string }> {
  return postGraph<{ id: string }>(`/${options.commentId}/replies`, {
    access_token: options.accessToken,
    message: options.message,
  });
}

/** Réponse à un commentaire de Page — `pages_manage_engagement` requise. */
export async function replyToPageComment(options: {
  commentId: string;
  message: string;
  accessToken: string;
}): Promise<{ id: string }> {
  return postGraph<{ id: string }>(`/${options.commentId}/comments`, {
    access_token: options.accessToken,
    message: options.message,
  });
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
