import "server-only";

import { metaGraphVersion } from "@/lib/env";

/**
 * Client Meta — Facebook Login, Pages, comptes Instagram Professionnels.
 *
 * Écrit sur `fetch`, comme le client Gmail des Reçus : quelques appels, et le
 * SDK officiel pèserait plus lourd que tout le module.
 *
 * Le branchement se fait **une fois** et rend trois choses d'un coup : les
 * Pages du client, le compte Instagram rattaché à chaque Page, et les comptes
 * publicitaires. C'est ce qui permet au planning et au Reporting de partager
 * la même connexion au lieu d'en demander deux.
 *
 * Portées demandées, et pas une de plus :
 *
 *   • `pages_show_list` — lister les Pages du client ;
 *   • `pages_read_engagement` + `pages_manage_posts` — publier sur la Page ;
 *   • `instagram_basic` — lire le profil et les médias ;
 *   • `instagram_content_publish` — publier sur Instagram ;
 *   • `instagram_manage_insights` — les chiffres **organiques** d'Instagram :
 *     portée, impressions, vues de profil, démographie des abonnés.
 *     `instagram_basic` ne donne que la vitrine, pas les statistiques ;
 *   • `read_insights` — les mêmes pour la Page Facebook ;
 *   • `ads_read` — lire les campagnes, pour le Reporting. Lecture seule :
 *     Antidotes ne crée ni ne modifie aucune campagne.
 *
 * Ajouter une portée ici ne suffit pas : un jeton déjà obtenu ne la porte
 * pas. Il faut **rebrancher** le compte pour que Meta la redemande.
 *
 * Tout sauf `pages_show_list` passe par l'App Review de Meta. Sans elle, le
 * branchement fonctionne quand même pour un compte dont on est testeur — on
 * lira le profil, on ne publiera pas chez un tiers.
 */

/* Lue à l'import, côté serveur : `META_GRAPH_VERSION` la surcharge sans
   redéploiement, ce dont la bascule des métriques de publication de Page a
   besoin — `views` n'est servie que par les versions récentes de Graph, et la
   même constante sert aussi la Modération et la publication. */
const GRAPH_VERSION = metaGraphVersion();
/** Exporté pour le connecteur Insights — une seule version de Graph partout. */
export const GRAPH_API = `https://graph.facebook.com/${GRAPH_VERSION}`;
const OAUTH_DIALOG = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;

export const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  /* Lire les publications de la Page (`/published_posts`). En **accès
     standard**, la permission fonctionne pour les comptes ayant un rôle dans
     l'app — l'App Review ne sert qu'à l'ouvrir au grand public. Condition :
     elle doit être **ajoutée à l'app dans la console Meta**, sans quoi le
     dialogue la refuse en bloc (« Invalid Scopes ») et toute la connexion
     échoue — vécu une fois. */
  "pages_read_user_content",
  "read_insights",
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_insights",
  /* Répondre aux commentaires depuis la Modération. Comme
     `pages_read_user_content` : accès standard suffisant pour les comptes à
     rôle dans l'app, mais la permission doit être **ajoutée à l'app dans la
     console Meta** avant tout rebranchement, sinon le dialogue refuse tout en
     bloc (« Invalid Scopes »). Les deux vont ensemble : Instagram et Page. */
  "instagram_manage_comments",
  "pages_manage_engagement",
  /* La boîte privée : Messenger et les DM Instagram, lecture et réponse.
     `pages_messaging` couvre les deux transports — la messagerie d'un compte
     Instagram professionnel passe par sa Page — et `instagram_manage_messages`
     ouvre la boîte Instagram elle-même. Mêmes conditions que les précédentes :
     **à ajouter à l'app dans la console Meta** avant tout rebranchement. */
  "pages_messaging",
  "instagram_manage_messages",
  "ads_read",
  "business_management",
];

export class MetaError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** Vrai quand rejouer plus tard a une chance d'aboutir. */
    readonly retryable = false,
  ) {
    super(message);
    this.name = "MetaError";
  }
}

/** Les identifiants d'application, ou une erreur qui dit quoi renseigner. */
export function metaCredentials(): { appId: string; appSecret: string } {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new MetaError(
      "META_APP_ID et META_APP_SECRET sont requis. Voir docs/meta-connexion.md.",
    );
  }
  return { appId, appSecret };
}

export function metaConfigured(): boolean {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

// --- OAuth --------------------------------------------------------------------

export function buildConsentUrl(options: {
  redirectUri: string;
  state: string;
}): string {
  const { appId } = metaCredentials();
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: options.redirectUri,
    state: options.state,
    response_type: "code",
    scope: META_SCOPES.join(","),
  });
  return `${OAUTH_DIALOG}?${params}`;
}

type GraphError = { error?: { message?: string; type?: string; code?: number } };

async function graph<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH_API}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json()) as T & GraphError;

  if (!response.ok || payload.error) {
    throw new MetaError(
      payload.error?.message ?? `Appel Meta refusé (${response.status}).`,
      response.status,
      response.status >= 500 || response.status === 429,
    );
  }

  return payload;
}

export type MetaTokens = {
  accessToken: string;
  /** `null` pour un jeton sans échéance — le cas d'un jeton longue durée. */
  expiresAt: Date | null;
};

