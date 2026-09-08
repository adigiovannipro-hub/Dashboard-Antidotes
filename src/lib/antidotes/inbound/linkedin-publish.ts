import "server-only";

import { Composio } from "@composio/core";

import { linkedinVersion } from "@/lib/connectors/linkedin/rest";
import { serverEnv } from "@/lib/env";

/**
 * Publier un post sur le profil LinkedIn de l'auteur — par le passage HTTP
 * brut de Composio, comme le Reporting lit les pages : l'autorisation vit
 * chez Composio, aucun jeton ne transite ici.
 *
 * Deux appels : `GET /v2/userinfo` (OpenID) rend l'identifiant du membre,
 * `POST /rest/posts` publie avec `author = urn:li:person:<id>`. Avec un
 * visuel, trois de plus : `initializeUpload`, un PUT binaire sur l'URL
 * rendue (hors API, sans authentification), puis le post avec le média.
 * L'identifiant du post arrive dans l'en-tête `x-restli-id`.
 *
 * Portées requises sur le compte Composio : `openid profile w_member_social`
 * — à vérifier dans la configuration d'authentification, comme il a fallu
 * y ajouter `r_organization_admin` pour les pages. Écrit sur la
 * documentation, jamais joué contre le vrai service.
 */

const TOOLKIT = "linkedin";

let cached: Composio | null = null;

function client(): Composio {
  if (!cached) cached = new Composio({ apiKey: serverEnv("COMPOSIO_API_KEY").COMPOSIO_API_KEY });
  return cached;
}

export function publishAvailability(): string | null {
  return process.env.COMPOSIO_API_KEY?.trim() ? null : "COMPOSIO_API_KEY absente";
}

async function connectedAccountId(): Promise<string> {
  const all = await client().connectedAccounts.list({ toolkitSlugs: [TOOLKIT], statuses: ["ACTIVE"] });
  const active = all.items.filter((item) => !item.isDisabled);
  if (active.length === 0) throw new Error("Aucun compte LinkedIn connecté chez Composio.");
  return active[0]!.id;
}

type ProxyResponse = { status?: number | string; data?: unknown; headers?: Record<string, string> };

async function proxy(options: {
  accountId: string;
  method: "GET" | "POST";
  endpoint: string;
  body?: unknown;
  versioned?: boolean;
}): Promise<ProxyResponse> {
  const headers = [
    { in: "header" as const, name: "X-Restli-Protocol-Version", value: "2.0.0" },
    ...(options.versioned === false ? [] : [{ in: "header" as const, name: "LinkedIn-Version", value: linkedinVersion() }]),
    ...(options.body !== undefined ? [{ in: "header" as const, name: "Content-Type", value: "application/json" }] : []),
  ];
  const response = (await client().tools.proxyExecute({
    endpoint: options.endpoint,
    method: options.method,
    connectedAccountId: options.accountId,
    parameters: headers,
    ...(options.body !== undefined ? { body: options.body } : {}),
  })) as ProxyResponse;
  const status = Number(response.status ?? 0);
  if (status >= 400) {
    const data = response.data as { message?: string; code?: string } | undefined;
    throw new Error(`LinkedIn ${status} ${data?.code ?? ""} ${data?.message ?? ""}`.trim());
  }
  return response;
}

async function personUrn(accountId: string): Promise<string> {
  const response = await proxy({ accountId, method: "GET", endpoint: "https://api.linkedin.com/v2/userinfo", versioned: false });
  const sub = (response.data as { sub?: string } | undefined)?.sub;
  if (!sub) throw new Error("LinkedIn : identifiant du membre introuvable (portée openid manquante ?).");
  return `urn:li:person:${sub}`;
}

async function uploadImage(accountId: string, author: string, bytes: Buffer, fetcher: typeof fetch): Promise<string> {
  const init = await proxy({
    accountId,
    method: "POST",
    endpoint: "https://api.linkedin.com/rest/images?action=initializeUpload",
    body: { initializeUploadRequest: { owner: author } },
  });
  const value = (init.data as { value?: { uploadUrl?: string; image?: string } } | undefined)?.value;
  if (!value?.uploadUrl || !value.image) throw new Error("LinkedIn : initialisation de l'envoi d'image sans URL.");
  const put = await fetcher(value.uploadUrl, { method: "PUT", body: new Uint8Array(bytes), headers: { "Content-Type": "image/jpeg" } });
  if (!put.ok) throw new Error(`LinkedIn : envoi de l'image refusé (${put.status}).`);
  return value.image;
}

export async function publishToLinkedin(options: {
  text: string;
  image?: Buffer | null;
  fetcher?: typeof fetch;
}): Promise<{ postUrn: string; url: string }> {
  const accountId = await connectedAccountId();
  const author = await personUrn(accountId);
  const fetcher = options.fetcher ?? fetch;
  const media = options.image ? await uploadImage(accountId, author, options.image, fetcher) : null;

  const response = await proxy({
    accountId,
    method: "POST",
    endpoint: "https://api.linkedin.com/rest/posts",
    body: {
      author,
      commentary: options.text,
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
      ...(media ? { content: { media: { id: media } } } : {}),
    },
  });
  const headers = response.headers ?? {};
  const postUrn =
    headers["x-restli-id"] ?? headers["X-RestLi-Id"] ?? (response.data as { id?: string } | undefined)?.id ?? null;
  if (!postUrn) throw new Error("LinkedIn : publication acceptée sans identifiant de post.");
  return { postUrn, url: `https://www.linkedin.com/feed/update/${postUrn}` };
}
