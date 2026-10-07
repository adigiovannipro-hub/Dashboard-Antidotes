import "server-only";

import { composioClient } from "@/lib/composio/agency";
import { linkedinVersion } from "@/lib/connectors/linkedin/rest";
import { toLittleText } from "./linkedin-text";

/**
 * Publier sur le **profil personnel** d'un client — par le passage HTTP brut
 * de Composio, avec la connexion que le client a faite depuis Connexions
 * (`espace:<id>`, portées `openid profile w_member_social`).
 *
 * Trois formes :
 *
 *   • une image — `/rest/images` ;
 *   • un **document** — `/rest/documents` : c'est le carrousel de LinkedIn,
 *     celui qu'on fait défiler. Un PDF déposé sur la ligne part tel quel ;
 *     plusieurs images sont assemblées en PDF par l'appelant ;
 *   • une vidéo — `/rest/videos`, envoyée par morceaux puis finalisée.
 *
 * Chaque fois : initialiser (l'API rend une adresse d'envoi signée et
 * l'URN du média), pousser les octets nous-mêmes sur cette adresse — elle
 * n'attend aucun jeton, c'est ce que Composio documente aussi —, attendre
 * que LinkedIn ait traité le média (`AVAILABLE`), puis publier
 * (`/rest/posts`). L'identifiant du post arrive dans l'en-tête
 * `x-restli-id`.
 *
 * Écrit sur la documentation — jamais joué contre le vrai service. La
 * première preuve passe par `pnpm publier:essai`.
 */

type ProxyResponse = {
  status?: number | string;
  data?: unknown;
  headers?: Record<string, string>;
};

