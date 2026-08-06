import "server-only";

/**
 * Transport Airwallex : authentification, cache de jeton, appels GET.
 *
 * Extrait du module Reçus au moment où Finance en a eu besoin : deux modules
 * qui parlent au même service avec les mêmes clés n'ont aucune raison de
 * porter chacun leur authentification — deux caches de jeton, deux endroits où
 * corriger le prochain changement d'API. Les endpoints restent chez leurs
 * modules ; ici, seulement la tuyauterie.
 */

export class AirwallexError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "AirwallexError";
  }
}

function credentials() {
  const clientId = process.env.AIRWALLEX_CLIENT_ID;
  const apiKey = process.env.AIRWALLEX_API_KEY;
  if (!clientId || !apiKey) {
    throw new AirwallexError(
      "AIRWALLEX_CLIENT_ID et AIRWALLEX_API_KEY sont requis. Voir docs/recus-setup.md.",
    );
  }
  return { clientId, apiKey };
}

/** Bascule bac à sable : on ne teste pas une chaîne comptable en production. */
function baseUrl(): string {
  return process.env.AIRWALLEX_ENV === "production"
    ? "https://api.airwallex.com"
    : "https://api.sandbox.airwallex.com";
}

/**
 * Jeton d'accès, mis en cache le temps de sa validité.
 *
 * Le cache est au niveau du module : sur un hébergement sans état, chaque
 * instance refera sa propre authentification, ce qui est sans conséquence — le
 * jeton dépend des seules variables d'environnement, jamais d'un utilisateur.
 * Aucune donnée de requête ne doit rejoindre cette variable.
 */
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const { clientId, apiKey } = credentials();
  const response = await fetch(`${baseUrl()}/api/v1/authentication/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-client-id": clientId,
      "x-api-key": apiKey,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new AirwallexError(
      `Authentification Airwallex refusée (${response.status}) — ${detail.slice(0, 200)}`,
      response.status,
      response.status >= 500,
    );
  }

  const payload = (await response.json()) as {
    token: string;
    expires_at?: string;
  };

  cachedToken = {
    value: payload.token,
    // Le jeton vaut trente minutes ; on s'aligne sur la valeur annoncée quand
    // elle est présente, sur une durée prudente sinon.
    expiresAt: payload.expires_at
      ? new Date(payload.expires_at).getTime()
      : Date.now() + 25 * 60 * 1000,
  };
  return cachedToken.value;
}

export async function call<T>(path: string): Promise<T> {
  const token = await getToken();
  const response = await fetch(`${baseUrl()}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    // Jeton périmé plus tôt qu'annoncé : on le jette et on retente une fois.
    cachedToken = null;
    const retryToken = await getToken();
    const retry = await fetch(`${baseUrl()}${path}`, {
      headers: { authorization: `Bearer ${retryToken}` },
    });
    if (!retry.ok) {
      throw new AirwallexError(
        `Airwallex ${retry.status} sur ${path}`,
        retry.status,
        retry.status >= 500,
      );
    }
    return (await retry.json()) as T;
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new AirwallexError(
      `Airwallex ${response.status} sur ${path} — ${detail.slice(0, 300)}`,
      response.status,
      response.status === 429 || response.status >= 500,
    );
  }

  return (await response.json()) as T;
}

/** Vrai si la connexion aboutit — utilisé par les écrans de configuration. */
export async function checkConnection(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    await getToken();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Connexion impossible.",
    };
  }
}
