import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { VISUALS_BUCKET } from "@/lib/planning/storage";
import type { Database } from "@/lib/supabase/database.types";
import { isJpegPath, isPdfPath, isVideoPath } from "./readiness";

/**
 * Les fichiers d'une ligne du planning, tels que chaque réseau les veut.
 *
 * Meta télécharge lui-même depuis une URL signée ; TikTok et LinkedIn
 * reçoivent les octets, poussés par nous sur l'adresse d'envoi qu'ils
 * rendent. Un même visuel sert donc sous deux formes, et ne se télécharge
 * qu'une fois (`read` garde sa promesse).
 *
 * La conversion d'images (`sharp`) ne sert qu'à Instagram et LinkedIn, sur
 * la machine GitHub du passage. Elle est chargée à la demande : « Publier
 * maintenant » sur TikTok tourne sur Vercel, où rien ne garantit le binaire
 * natif — et n'en a pas besoin.
 */

type Admin = SupabaseClient<Database>;

export type MediaKind = "image" | "video" | "pdf";

export type MediaItem = {
  /** Le chemin du bucket, ou l'URL d'origine d'un visuel externe. */
  source: string;
  signedUrl: string;
  kind: MediaKind;
  contentType: string;
  read: () => Promise<Buffer>;
};

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  pdf: "application/pdf",
};

function contentTypeOf(path: string): string {
  const extension = path.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[extension] ?? "application/octet-stream";
}

/** Deux heures : le temps des encodages les plus lents chez Meta. */
const SIGNED_URL_SECONDS = 7200;

export async function loadMedia(admin: Admin, visualUrls: string[]): Promise<MediaItem[]> {
  const paths = visualUrls.filter((url) => !url.startsWith("http"));
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data, error } = await admin.storage
      .from(VISUALS_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_SECONDS);
    if (error) throw new Error(`Signature des visuels : ${error.message}`);
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
    }
  }

  return visualUrls.map((source) => {
    const signedUrl = source.startsWith("http") ? source : signed.get(source);
    if (!signedUrl) throw new Error("un visuel n'existe plus dans le stockage");

    let bytes: Promise<Buffer> | null = null;
    const read = () =>
      (bytes ??= fetch(signedUrl, { cache: "no-store" }).then(async (response) => {
        if (!response.ok) throw new Error(`Visuel illisible (${response.status}).`);
        return Buffer.from(await response.arrayBuffer());
      }));

    return {
      source,
      signedUrl,
      kind: isVideoPath(source) ? "video" : isPdfPath(source) ? "pdf" : "image",
      contentType: contentTypeOf(source),
      read,
    };
  });
}

/**
 * Une image en JPEG RGB, sur fond blanc, orientée.
 *
 * Instagram ne publie que du JPEG — un PNG est refusé, et les créas des
 * clients sont des PNG. Un PDF n'embarque tel quel qu'un JPEG en couleurs
 * RGB. La transparence d'un PNG tomberait en noir : on l'aplatit sur blanc.
 */
export async function toRgbJpeg(
  input: Buffer,
): Promise<{ bytes: Buffer; width: number; height: number }> {
  const { default: sharp } = await import("sharp");
  const { data, info } = await sharp(input)
    .rotate()
    .flatten({ background: "#ffffff" })
    .toColourspace("srgb")
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return { bytes: data, width: info.width, height: info.height };
}

/**
 * Les URL qu'Instagram téléchargera : un JPEG reste tel quel, toute autre
 * image est convertie puis déposée à côté, le temps du passage. `cleanup`
 * retire les copies — Instagram les a téléchargées dès la création du
 * conteneur.
 */
export async function instagramUrls(options: {
  admin: Admin;
  workspaceId: string;
  subjectId: string;
  items: MediaItem[];
}): Promise<{ urls: string[]; cleanup: () => Promise<void> }> {
  const { admin, workspaceId, subjectId, items } = options;
  const copies: string[] = [];
  const urls: string[] = [];

  try {
    for (const [index, item] of items.entries()) {
      if (item.kind !== "image" || isJpegPath(item.source)) {
        urls.push(item.signedUrl);
        continue;
      }
      const jpeg = await toRgbJpeg(await item.read());
      // Premier segment = l'espace, comme tout le bucket ; le dossier dit
      // que ce n'est pas un visuel de la ligne.
      const path = `${workspaceId}/publication/${subjectId}/${index}.jpg`;
      const { error } = await admin.storage
        .from(VISUALS_BUCKET)
        .upload(path, jpeg.bytes, { contentType: "image/jpeg", upsert: true });
      if (error) throw new Error(`Copie JPEG pour Instagram : ${error.message}`);
      copies.push(path);

      const { data, error: signError } = await admin.storage
        .from(VISUALS_BUCKET)
        .createSignedUrl(path, SIGNED_URL_SECONDS);
      if (signError || !data?.signedUrl) {
        throw new Error(`Signature de la copie JPEG : ${signError?.message ?? "sans URL"}`);
      }
      urls.push(data.signedUrl);
    }
  } catch (error) {
    await removeCopies(admin, copies);
    throw error;
  }

  return { urls, cleanup: () => removeCopies(admin, copies) };
}

async function removeCopies(admin: Admin, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  // Une copie oubliée ne coûte que de la place : son échec ne fait pas
  // échouer une publication réussie.
  await admin.storage.from(VISUALS_BUCKET).remove(paths);
}
