import "server-only";

import { composioClient } from "@/lib/composio/agency";
import { draftStateOf, tiktokErrorText, type TiktokDraftState } from "./tiktok-status";

/**
 * TikTok en **brouillon** : la vidéo atterrit dans la boîte de l'application
 * TikTok du compte, et c'est une personne qui appuie sur « publier ».
 *
 * Pourquoi pas la publication directe : une app TikTok non auditée ne
 * publie qu'en privé (`SELF_ONLY`), et l'audit prend des semaines. Le
 * brouillon, lui, marche tout de suite — y compris dans le sandbox de l'app
 * « Antidotes », jusqu'à dix comptes. Le jour où l'audit passe, la
 * publication directe ne change que l'appel d'initialisation.
 *
 * L'autorisation vit chez Composio (compte du client, `espace:<id>`) : on
 * passe par son passage brut pour les appels d'API, et on pousse les octets
 * nous-mêmes sur l'adresse d'envoi — signée par TikTok, elle n'attend aucun
 * jeton. `FILE_UPLOAD` et non `PULL_FROM_URL` : tirer depuis une URL exige un
 * domaine vérifié chez TikTok, et nos URL signées sont celles de Supabase.
 *
 * Écrit sur la documentation de la Content Posting API — jamais joué contre
 * le vrai service. La première preuve passe par `pnpm publier:essai`.
 */

const API = "https://open.tiktokapis.com";

/** Un seul morceau suffit jusqu'à 64 Mo ; le bucket plafonne à 50. */
const SINGLE_CHUNK_MAX = 64 * 1024 * 1024;

type ProxyResponse = { status?: number | string; data?: unknown };

async function tiktokPost(
  connectedAccountId: string,
  path: string,
  body: unknown,
): Promise<Record<string, unknown>> {
  const response = (await composioClient().tools.proxyExecute({
    endpoint: `${API}${path}`,
    method: "POST",
    connectedAccountId,
    body,
    parameters: [{ in: "header", name: "Content-Type", value: "application/json; charset=UTF-8" }],
  })) as ProxyResponse;

  const payload = (response.data ?? {}) as {
    data?: Record<string, unknown>;
    error?: { code?: string; message?: string };
  };
  const code = payload.error?.code;
  if (Number(response.status ?? 0) >= 400 || (code && code !== "ok")) {
    throw new Error(tiktokErrorText(code, payload.error?.message || `HTTP ${response.status}`));
  }
  return payload.data ?? {};
}

/** Envoie la vidéo en brouillon ; rend l'identifiant qui permet d'en suivre le sort. */
export async function sendTiktokDraft(options: {
  connectedAccountId: string;
  video: Buffer;
  contentType: string;
}): Promise<{ publishId: string }> {
  const size = options.video.byteLength;
  if (size > SINGLE_CHUNK_MAX) {
    throw new Error("vidéo au-delà de 64 Mo — la recompresser avant de la déposer");
  }

  const init = await tiktokPost(options.connectedAccountId, "/v2/post/publish/inbox/video/init/", {
    source_info: {
      source: "FILE_UPLOAD",
      video_size: size,
      chunk_size: size,
      total_chunk_count: 1,
    },
  });
  const publishId = typeof init.publish_id === "string" ? init.publish_id : null;
  const uploadUrl = typeof init.upload_url === "string" ? init.upload_url : null;
  if (!publishId || !uploadUrl) throw new Error("TikTok n'a pas rendu d'adresse d'envoi.");

  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": options.contentType,
      "Content-Range": `bytes 0-${size - 1}/${size}`,
    },
    body: new Uint8Array(options.video),
  });
  if (!put.ok) {
    throw new Error(`TikTok a refusé le fichier (${put.status} ${await put.text().catch(() => "")})`.trim());
  }

  return { publishId };
}

export async function fetchTiktokDraftState(
  connectedAccountId: string,
  publishId: string,
): Promise<TiktokDraftState> {
  return draftStateOf(
    await tiktokPost(connectedAccountId, "/v2/post/publish/status/fetch/", { publish_id: publishId }),
  );
}