/**
 * Le code de retour devient un jeton court, puis un jeton **longue durée**.
 *
 * Les deux temps sont obligatoires : le jeton d'origine vit une heure, et une
 * connexion qui meurt au bout d'une heure ne sert à rien.
 */
export async function exchangeCode(options: {
  code: string;
  redirectUri: string;
}): Promise<MetaTokens> {
  const { appId, appSecret } = metaCredentials();

  const short = await graph<{ access_token: string }>("/oauth/access_token", {
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: options.redirectUri,
    code: options.code,
  });

  const long = await graph<{ access_token: string; expires_in?: number }>(
    "/oauth/access_token",
    {
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: short.access_token,
    },
  );

  return {
    accessToken: long.access_token,
    expiresAt: long.expires_in
      ? new Date(Date.now() + (long.expires_in - 60) * 1000)
      : null,
  };
}

// --- Ce que le branchement rapporte -------------------------------------------

export type MetaPage = {
  id: string;
  name: string;
  /** Jeton **de Page** : c'est lui qui publie, pas celui de l'utilisateur. */
  accessToken: string;
  /** Photo de profil. URL du CDN Meta, **signée et datée** : elle meurt en
      quelques jours et se réécrit à chaque passage du connecteur. */
  pictureUrl: string | null;
  instagram: MetaInstagramAccount | null;
};

export type MetaInstagramAccount = {
  id: string;
  username: string;
  name: string | null;
  profilePictureUrl: string | null;
  biography: string | null;
  followersCount: number | null;
  mediaCount: number | null;
};

export type MetaAdAccount = {
  id: string;
  name: string;
};

/**
 * Les Pages du client et, pour chacune, le compte Instagram rattaché.
 *
 * Une seule requête : `instagram_business_account{...}` est développé dans la
 * même réponse. Faire autrement multiplierait les allers-retours par le nombre
 * de Pages.
 */
export async function listPages(userAccessToken: string): Promise<MetaPage[]> {
  const payload = await graph<{
    data: {
      id: string;
      name: string;
      access_token: string;
      picture?: { data?: { url?: string } };
      instagram_business_account?: {
        id: string;
        username: string;
        name?: string;
        profile_picture_url?: string;
        biography?: string;
        followers_count?: number;
        media_count?: number;
      };
    }[];
  }>("/me/accounts", {
    access_token: userAccessToken,
    fields:
      "id,name,access_token,picture{url},instagram_business_account{id,username,name,profile_picture_url,biography,followers_count,media_count}",
    limit: "100",
  });

  return payload.data.map((page) => ({
    id: page.id,
    name: page.name,
    accessToken: page.access_token,
    pictureUrl: page.picture?.data?.url ?? null,
    instagram: page.instagram_business_account
      ? {
          id: page.instagram_business_account.id,
          username: page.instagram_business_account.username,
          name: page.instagram_business_account.name ?? null,
          profilePictureUrl:
            page.instagram_business_account.profile_picture_url ?? null,
          biography: page.instagram_business_account.biography ?? null,
          followersCount: page.instagram_business_account.followers_count ?? null,
          mediaCount: page.instagram_business_account.media_count ?? null,
        }
      : null,
  }));
}

/**
 * Les comptes publicitaires accessibles.
 *
 * Tolérant à l'échec : `ads_read` peut manquer tant que l'App Review n'est pas
 * passée, et ce n'est pas une raison pour perdre le branchement des Pages —
 * qui, lui, suffit à publier et à prévisualiser.
 */
export async function listAdAccounts(
  userAccessToken: string,
): Promise<MetaAdAccount[]> {
  try {
    const payload = await graph<{ data: { id: string; name: string }[] }>(
      "/me/adaccounts",
      { access_token: userAccessToken, fields: "id,name", limit: "100" },
    );
    return payload.data;
  } catch {
    return [];
  }
}

/**
 * La photo de profil d'une Page, redemandée seule.
 *
 * Même raison que `fetchInstagramProfile` : l'URL rendue au branchement est
 * signée et datée, elle meurt en quelques jours. Le connecteur la réécrit à
 * chaque passage — la fenêtre glissante fait le travail toute seule, comme
 * pour les vignettes LinkedIn.
 */
export async function fetchPagePicture(options: {
  pageId: string;
  accessToken: string;
}): Promise<string | null> {
  const payload = await graph<{ picture?: { data?: { url?: string } } }>(
    `/${options.pageId}`,
    { access_token: options.accessToken, fields: "picture{url}" },
  );
  return payload.picture?.data?.url ?? null;
}

/** Rafraîchit la vitrine d'un compte Instagram — l'en-tête du feed. */
export async function fetchInstagramProfile(options: {
  igUserId: string;
  accessToken: string;
}): Promise<MetaInstagramAccount> {
  const payload = await graph<{
    id: string;
    username: string;
    name?: string;
    profile_picture_url?: string;
    biography?: string;
    followers_count?: number;
    media_count?: number;
  }>(`/${options.igUserId}`, {
    access_token: options.accessToken,
    fields:
      "id,username,name,profile_picture_url,biography,followers_count,media_count",
  });

  return {
    id: payload.id,
    username: payload.username,
    name: payload.name ?? null,
    profilePictureUrl: payload.profile_picture_url ?? null,
    biography: payload.biography ?? null,
    followersCount: payload.followers_count ?? null,
    mediaCount: payload.media_count ?? null,
  };
}
