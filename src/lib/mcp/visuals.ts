import { isImagePath, previewPathFor } from "@/lib/planning/storage";

import type { ContentBlock, ToolResult } from "./protocol";

/**
 * Les visuels du planning, tels que Claude peut les voir.
 *
 * Le bucket `planning-visuals` est privé et le reste : rien ici ne rend un
 * fichier public. Deux formes de sortie seulement —
 *   • une URL signée **d'une heure**, pour `lire_planning` et pour ce qui ne
 *     se montre pas en image (vidéo, PDF) ;
 *   • le contenu lui-même, en base64, dans un bloc image MCP, pour
 *     `lire_visuels`.
 *
 * Une URL externe portée par la colonne (héritée d'un import) est rendue telle
 * quelle et jamais téléchargée par le serveur : la colonne est écrite par
 * l'agence comme par le client, et aller chercher n'importe quelle adresse
 * depuis la fonction serait une porte ouverte.
 *
 * Ce module est pur à l'exception de sharp, chargé à la demande : le stockage
 * lui est passé par `VisualStorage`, ce qui le rend testable sans Supabase.
 */

/** Durée de vie des URL signées rendues au connecteur. */
export const VISUAL_URL_TTL_SECONDS = 3_600;

/** Le plafond conseillé par Anthropic pour une image : au-delà, elle est réduite de toute façon. */
export const MAX_IMAGE_EDGE = 1_568;

/** Plusieurs visuels d'un coup : la taille des miniatures, pour que le lot reste léger. */
export const BATCH_IMAGE_EDGE = 1_080;

/**
 * Budget d'un appel, en caractères base64 (~2,2 Mo d'octets). Un carrousel
 * de dix visuels en 1 568 px dépasserait ce qu'un connecteur transporte
 * confortablement : au-delà, les visuels restants sont nommés avec leur
 * index, et un second appel les rend un par un.
 */
export const IMAGE_BUDGET_BASE64 = 3_000_000;

const JPEG_QUALITY = 80;

export type VisualKind = "image" | "vidéo" | "document" | "fichier";

export function isExternalVisual(pathOrUrl: string): boolean {
  return /^https?:\/\//i.test(pathOrUrl);
}

export function visualKind(pathOrUrl: string): VisualKind {
  if (isImagePath(pathOrUrl)) return "image";
  if (/\.(mp4|mov|webm|m4v)(\?|$)/i.test(pathOrUrl)) return "vidéo";
  if (/\.pdf(\?|$)/i.test(pathOrUrl)) return "document";
  return "fichier";
}

/** Les chemins du bucket à signer — les URL externes n'en ont pas besoin. */
export function storagePaths(visualUrls: string[]): string[] {
  return [...new Set(visualUrls.filter((url) => !isExternalVisual(url)))];
}

/**
 * Une ligne par visuel, dans l'ordre de la publication — celui du carrousel :
 * `  - visuel 1 · image · <url>`. Un chemin que le stockage n'a pas signé
 * (fichier disparu) le dit plutôt que de rendre une URL morte.
 */
export function visualLines(visualUrls: string[], signed: Map<string, string>): string[] {
  return visualUrls.map((pathOrUrl, position) => {
    const label = `  - visuel ${position + 1} · ${visualKind(pathOrUrl)} · `;
    if (isExternalVisual(pathOrUrl)) return `${label}${pathOrUrl}`;
    return `${label}${signed.get(pathOrUrl) ?? "URL indisponible (fichier introuvable)"}`;
  });
}

/** Ce dont `lire_visuels` a besoin du stockage, et rien de plus. */
export type VisualStorage = {
  /** Les octets d'un objet du bucket, ou `null` s'il n'existe pas. */
  download: (path: string) => Promise<Uint8Array | null>;
  /** Des URL signées d'une heure, par chemin ; un chemin absent n'a pas d'entrée. */
  sign: (paths: string[]) => Promise<Map<string, string>>;
};

/**
 * Une image ramenée à `maxEdge` sur son plus grand côté, en JPEG : la forme
 * la plus légère qu'un modèle lit sans perte utile. L'orientation EXIF est
 * appliquée avant, sinon une photo de téléphone arrive couchée. Une image
 * animée ne garde que sa première image.
 */
export async function prepareImage(
  bytes: Uint8Array,
  maxEdge: number,
): Promise<{ data: string; mimeType: string; width: number; height: number }> {
  const { default: sharp } = await import("sharp");
  const { data, info } = await sharp(bytes, { animated: false })
    .rotate()
    .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return { data: data.toString("base64"), mimeType: "image/jpeg", width: info.width, height: info.height };
}

