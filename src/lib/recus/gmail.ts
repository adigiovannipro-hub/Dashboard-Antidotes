import "server-only";

/**
 * Client Gmail.
 *
 * Écrit sur `fetch` plutôt qu'avec `googleapis` : cinq appels sont nécessaires,
 * et la dépendance officielle pèse plus lourd à elle seule que tout le reste du
 * projet réuni.
 *
 * Deux portées OAuth, et pas une de plus :
 *
 *   • `gmail.readonly` pour lire ce qui arrive ;
 *   • `gmail.send` pour transférer la pièce à Airwallex.
 *
 * `gmail.send` n'autorise que l'envoi — elle ne donne aucun droit de modifier
 * ou supprimer quoi que ce soit dans la boîte. `gmail.modify`, plus large,
 * suffirait aussi et permettrait de poser des libellés : elle est écartée
 * volontairement, parce qu'un outil qui range vos mails tout seul est un outil
 * dont les erreurs se voient tard.
 *
 * L'envoi doit partir de l'adresse rattachée au compte Airwallex : leur service
 * rejette un reçu venu d'ailleurs. C'est la raison d'être de `gmail.send` ici —
 * un relais SMTP tiers ne pourrait pas satisfaire cette condition.
 */

const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
];

export class GmailError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /**
     * Vrai quand rejouer plus tard a une chance d'aboutir : quota, panne
     * passagère. Faux quand l'appel est refusé sur le fond — inutile de faire
     * tourner un backoff sur un token révoqué.
     */
    readonly retryable = false,
  ) {
    super(message);
    this.name = "GmailError";
  }
}

// --- OAuth ------------------------------------------------------------------

function oauthCredentials() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new GmailError(
      "GOOGLE_OAUTH_CLIENT_ID et GOOGLE_OAUTH_CLIENT_SECRET sont requis. Voir docs/recus-setup.md.",
    );
  }
  return { clientId, clientSecret };
}

/**
 * URL de consentement.
 *
 * `access_type=offline` et `prompt=consent` sont indispensables : sans eux,
 * Google ne renvoie un refresh token que la toute première fois, et une
 * reconnexion après révocation laisserait une source impossible à rafraîchir.
 */
export function buildConsentUrl(options: {
  redirectUri: string;
  state: string;
}): string {
  const { clientId } = oauthCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: options.redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: options.state,
  });
  return `${OAUTH_AUTH_URL}?${params.toString()}`;
}

export type TokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  scopes: string[];
};

async function requestToken(body: URLSearchParams): Promise<TokenSet> {
  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new GmailError(
      payload.error_description ?? payload.error ?? "Échec de l'échange OAuth.",
      response.status,
      response.status >= 500,
    );
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    // Marge d'une minute : un token qui expire pendant l'appel qu'il autorise
    // produit une erreur difficile à lire dans les journaux.
    expiresAt: new Date(Date.now() + ((payload.expires_in ?? 3600) - 60) * 1000),
    scopes: payload.scope?.split(" ") ?? [],
  };
}

export async function exchangeCode(options: {
  code: string;
  redirectUri: string;
}): Promise<TokenSet> {
  const { clientId, clientSecret } = oauthCredentials();
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

export async function refreshAccessToken(refreshToken: string): Promise<TokenSet> {
  const { clientId, clientSecret } = oauthCredentials();
  return requestToken(
    new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  );
}

// --- Appels API --------------------------------------------------------------

async function call<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${GMAIL_API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new GmailError(
      `Gmail ${response.status} sur ${path} — ${detail.slice(0, 300)}`,
      response.status,
      // 429 : quota. 5xx : panne de leur côté. Les deux se rejouent.
      response.status === 429 || response.status >= 500,
    );
  }

  return (await response.json()) as T;
}

/** Adresse de la boîte connectée — celle qui devra être connue d'Airwallex. */
export async function getConnectedAddress(accessToken: string): Promise<string> {
  const profile = await call<{ emailAddress: string }>(accessToken, "/profile");
  return profile.emailAddress;
}

export type GmailMessageRef = { id: string; threadId: string };

/**
 * Identifiants des messages correspondant à une requête Gmail.
 *
 * On interroge avec la syntaxe de recherche de Gmail plutôt qu'avec l'API
 * `history` : l'historique expire au bout de quelques jours côté Google, et une
 * panne du cron plus longue que cela laisserait un trou silencieux dans la
 * comptabilité. Une requête datée est reprenable indéfiniment.
 */
