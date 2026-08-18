import "server-only";

/**
 * Client YouTube — OAuth Google et API Data v3.
 *
 * Écrit sur `fetch`, comme le client Meta et celui de Gmail : deux appels de
 * lecture et un d'écriture ne justifient pas le SDK Google.
 *
 * **Le jeton se rafraîchit.** Google émet un jeton d'accès d'une heure et un
 * jeton de rafraîchissement permanent ; c'est le second qu'on garde, et
 * l'accès se redemande à chaque passage. D'où le format JSON en base, là où
 * Meta n'a qu'une chaîne — un jeton Meta longue durée vit deux mois.
 *
 * Portée demandée, et pas une de plus : `youtube.force-ssl`, seule à ouvrir
 * la lecture **et** la réponse aux commentaires. `youtube.readonly` ne
 * permettrait pas de répondre, et il faudrait alors les deux.
 */

const OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/youtube/v3";

export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.force-ssl",
];

export class YouTubeError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** Vrai quand rejouer plus tard a une chance d'aboutir — quota, panne. */
    readonly retryable = false,
  ) {
    super(message);
    this.name = "YouTubeError";
  }
}

/** Les identifiants d'application, ou une erreur qui dit quoi renseigner. */
export function googleCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new YouTubeError(
      "GOOGLE_OAUTH_CLIENT_ID et GOOGLE_OAUTH_CLIENT_SECRET sont requis. Voir docs/youtube-connexion.md.",
    );
  }
  return { clientId, clientSecret };
}

export function youtubeConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  );
}

/**
 * URL de consentement.
 *
 * `access_type=offline` **et** `prompt=consent` : sans eux Google ne rend un
 * jeton de rafraîchissement qu'à la toute première autorisation, et
 * rebrancher un compte laisserait une connexion impossible à renouveler.
 */
export function buildConsentUrl(options: {
  redirectUri: string;
  state: string;
}): string {
  const { clientId } = googleCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: options.redirectUri,
    response_type: "code",
    scope: YOUTUBE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: options.state,
  });
  return `${OAUTH_AUTH_URL}?${params.toString()}`;
}

export type GoogleTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
  scopes: string[];
};

async function requestToken(body: URLSearchParams): Promise<GoogleTokens> {
  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new YouTubeError(
      payload.error_description ?? payload.error ?? "Échec de l'échange OAuth.",
      response.status,
      response.status >= 500,
    );
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    // Marge d'une minute : un jeton qui expire pendant l'appel qu'il autorise
    // produit une erreur illisible dans les journaux.
    expiresAt: new Date(
      Date.now() + ((payload.expires_in ?? 3600) - 60) * 1000,
    ).toISOString(),
    scopes: payload.scope?.split(" ") ?? [],
  };
}

export async function exchangeCode(options: {
  code: string;
  redirectUri: string;
}): Promise<GoogleTokens> {
  const { clientId, clientSecret } = googleCredentials();
  return requestToken(
    new URLSearchParams({
      code: options.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: options.redirectUri,
      grant_type: "authorization_code",
    }),
  );
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<GoogleTokens> {
  const { clientId, clientSecret } = googleCredentials();
  const tokens = await requestToken(
    new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  );
  // Un rafraîchissement ne rend pas de nouveau jeton permanent : on garde
  // celui qu'on avait, sinon la connexion se perdrait au premier passage.
  return { ...tokens, refreshToken: tokens.refreshToken ?? refreshToken };
}

// --- API --------------------------------------------------------------------

async function call<T>(
  path: string,
  params: Record<string, string>,
  accessToken: string,
): Promise<T> {
  const url = new URL(`${API}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: { message?: string; errors?: { reason?: string }[] };
  };

  if (!response.ok || payload.error) {
    const reason = payload.error?.errors?.[0]?.reason;
    throw new YouTubeError(
      // La raison compte plus que le message : `quotaExceeded` et
      // `commentsDisabled` demandent des gestes opposés.
      reason
        ? `${payload.error?.message ?? "Appel YouTube refusé"} (${reason})`
        : (payload.error?.message ?? `Appel YouTube refusé (${response.status}).`),
      response.status,
      response.status >= 500 || response.status === 429,
    );
  }

  return payload;
}

export type YouTubeChannel = {
  id: string;
  title: string;
  handle: string | null;
  avatarUrl: string | null;
  description: string | null;
  subscriberCount: number | null;
  videoCount: number | null;
};

/** Les chaînes que le compte Google autorisé administre. */
export async function listChannels(accessToken: string): Promise<YouTubeChannel[]> {
  const payload = await call<{
    items?: {
      id: string;
      snippet?: {
        title?: string;
        description?: string;
        customUrl?: string;
        thumbnails?: Record<string, { url?: string } | undefined>;
      };
      statistics?: { subscriberCount?: string; videoCount?: string };
    }[];
  }>(
    "/channels",
    { part: "snippet,statistics", mine: "true", maxResults: "50" },
    accessToken,
  );

  return (payload.items ?? []).map((item) => ({
    id: item.id,
    title: item.snippet?.title ?? item.id,
    handle: item.snippet?.customUrl ?? null,
    avatarUrl:
      item.snippet?.thumbnails?.medium?.url ??
      item.snippet?.thumbnails?.default?.url ??
      null,
    description: item.snippet?.description ?? null,
    // Les compteurs arrivent en texte : `subscriberCount` peut dépasser
    // l'entier sûr sur une très grosse chaîne, YouTube le rend en chaîne.
    subscriberCount: item.statistics?.subscriberCount
      ? Number(item.statistics.subscriberCount)
      : null,
    videoCount: item.statistics?.videoCount
      ? Number(item.statistics.videoCount)
      : null,
  }));
}

export { call as youtubeCall };
