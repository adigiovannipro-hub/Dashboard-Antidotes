/**
 * Rattrapage des miniatures de visuels du Planning.
 *
 *   pnpm previews:planning            fabrique les miniatures manquantes
 *   pnpm previews:planning --dry-run  liste sans rien écrire
 *
 * Depuis la convention `<chemin>.preview.jpg`, chaque envoi du navigateur
 * dépose sa miniature à côté de l'original — mais tout ce qui a été déposé
 * **avant** n'en a pas, et continue de charger 40 Mo pour une vignette de
 * 24 px. Ce script comble le stock : il repère les originaux sans miniature
 * (un seul batch d'URL signées, celles en erreur sont les absentes), les
 * télécharge, et fabrique la version légère — sharp pour les images (1080 px
 * de bord long, orientation EXIF respectée), ffmpeg pour la première image
 * d'une vidéo. Sans ffmpeg sur la machine, les vidéos sont comptées et dites,
 * jamais bloquantes.
 *
 * Idempotent par construction : une miniature déjà en place n'est pas refaite.
 * À jouer contre la vraie base depuis db-admin (étape optionnelle) ou d'un
 * poste local — c'est du Storage, le service role suffit.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

import {
  VISUALS_BUCKET,
  isImagePath,
  previewPathFor,
} from "../src/lib/planning/storage";

dotenv.config({ path: ".env.local", quiet: true });

const DRY_RUN = process.argv.includes("--dry-run");
/** Reprend aussi les en-têtes de cache des miniatures déjà en place :
    stockées avant la convention, elles portent `no-cache` et le navigateur
    les revalide à chaque affichage. */
const REFRESH_HEADERS = process.argv.includes("--entetes");

/** Un an : le chemin porte un horodatage, son contenu ne change jamais. */
const CACHE_CONTROL_SECONDS = "31536000";

/** Les mêmes bornes que le navigateur : un seul rendu de miniature. */
const PREVIEW_MAX_EDGE = 1080;
const PREVIEW_QUALITY = 82;

