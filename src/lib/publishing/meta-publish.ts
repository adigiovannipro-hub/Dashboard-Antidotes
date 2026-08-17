import "server-only";

import { GRAPH_API, MetaError } from "@/lib/social/meta";
import { isVideoPath } from "./readiness";

/**
 * La mécanique de publication chez Meta — Instagram d'abord, Page ensuite.
 *
 * Instagram publie en **deux temps** : un conteneur (`/media`) puis sa
 * publication (`/media_publish`). Entre les deux, Meta télécharge et encode
 * le média — instantané pour une image, de longues secondes pour une vidéo —
 * et le conteneur ne se publie qu'à l'état `FINISHED`. Publier trop tôt rend
 * une erreur, d'où l'attente active. Un conteneur expire au bout de 24 h et
 * le compte est plafonné à 25 publications par 24 h : sans conséquence à
 * notre volume, mais écrit ici pour le jour où ça se verra.
 *
 * Les URL passées à Meta sont les URL **signées** du bucket : Meta télécharge
 * depuis ses serveurs, le fichier ne transite jamais par ici.
 */

type GraphErrorPayload = {
  error?: { message?: string; code?: number };
};

async function graphPost<T>(
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
      payload.error?.message ?? `Publication refusée (${response.status}).`,
      response.status,
      response.status >= 500 || response.status === 429,
    );
  }
  return payload;
}

async function graphGet<T>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const url = new URL(`${GRAPH_API}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json().catch(() => ({}))) as T &
    GraphErrorPayload;
  if (!response.ok || payload.error) {
    throw new MetaError(
      payload.error?.message ?? `Lecture refusée (${response.status}).`,
      response.status,
    );
  }
  return payload;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Attend qu'un conteneur soit prêt. `FINISHED` publie, `ERROR` et `EXPIRED`
 * remontent la cause ; au-delà du délai, on abandonne en le disant plutôt que
 * de bloquer le passage entier.
 */
async function waitForContainer(options: {
  containerId: string;
  accessToken: string;
  timeoutMs?: number;
}): Promise<void> {
  const deadline = Date.now() + (options.timeoutMs ?? 4 * 60 * 1000);

  for (;;) {
    const status = await graphGet<{ status_code?: string }>(
      `/${options.containerId}`,
      { access_token: options.accessToken, fields: "status_code" },
    );

    if (status.status_code === "FINISHED") return;
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
      throw new MetaError(
        `Meta n'a pas pu préparer le média (${status.status_code}). Vérifier le format du fichier.`,
      );
    }
    if (Date.now() > deadline) {
      throw new MetaError(
        "L'encodage du média n'a pas abouti dans le délai — réessayer plus tard.",
        undefined,
        true,
      );
    }
    await sleep(5000);
  }
}

export type PublishedPost = { externalId: string; permalink: string | null };

/**
 * Publie sur Instagram : image seule, vidéo (reel), ou carrousel.
 *
 * Une vidéo seule part en `REELS` : c'est le seul format vidéo que le feed
 * accepte encore — l'ancien type `VIDEO` ne se publie plus hors carrousel.
 * L'ordre du carrousel est l'ordre des visuels sur la ligne du planning,
 * celui que l'agence a posé à la main.
 */
export async function publishInstagram(options: {
  igUserId: string;
  accessToken: string;
  caption: string;
  mediaUrls: string[];
}): Promise<PublishedPost> {
  const { igUserId, accessToken, caption, mediaUrls } = options;

  let containerId: string;

  if (mediaUrls.length === 1) {
    const url = mediaUrls[0]!;
    const container = await graphPost<{ id: string }>(`/${igUserId}/media`, {
      access_token: accessToken,
      caption,
      ...(isVideoPath(url)
        ? { media_type: "REELS", video_url: url }
        : { image_url: url }),
    });
    containerId = container.id;
  } else {
    const children: string[] = [];
    for (const url of mediaUrls) {
      const child = await graphPost<{ id: string }>(`/${igUserId}/media`, {
        access_token: accessToken,
        is_carousel_item: "true",
        ...(isVideoPath(url)
          ? { media_type: "VIDEO", video_url: url }
          : { image_url: url }),
      });
      // Chaque enfant vidéo doit être prêt avant d'assembler le parent.
      if (isVideoPath(url)) {
        await waitForContainer({ containerId: child.id, accessToken });
      }
      children.push(child.id);
    }

    const parent = await graphPost<{ id: string }>(`/${igUserId}/media`, {
      access_token: accessToken,
      media_type: "CAROUSEL",
      children: children.join(","),
      caption,
    });
    containerId = parent.id;
  }

  await waitForContainer({ containerId, accessToken });

  const published = await graphPost<{ id: string }>(
    `/${igUserId}/media_publish`,
    { access_token: accessToken, creation_id: containerId },
  );

  const permalink = await graphGet<{ permalink?: string }>(`/${published.id}`, {
    access_token: accessToken,
    fields: "permalink",
  }).catch(() => ({ permalink: undefined }));

  return { externalId: published.id, permalink: permalink.permalink ?? null };
}

/**
 * Publie sur une Page Facebook — avec le jeton **de Page**, jamais celui de
 * l'utilisateur.
 *
 * Plusieurs images font un post multi-photos : chaque photo est déposée non
 * publiée, puis le post les attache d'un coup. Une vidéo passe par `/videos`,
 * qui télécharge depuis l'URL comme Instagram.
 */
export async function publishFacebook(options: {
  pageId: string;
  pageToken: string;
  caption: string;
  mediaUrls: string[];
}): Promise<PublishedPost> {
  const { pageId, pageToken, caption, mediaUrls } = options;

  if (mediaUrls.length === 1 && isVideoPath(mediaUrls[0]!)) {
    const video = await graphPost<{ id: string }>(`/${pageId}/videos`, {
      access_token: pageToken,
      file_url: mediaUrls[0]!,
      description: caption,
    });
    const permalink = await graphGet<{ permalink_url?: string }>(
      `/${video.id}`,
      { access_token: pageToken, fields: "permalink_url" },
    ).catch(() => ({ permalink_url: undefined }));
    return { externalId: video.id, permalink: permalink.permalink_url ?? null };
  }

  const photoIds: string[] = [];
  for (const url of mediaUrls) {
    const photo = await graphPost<{ id: string }>(`/${pageId}/photos`, {
      access_token: pageToken,
      url,
      published: "false",
    });
    photoIds.push(photo.id);
  }

  const params: Record<string, string> = {
    access_token: pageToken,
    message: caption,
  };
  photoIds.forEach((id, index) => {
    params[`attached_media[${index}]`] = JSON.stringify({ media_fbid: id });
  });

  const post = await graphPost<{ id: string }>(`/${pageId}/feed`, params);

  const permalink = await graphGet<{ permalink_url?: string }>(`/${post.id}`, {
    access_token: pageToken,
    fields: "permalink_url",
  }).catch(() => ({ permalink_url: undefined }));

  return { externalId: post.id, permalink: permalink.permalink_url ?? null };
}
