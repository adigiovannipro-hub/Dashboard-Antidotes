import "server-only";

import { composioClient } from "@/lib/composio/agency";
import {
  creatorOf,
  directPostInfo,
  TIKTOK_CAPTION_MAX,
  tiktokSettingsIssue,
  type TiktokCreator,
  type TiktokPostSettings,
} from "./tiktok-settings";
import {
  draftStateOf,
  isUnauditedRefusal,
  TiktokApiError,
  tiktokErrorText,
  type TiktokDraftState,
} from "./tiktok-status";

/**
 * Publier sur TikTok — en direct quand c'est possible, en brouillon sinon.
 *
 * **En direct** (`/v2/post/publish/video/init/`) : la vidéo part sur le
 * compte avec sa légende et les réglages choisis dans le panneau de la
 * publication (`tiktok-settings.ts`). TikTok n'accepte une publication
 * publique que d'une app **auditée** ; tant que l'app « Antidotes » ne l'est
 * pas, il répond `unaudited_client_can_only_post_to_private_accounts`, et on
 * repasse aussitôt en brouillon. Le jour où l'audit passe, ce refus disparaît
 * et la publication directe démarre d'elle-même, sans toucher au code.
 *
 * **En brouillon** (`/v2/post/publish/inbox/video/init/`) : la vidéo atterrit
 * dans la boîte de l'application TikTok du compte, et une personne appuie sur
 * « publier ». La légende ne voyage pas — l'API brouillon n'en prend aucune.
 * C'est aussi la voie d'une publication sans réglages enregistrés.
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
  const code = payload.error?.code ?? null;
  if (Number(response.status ?? 0) >= 400 || (code && code !== "ok")) {
    throw new TiktokApiError(
      tiktokErrorText(code ?? undefined, payload.error?.message || `HTTP ${response.status}`),
      code,
    );
  }
  return payload.data ?? {};
}

/** Le compte, et ce qu'il autorise — à afficher avant de publier, à vérifier au moment de le faire. */
export async function fetchTiktokCreator(connectedAccountId: string): Promise<TiktokCreator> {
  return creatorOf(await tiktokPost(connectedAccountId, "/v2/post/publish/creator_info/query/", {}));
}

async function initAndUpload(
  connectedAccountId: string,
  path: string,
  extra: Record<string, unknown>,
  video: Buffer,
  contentType: string,
): Promise<string> {
  const size = video.byteLength;
  if (size > SINGLE_CHUNK_MAX) {
    throw new Error("vidéo au-delà de 64 Mo — la recompresser avant de la déposer");
  }

  const init = await tiktokPost(connectedAccountId, path, {
    ...extra,
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
      "Content-Type": contentType,
      "Content-Range": `bytes 0-${size - 1}/${size}`,
    },
    body: new Uint8Array(video),
  });
  if (!put.ok) {
    throw new Error(`TikTok a refusé le fichier (${put.status} ${await put.text().catch(() => "")})`.trim());
  }
  return publishId;
}

export type TiktokSent = { mode: "direct" | "draft"; publishId: string };

export async function publishTiktokVideo(options: {
  connectedAccountId: string;
  video: Buffer;
  contentType: string;
  caption: string;
  /** Les réglages du panneau ; sans eux, brouillon. */
  settings: TiktokPostSettings | null;
}): Promise<TiktokSent> {
  const { connectedAccountId, video, contentType, caption, settings } = options;

  if (settings) {
    const issue = tiktokSettingsIssue(settings);
    if (issue) throw new Error(issue);
    if (caption.length > TIKTOK_CAPTION_MAX) {
      throw new Error(`légende au-delà de ${TIKTOK_CAPTION_MAX} caractères pour TikTok`);
    }

    // Relu au moment de publier : un compte peut avoir changé ses réglages
    // depuis que le panneau les a affichés.
    const creator = await fetchTiktokCreator(connectedAccountId);
    // Une confidentialité que le compte ne propose pas (compte privé, app
    // non auditée) ne bloque plus rien : la vidéo part en brouillon.
    if (creator.privacyOptions.includes(settings.privacy)) try {
      const publishId = await initAndUpload(
        connectedAccountId,
        "/v2/post/publish/video/init/",
        { post_info: directPostInfo(settings, creator, caption) },
        video,
        contentType,
      );
      return { mode: "direct", publishId };
    } catch (error) {
      if (!(error instanceof TiktokApiError && isUnauditedRefusal(error.code))) throw error;
      // App pas encore auditée : la vidéo part en brouillon, à finir dans l'application.
    }
  }

  const publishId = await initAndUpload(
    connectedAccountId,
    "/v2/post/publish/inbox/video/init/",
    {},
    video,
    contentType,
  );
  return { mode: "draft", publishId };
}

export async function fetchTiktokDraftState(
  connectedAccountId: string,
  publishId: string,
): Promise<TiktokDraftState> {
  return draftStateOf(
    await tiktokPost(connectedAccountId, "/v2/post/publish/status/fetch/", { publish_id: publishId }),
  );
}

/** Le lien d'une vidéo publiée — le profil quand TikTok ne rend pas d'identifiant sûr. */
export function tiktokPermalink(username: string | null, postId: string | null): string | null {
  if (!username) return null;
  return postId
    ? `https://www.tiktok.com/@${username}/video/${postId}`
    : `https://www.tiktok.com/@${username}`;
}