const VIDEO_EXTENSIONS = /\.(mp4|mov|webm|m4v)$/i;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis dans .env.local.",
    );
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  // Les originaux réellement affichés : ceux que portent les publications.
  // Lister le bucket entier ramasserait aussi les orphelins d'anciennes
  // suppressions, qu'on n'a pas à miniaturiser.
  const { data: subjects, error } = await admin
    .from("planning_subjects")
    .select("visual_urls");
  if (error) throw new Error(`Lecture des publications : ${error.message}`);

  const paths = [
    ...new Set(
      (subjects ?? [])
        .flatMap((row) => (row.visual_urls as string[] | null) ?? [])
        .filter((entry) => !entry.startsWith("http")),
    ),
  ];

  if (paths.length === 0) {
    console.log("Aucun visuel en bucket : rien à faire.");
    return;
  }

  // Une URL signée par miniature candidate : celles en erreur n'existent pas.
  const { data: signed, error: signError } = await admin.storage
    .from(VISUALS_BUCKET)
    .createSignedUrls(paths.map(previewPathFor), 60);
  if (signError) throw new Error(`Sondage des miniatures : ${signError.message}`);

  const existing = new Set(
    (signed ?? [])
      .filter((entry) => entry.signedUrl && entry.path)
      .map((entry) => entry.path as string),
  );

  const missing = paths.filter((entry) => !existing.has(previewPathFor(entry)));
  const hasFfmpeg = !spawnSync("ffmpeg", ["-version"]).error;

  console.log(
    `${paths.length} visuels au bucket, ${missing.length} sans miniature.` +
      (hasFfmpeg ? "" : " (ffmpeg absent : les vidéos seront sautées)"),
  );
  if (DRY_RUN || (missing.length === 0 && !REFRESH_HEADERS)) {
    if (DRY_RUN) for (const entry of missing) console.log(`  → ${entry}`);
    return;
  }

  const workDir = mkdtempSync(path.join(tmpdir(), "antidotes-previews-"));
  let made = 0;
  let skipped = 0;
  let failed = 0;

  try {
    for (const entry of missing) {
      const isImage = isImagePath(entry);
      const isVideo = VIDEO_EXTENSIONS.test(entry);
      if (!isImage && !isVideo) {
        skipped += 1; // PDF et consorts : pas de miniature, comme au runtime.
        continue;
      }
      if (isVideo && !hasFfmpeg) {
        skipped += 1;
        continue;
      }

      try {
        const { data: blob, error: downloadError } = await admin.storage
          .from(VISUALS_BUCKET)
          .download(entry);
        if (downloadError || !blob) {
          throw new Error(downloadError?.message ?? "téléchargement vide");
        }
        const original = Buffer.from(await blob.arrayBuffer());

        const preview = isImage
          ? await imagePreview(original)
          : videoPoster(original, workDir);

        const { error: uploadError } = await admin.storage
          .from(VISUALS_BUCKET)
          .upload(previewPathFor(entry), preview, {
            contentType: "image/jpeg",
            upsert: true,
            cacheControl: CACHE_CONTROL_SECONDS,
          });
        if (uploadError) throw new Error(uploadError.message);

        made += 1;
        console.log(`  ✓ ${entry} (${Math.round(preview.length / 1024)} Ko)`);
      } catch (cause) {
        failed += 1;
        console.error(`  ✗ ${entry} : ${(cause as Error).message}`);
      }
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }

  console.log(
    `Miniatures : ${made} fabriquées, ${skipped} sautées (PDF, ou vidéo sans ffmpeg), ${failed} en échec.`,
  );

  if (REFRESH_HEADERS) {
    // Re-dépose chaque miniature déjà en place avec l'en-tête de cache long :
    // quelques centaines de Ko en tout, et le navigateur cesse de revalider.
    let refreshed = 0;
    let refreshFailed = 0;
    for (const entry of paths) {
      const preview = previewPathFor(entry);
      if (!existing.has(preview)) continue;
      try {
        const { data: blob, error: downloadError } = await admin.storage
          .from(VISUALS_BUCKET)
          .download(preview);
        if (downloadError || !blob) {
          throw new Error(downloadError?.message ?? "téléchargement vide");
        }
        const { error: uploadError } = await admin.storage
          .from(VISUALS_BUCKET)
          .upload(preview, Buffer.from(await blob.arrayBuffer()), {
            contentType: "image/jpeg",
            upsert: true,
            cacheControl: CACHE_CONTROL_SECONDS,
          });
        if (uploadError) throw new Error(uploadError.message);
        refreshed += 1;
      } catch (cause) {
        refreshFailed += 1;
        console.error(`  ✗ en-têtes ${preview} : ${(cause as Error).message}`);
      }
    }
    console.log(
      `En-têtes de cache repris sur ${refreshed} miniature${refreshed > 1 ? "s" : ""}, ${refreshFailed} en échec.`,
    );
    if (refreshFailed > 0) process.exit(1);
  }

  if (failed > 0) process.exit(1);
}

async function imagePreview(original: Buffer): Promise<Buffer> {
  // `rotate()` sans argument applique l'orientation EXIF : la photo d'un
  // téléphone arriverait couchée sans lui. Fond blanc : JPEG ignore l'alpha.
  return sharp(original)
    .rotate()
    .resize(PREVIEW_MAX_EDGE, PREVIEW_MAX_EDGE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: PREVIEW_QUALITY })
    .toBuffer();
}

function videoPoster(original: Buffer, workDir: string): Buffer {
  const input = path.join(workDir, `in-${Date.now()}`);
  const output = `${input}.jpg`;
  writeFileSync(input, original);

  // `-ss` avant `-i` : positionnement rapide un dixième de seconde après le
  // début — l'amorce des exports est souvent noire. Le filtre borne le bord
  // long à 1080 sans jamais agrandir.
  const result = spawnSync("ffmpeg", [
    "-y",
    "-ss",
    "0.1",
    "-i",
    input,
    "-frames:v",
    "1",
    "-vf",
    "scale=w='min(1080,iw)':h=-2",
    "-q:v",
    "3",
    output,
  ]);
  if (result.status !== 0) {
    throw new Error(
      `ffmpeg a refusé la vidéo (${result.stderr?.toString().split("\n").filter(Boolean).at(-1) ?? "sans détail"})`,
    );
  }
  return readFileSync(output);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