/** L'index demandé (à partir de 1), ou une erreur qui dit lesquels existent. */
export function selectIndexes(count: number, index: unknown): number[] {
  if (index === undefined || index === null || index === "") {
    return Array.from({ length: count }, (_, position) => position);
  }
  const wanted = Number(index);
  if (!Number.isInteger(wanted) || wanted < 1 || wanted > count) {
    throw new Error(
      `index ${String(index)} invalide : cette publication a ${count} visuel${count > 1 ? "s" : ""} (index de 1 à ${count}).`,
    );
  }
  return [wanted - 1];
}

/**
 * Les visuels d'une publication en blocs MCP : une légende texte puis l'image,
 * dans l'ordre du carrousel.
 *
 * Un visuel seul part en 1 568 px depuis l'original ; un lot part en 1 080 px
 * depuis la miniature déjà posée à côté de chaque original, quand elle existe
 * — c'est elle que l'écran affiche, et elle évite de télécharger un master de
 * 40 Mo pour le réduire aussitôt. Une vidéo rend son URL signée et, si sa
 * miniature existe, sa première image.
 */
export async function collectVisuals(input: {
  name: string;
  visualUrls: string[];
  index?: unknown;
  storage: VisualStorage;
  budget?: number;
}): Promise<ToolResult> {
  const { name, visualUrls, storage } = input;
  if (visualUrls.length === 0) return { text: `Aucun visuel sur « ${name} ».` };

  const indexes = selectIndexes(visualUrls.length, input.index);
  const single = indexes.length === 1;
  const maxEdge = single ? MAX_IMAGE_EDGE : BATCH_IMAGE_EDGE;
  const budget = input.budget ?? IMAGE_BUDGET_BASE64;

  const chosen = indexes.map((position) => visualUrls[position]!);
  const signed = await storage.sign(storagePaths(chosen));

  const header = single
    ? `« ${name} » — visuel ${indexes[0]! + 1} sur ${visualUrls.length}.`
    : `« ${name} » — ${visualUrls.length} visuel${visualUrls.length > 1 ? "s" : ""}, dans l'ordre de publication.`;
  const content: ContentBlock[] = [{ type: "text", text: header }];
  let spent = 0;

  for (const position of indexes) {
    const pathOrUrl = visualUrls[position]!;
    const kind = visualKind(pathOrUrl);
    const label = `visuel ${position + 1} · ${kind}`;
    const url = isExternalVisual(pathOrUrl) ? pathOrUrl : signed.get(pathOrUrl);

    if (isExternalVisual(pathOrUrl)) {
      content.push({ type: "text", text: `${label} · lien externe, non chargé : ${pathOrUrl}` });
      continue;
    }
    if (!url) {
      content.push({ type: "text", text: `${label} · fichier introuvable dans le stockage.` });
      continue;
    }
    if (kind !== "image" && kind !== "vidéo") {
      content.push({ type: "text", text: `${label} · URL signée (1 h) : ${url}` });
      continue;
    }

    // Une vidéo ne se montre que par sa miniature ; une image, par l'original
    // quand on la demande seule, sinon par sa miniature.
    const candidates =
      kind === "vidéo"
        ? [previewPathFor(pathOrUrl)]
        : single
          ? [pathOrUrl]
          : [previewPathFor(pathOrUrl), pathOrUrl];

    let image: Awaited<ReturnType<typeof prepareImage>> | null = null;
    let failure: string | null = null;
    for (const candidate of candidates) {
      const bytes = await storage.download(candidate);
      if (!bytes) continue;
      try {
        image = await prepareImage(bytes, maxEdge);
      } catch (error) {
        failure = error instanceof Error ? error.message : "lecture impossible";
      }
      break;
    }

    if (!image) {
      const why = kind === "vidéo" ? "pas de miniature" : `image illisible${failure ? ` (${failure})` : ""}`;
      content.push({ type: "text", text: `${label} · ${why} · URL signée (1 h) : ${url}` });
      continue;
    }
    if (spent + image.data.length > budget && spent > 0) {
      content.push({
        type: "text",
        text: `${label} · non joint, le lot est complet : rappeler lire_visuels avec index ${position + 1}. URL signée (1 h) : ${url}`,
      });
      continue;
    }

    spent += image.data.length;
    const caption =
      kind === "vidéo"
        ? `${label} · première image ci-dessous · la vidéo : ${url}`
        : `${label} · ${image.width}×${image.height}`;
    content.push({ type: "text", text: caption });
    content.push({ type: "image", data: image.data, mimeType: image.mimeType });
  }

  const text = content
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join("\n");
  return { text, content };
}