export async function listMessages(options: {
  accessToken: string;
  query: string;
  maxResults?: number;
}): Promise<GmailMessageRef[]> {
  const found: GmailMessageRef[] = [];
  const limit = options.maxResults ?? 100;
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: options.query,
      maxResults: String(Math.min(100, limit - found.length)),
    });
    if (pageToken) params.set("pageToken", pageToken);

    const page = await call<{
      messages?: GmailMessageRef[];
      nextPageToken?: string;
    }>(options.accessToken, `/messages?${params.toString()}`);

    found.push(...(page.messages ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken && found.length < limit);

  return found.slice(0, limit);
}

type GmailPart = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: GmailPart[];
};

type GmailMessagePayload = {
  id: string;
  threadId: string;
  internalDate?: string;
  snippet?: string;
  payload?: GmailPart;
};

export type GmailAttachment = {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
};

export type GmailMessage = {
  id: string;
  threadId: string;
  receivedAt: Date;
  fromEmail: string;
  fromName: string | null;
  subject: string | null;
  snippet: string;
  text: string;
  html: string | null;
  attachments: GmailAttachment[];
};

export function decodeBase64Url(data: string): Buffer {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function headerValue(part: GmailPart | undefined, name: string): string | null {
  const found = part?.headers?.find(
    (header) => header.name.toLowerCase() === name.toLowerCase(),
  );
  return found?.value ?? null;
}

/** `Antidotes <hello@antidotes.fr>` → nom et adresse séparés. */
export function parseAddress(raw: string | null): {
  email: string;
  name: string | null;
} {
  if (!raw) return { email: "", name: null };

  const angled = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (angled) {
    const name = angled[1]!.replace(/^["']|["']$/g, "").trim();
    return { email: angled[2]!.trim().toLowerCase(), name: name || null };
  }
  return { email: raw.trim().toLowerCase(), name: null };
}

/** Parcourt l'arbre MIME et en tire corps et pièces jointes. */
function walkParts(
  part: GmailPart | undefined,
  accumulator: { text: string[]; html: string[]; attachments: GmailAttachment[] },
): void {
  if (!part) return;

  const filename = part.filename ?? "";
  const attachmentId = part.body?.attachmentId;

  if (filename && attachmentId) {
    accumulator.attachments.push({
      attachmentId,
      filename,
      mimeType: part.mimeType ?? "application/octet-stream",
      size: part.body?.size ?? 0,
    });
  } else if (part.body?.data) {
    const decoded = decodeBase64Url(part.body.data).toString("utf8");
    if (part.mimeType === "text/plain") accumulator.text.push(decoded);
    else if (part.mimeType === "text/html") accumulator.html.push(decoded);
  }

  for (const child of part.parts ?? []) walkParts(child, accumulator);
}

/** Retire les balises d'un corps HTML pour donner au modèle un texte lisible. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function getMessage(
  accessToken: string,
  messageId: string,
): Promise<GmailMessage> {
  const raw = await call<GmailMessagePayload>(
    accessToken,
    `/messages/${messageId}?format=full`,
  );

  const accumulator = { text: [] as string[], html: [] as string[], attachments: [] as GmailAttachment[] };
  walkParts(raw.payload, accumulator);

  const from = parseAddress(headerValue(raw.payload, "From"));
  const html = accumulator.html.join("\n") || null;
  const text = accumulator.text.join("\n").trim() || (html ? htmlToText(html) : "");

  return {
    id: raw.id,
    threadId: raw.threadId,
    receivedAt: new Date(Number(raw.internalDate ?? Date.now())),
    fromEmail: from.email,
    fromName: from.name,
    subject: headerValue(raw.payload, "Subject"),
    snippet: raw.snippet ?? "",
    text,
    html,
    attachments: accumulator.attachments,
  };
}

export async function getAttachment(options: {
  accessToken: string;
  messageId: string;
  attachmentId: string;
}): Promise<Buffer> {
  const payload = await call<{ data: string; size: number }>(
    options.accessToken,
    `/messages/${options.messageId}/attachments/${options.attachmentId}`,
  );
  return decodeBase64Url(payload.data);
}

/** Message brut RFC 822, pour transférer la pièce sans la reconstruire. */
export async function getRawMessage(
  accessToken: string,
  messageId: string,
): Promise<Buffer> {
  const payload = await call<{ raw: string }>(
    accessToken,
    `/messages/${messageId}?format=raw`,
  );
  return decodeBase64Url(payload.raw);
}

/** Envoie un message MIME déjà construit. Renvoie son identifiant Gmail. */
export async function sendMessage(options: {
  accessToken: string;
  mime: string;
  threadId?: string;
}): Promise<string> {
  const body: Record<string, string> = {
    raw: Buffer.from(options.mime, "utf8").toString("base64url"),
  };
  if (options.threadId) body.threadId = options.threadId;

  const sent = await call<{ id: string }>(options.accessToken, "/messages/send", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return sent.id;
}