async function proxy(options: {
  accountId: string;
  method: "GET" | "POST";
  endpoint: string;
  body?: unknown;
  versioned?: boolean;
}): Promise<ProxyResponse> {
  const headers = [
    { in: "header" as const, name: "X-Restli-Protocol-Version", value: "2.0.0" },
    ...(options.versioned === false
      ? []
      : [{ in: "header" as const, name: "LinkedIn-Version", value: linkedinVersion() }]),
    ...(options.body !== undefined
      ? [{ in: "header" as const, name: "Content-Type", value: "application/json" }]
      : []),
  ];
  const response = (await composioClient().tools.proxyExecute({
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

function header(response: ProxyResponse, name: string): string | null {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(response.headers ?? {})) {
    if (key.toLowerCase() === wanted) return value;
  }
  return null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function personUrn(accountId: string): Promise<string> {
  const response = await proxy({
    accountId,
    method: "GET",
    endpoint: "https://api.linkedin.com/v2/userinfo",
    versioned: false,
  });
  const sub = (response.data as { sub?: string } | undefined)?.sub;
  if (!sub) throw new Error("LinkedIn : identifiant du membre introuvable (portée openid manquante ?).");
  return `urn:li:person:${sub}`;
}

/** Pousse des octets sur une adresse d'envoi signée ; rend l'ETag (les vidéos en ont besoin). */
async function putBytes(url: string, bytes: Uint8Array, contentType: string): Promise<string | null> {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: new Uint8Array(bytes),
  });
  if (!response.ok) {
    throw new Error(`LinkedIn a refusé le fichier (${response.status}).`);
  }
  return response.headers.get("etag");
}

type Resource = "images" | "documents" | "videos";

/** Attend que LinkedIn ait fini de traiter le média. */
async function waitAvailable(
  accountId: string,
  resource: Resource,
  urn: string,
  deadline: number,
): Promise<void> {
  for (;;) {
    const response = await proxy({
      accountId,
      method: "GET",
      endpoint: `https://api.linkedin.com/rest/${resource}/${encodeURIComponent(urn)}`,
    });
    const status = (response.data as { status?: string } | undefined)?.status;
    if (status === "AVAILABLE") return;
    if (status === "PROCESSING_FAILED") {
      throw new Error("LinkedIn n'a pas pu traiter le fichier — vérifier son format.");
    }
    if (Date.now() > deadline) {
      throw new Error("LinkedIn n'a pas fini de traiter le fichier dans le délai — réessai au passage suivant.");
    }
    await sleep(3000);
  }
}

async function uploadSimple(
  accountId: string,
  owner: string,
  resource: "images" | "documents",
  bytes: Uint8Array,
  contentType: string,
  deadline: number,
): Promise<string> {
  const init = await proxy({
    accountId,
    method: "POST",
    endpoint: `https://api.linkedin.com/rest/${resource}?action=initializeUpload`,
    body: { initializeUploadRequest: { owner } },
  });
  const value = (init.data as { value?: Record<string, string> } | undefined)?.value ?? {};
  const urn = resource === "images" ? value.image : value.document;
  if (!value.uploadUrl || !urn) throw new Error(`LinkedIn : initialisation de l'envoi sans adresse (${resource}).`);
  await putBytes(value.uploadUrl, bytes, contentType);
  await waitAvailable(accountId, resource, urn, deadline);
  return urn;
}

async function uploadVideo(
  accountId: string,
  owner: string,
  bytes: Uint8Array,
  deadline: number,
): Promise<string> {
  const init = await proxy({
    accountId,
    method: "POST",
    endpoint: "https://api.linkedin.com/rest/videos?action=initializeUpload",
    body: {
      initializeUploadRequest: {
        owner,
        fileSizeBytes: bytes.byteLength,
        uploadCaptions: false,
        uploadThumbnail: false,
      },
    },
  });
  const value = (init.data as {
    value?: {
      video?: string;
      uploadToken?: string;
      uploadInstructions?: { uploadUrl: string; firstByte: number; lastByte: number }[];
    };
  } | undefined)?.value;
  if (!value?.video || !value.uploadInstructions?.length) {
    throw new Error("LinkedIn : initialisation de l'envoi vidéo sans adresse.");
  }

  // Les morceaux partent dans l'ordre : finaliser demande leurs ETag dans
  // ce même ordre.
  const etags: string[] = [];
  for (const part of value.uploadInstructions) {
    const etag = await putBytes(
      part.uploadUrl,
      bytes.subarray(part.firstByte, part.lastByte + 1),
      "application/octet-stream",
    );
    if (!etag) throw new Error("LinkedIn n'a pas rendu d'ETag pour un morceau de la vidéo.");
    etags.push(etag);
  }

  await proxy({
    accountId,
    method: "POST",
    endpoint: "https://api.linkedin.com/rest/videos?action=finalizeUpload",
    body: {
      finalizeUploadRequest: {
        video: value.video,
        uploadToken: value.uploadToken ?? "",
        uploadedPartIds: etags,
      },
    },
  });
  await waitAvailable(accountId, "videos", value.video, deadline);
  return value.video;
}

export type LinkedinMedia =
  | { type: "image"; bytes: Uint8Array; contentType: string }
  | { type: "document"; bytes: Uint8Array; title: string }
  | { type: "video"; bytes: Uint8Array; title: string };

export async function publishLinkedin(options: {
  connectedAccountId: string;
  caption: string;
  media: LinkedinMedia;
  /** Heure limite d'attente du traitement chez LinkedIn — cinq minutes sinon. */
  deadline?: number;
}): Promise<{ externalId: string; permalink: string }> {
  const accountId = options.connectedAccountId;
  const deadline = options.deadline ?? Date.now() + 5 * 60 * 1000;
  const author = await personUrn(accountId);
  const { media } = options;

  const content =
    media.type === "image"
      ? { media: { id: await uploadSimple(accountId, author, "images", media.bytes, media.contentType, deadline) } }
      : media.type === "document"
        ? {
            media: {
              title: media.title,
              id: await uploadSimple(accountId, author, "documents", media.bytes, "application/pdf", deadline),
            },
          }
        : { media: { title: media.title, id: await uploadVideo(accountId, author, media.bytes, deadline) } };

  const response = await proxy({
    accountId,
    method: "POST",
    endpoint: "https://api.linkedin.com/rest/posts",
    body: {
      author,
      commentary: toLittleText(options.caption),
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      content,
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    },
  });

  const postUrn =
    header(response, "x-restli-id") ?? (response.data as { id?: string } | undefined)?.id ?? null;
  if (!postUrn) throw new Error("LinkedIn : publication acceptée sans identifiant de post.");
  return { externalId: postUrn, permalink: `https://www.linkedin.com/feed/update/${postUrn}` };
}
