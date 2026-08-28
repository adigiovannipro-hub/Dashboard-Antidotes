import "server-only";

import { GRAPH_API, MetaError } from "@/lib/social/meta";
import type {
  MetaIgCommentRow,
  MetaIgMediaLite,
  MetaPageCommentRow,
  MetaPagePostLite,
} from "./comments";
import type { MetaConversationRow } from "./messages";
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

  /* Fin 2025, Meta a retiré `post_impressions` et `post_impressions_unique`
     des publications de Page — « not a valid insights metric », vérifié en
     v23 sur une Page vivante. Les demander faisait échouer l'expansion
     entière, que le repli silencieux transformait en zéros partout. Ne reste
     par publication que `post_video_views` (accepté même sur une photo, où
     il vaut 0). */
  const metrics = ["post_video_views"];

  let rows: MetaPagePostRow[];
  try {
    rows = await fetchWith(`${baseFields},insights.metric(${metrics.join(",")})`);
  } catch (error) {
    if (error instanceof MetaError && error.retryable) throw error;
    rows = await fetchWith(baseFields);
  }

  // Si le listing est revenu sans statistiques, on redemande au poste par
  // poste — un refus global ne dit rien d'un post en particulier.
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
 * Le jeton de Page, échangé contre le jeton porté par le branchement.
 *
 * La « nouvelle expérience Pages » refuse les insights à un jeton
 * d'utilisateur — code 190, « un token d'accès de Page est requis » — alors
 * que le même appel passe avec le jeton de la Page. L'échange est gratuit et
 * idempotent : un jeton qui est déjà celui de la Page se le voit rendre.
 * En cas de refus, on rend le jeton d'origine : les champs publics (abonnés,
 * liste des posts) se lisent encore avec lui.
 */
export async function fetchPageAccessToken(options: {
  pageId: string;
  accessToken: string;
}): Promise<string> {
  try {
    const payload = await fetchGraph<{ access_token?: string }>(
      buildUrl(`/${options.pageId}`, {
        access_token: options.accessToken,
        fields: "access_token",
      }),
    );
    return payload.access_token ?? options.accessToken;
  } catch {
    return options.accessToken;
  }
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
      /* `username` **et** `from` : Instagram ne rend `from` que sur les
         comptes que l'app atteint, et `username` sur tous les autres — les
         demander tous les deux est ce qui évite un fil « Inconnu ». */
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
      /* `attachment` : sur Facebook, une réponse en GIF est un commentaire au
         message vide dont tout le contenu est là. `picture` donne l'avatar. */
      fields:
        "id,message,created_time,from{id,name,picture{url}},parent{id},attachment{type,url,title,media{image{src}},target{url}}",
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

// --- Messages privés (Modération) --------------------------------------------

/**
 * Les conversations privées d'une Page — Messenger ou Instagram.
 *
 * **Toujours l'identifiant de la Page**, même pour Instagram : la messagerie
 * d'un compte Instagram professionnel passe par sa Page, avec le jeton de
 * cette Page. C'est `platform` qui distingue les deux boîtes.
 *
 * Les messages sont développés dans le listing : une conversation en rend
 * jusqu'à `messageLimit`, ce qui suffit à afficher un fil et évite un appel
 * par conversation. Les plus récents d'abord, comme Graph les rend.
 */
export async function fetchConversations(options: {
  pageId: string;
  accessToken: string;
  platform: "messenger" | "instagram";
  /** Borne basse `YYYY-MM-DD` : on s'arrête dès qu'une page est plus ancienne. */
  since: string;
  messageLimit?: number;
}): Promise<MetaConversationRow[]> {
  const fields =
    "id,updated_time,participants,messages.limit(" +
    String(options.messageLimit ?? 25) +
    "){id,message,created_time,from,to,attachments{mime_type,name,image_data{url,preview_url},video_data{url,preview_url},file_url}}";

  const rows: MetaConversationRow[] = [];
  let url: string | undefined = buildUrl(`/${options.pageId}/conversations`, {
    access_token: options.accessToken,
    platform: options.platform,
    fields,
    limit: "50",
  });

  for (let page = 0; url && page < MAX_PAGES; page += 1) {
    const payload: PagedPayload<MetaConversationRow> =
      await fetchGraph<PagedPayload<MetaConversationRow>>(url);
    const items = payload.data ?? [];
    rows.push(...items);

    // Le listing est antichronologique : une page entièrement plus ancienne
    // que la borne clôt la pagination.
    const oldest = items.at(-1)?.updated_time;
    if (oldest && oldest.slice(0, 10) < options.since) break;
    url = payload.paging?.next;
  }

  return rows;
}

/**
 * Répond dans une conversation privée.
 *
 * `recipient.id` et non l'identifiant de conversation : l'API de messagerie
 * s'adresse à une personne. La fenêtre de 24 h de Meta s'applique — c'est
 * `response-window.ts` qui la calcule et l'interface qui la montre ; ici, un
 * envoi hors fenêtre revient en erreur Graph, traduite comme les autres.
 */
export async function sendDirectMessage(options: {
  pageId: string;
  recipientId: string;
  message: string;
  accessToken: string;
  /** Étend la fenêtre à 7 jours — prévu pour un opérateur humain. */
  humanAgentTag?: boolean;
}): Promise<{ message_id?: string; id?: string }> {
  const params: Record<string, string> = {
    access_token: options.accessToken,
    recipient: JSON.stringify({ id: options.recipientId }),
    message: JSON.stringify({ text: options.message }),
    messaging_type: options.humanAgentTag ? "MESSAGE_TAG" : "RESPONSE",
  };
  if (options.humanAgentTag) params.tag = "HUMAN_AGENT";

  return postGraph<{ message_id?: string; id?: string }>(
    `/${options.pageId}/messages`,
    params,
  );
}

/**
 * Le pseudo d'un commentaire, redemandé un par un.
 *
 * Le listing ne rend pas toujours l'auteur : Instagram omet `username` et
 * `from` pour certains comptes personnels, et le fil s'affiche alors sans
 * nom. Un appel direct sur le commentaire les rend parfois — quand il ne les
 * rend pas, c'est que Meta les masque, et l'écran doit le dire plutôt que de
 * laisser croire à une panne.
 */
export async function fetchCommentAuthors(options: {
  ids: readonly string[];
  accessToken: string;
}): Promise<Map<string, { handle: string | null; externalId: string | null }>> {
  const found = new Map<string, { handle: string | null; externalId: string | null }>();

  for (let start = 0; start < options.ids.length; start += 10) {
    const batch = options.ids.slice(start, start + 10);
    const results = await Promise.all(
      batch.map(async (id) => {
        try {
          const payload = await fetchGraph<{
            username?: string;
            from?: { id?: string; username?: string; name?: string };
          }>(
            buildUrl(`/${id}`, {
              access_token: options.accessToken,
              fields: "username,from{id,username,name}",
            }),
          );
          const handle =
            payload.username ?? payload.from?.username ?? payload.from?.name ?? null;
          if (!handle && !payload.from?.id) return null;
          return [id, { handle, externalId: payload.from?.id ?? null }] as const;
        } catch {
          // Un auteur que Meta refuse de nommer n'est pas une panne.
          return null;
        }
      }),
    );
    for (const entry of results) {
      if (entry) found.set(entry[0], entry[1]);
    }
  }

  return found;
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
