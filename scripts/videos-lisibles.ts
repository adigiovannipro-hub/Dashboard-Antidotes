/**
 * Convertit en MP4 H.264 les vidéos du planning que les navigateurs du client
 * ne lisent pas.
 *
 *   pnpm videos:lisibles            aperçu : liste ce qui serait converti
 *   pnpm videos:lisibles --ecrire   convertit, dépose, rebranche la publication
 *   pnpm videos:lisibles --compter  un nombre seul : ce qu'il reste à convertir
 *
 * Un `.mov` d'iPhone est en HEVC : Safari sur Mac le joue, Chrome sous Windows
 * et la plupart des Android non — l'agence voyait la vidéo, le client un cadre
 * noir (6/10/2026). Depuis, le navigateur convertit à l'envoi ; quand il ne
 * sait pas décoder la source, le dépôt lui-même déclenche ce script (workflow
 * « Vidéos lisibles partout »). Aucun passage programmé.
 *
 * La vidéo garde 1080 de petit côté et une qualité fine : elle peut encore
 * partir sur Instagram. Le nouveau fichier prend la place de l'ancien dans
 * `visual_urls`, au même rang — l'ordre d'un carrousel est une donnée —, puis
 * l'ancien et sa miniature sont retirés du bucket. Rejouable : une publication
 * déjà convertie n'a plus de `.mov` à traiter.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

import { PREVIEW_SUFFIX, VISUALS_BUCKET } from "../src/lib/planning/storage";
import { isUnportableVideoPath } from "../src/lib/planning/video-compression";
import {
  MAX_UPLOAD_BYTES,
  capForUploadLimit,
  parseProbe,
  transcodeArgs,
  transcodedName,
} from "../src/lib/planning/transcode";

dotenv.config({ path: ".env.local", quiet: true });

const WRITE = process.argv.includes("--ecrire");
const VIDEO_KBPS = 8000;
const PREVIEW_MAX_EDGE = 1080;

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function run(command: string, args: string[]): string {
  const result = spawnSync(command, args, { maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = result.stderr?.toString().split("\n").filter(Boolean).slice(-3).join(" | ");
    throw new Error(`${command} a échoué (${detail || "sans détail"})`);
  }
  return result.stdout.toString();
}

const needsPortableCopy = isUnportableVideoPath;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.");
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await admin
    .from("planning_subjects")
    .select("id, name, visual_urls")
    .not("visual_urls", "eq", "{}");
  if (error) fail(`lecture des publications : ${error.message}`);
  const subjects = ((data ?? []) as { id: string; name: string; visual_urls: string[] }[]).filter(
    (subject) => subject.visual_urls.some(needsPortableCopy),
  );

  // `--compter` : un nombre seul sur la sortie, lu par le workflow pour
  // décider s'il faut installer ffmpeg.
  if (process.argv.includes("--compter")) {
    console.log(String(subjects.length));
    return;
  }
  console.log(`${subjects.length} publication(s) portent une vidéo à convertir.`);
  if (!WRITE) {
    for (const subject of subjects) {
      for (const visual of subject.visual_urls.filter(needsPortableCopy)) {
        console.log(`  · ${subject.name} — ${visual}`);
      }
    }
    console.log("Aperçu seulement : relancer avec --ecrire pour convertir.");
    return;
  }

  const work = mkdtempSync(path.join(tmpdir(), "videos-lisibles-"));
  let converted = 0;
  let failed = 0;
  try {
    for (const subject of subjects) {
      const next = [...subject.visual_urls];
      const removed: string[] = [];
      for (const [index, visual] of subject.visual_urls.entries()) {
        if (!needsPortableCopy(visual)) continue;
        try {
          const { data: blob, error: downloadError } = await admin.storage
            .from(VISUALS_BUCKET)
            .download(visual);
          if (downloadError || !blob) throw new Error(downloadError?.message ?? "fichier vide");
          const source = path.join(work, `source-${converted + failed}${path.extname(visual)}`);
          writeFileSync(source, Buffer.from(await blob.arrayBuffer()));

          const probe = parseProbe(
            run("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", source]),
          );
          const output = `${source}.mp4`;
          run(
            "ffmpeg",
            transcodeArgs({
              source,
              output,
              probe,
              videoKbps: capForUploadLimit(VIDEO_KBPS, probe.durationSeconds),
              shortEdge: 1080,
              crf: 21,
            }),
          );
          const size = statSync(output).size;
          if (size > MAX_UPLOAD_BYTES) throw new Error(`${(size / 1048576).toFixed(0)} Mo après conversion`);

          const poster = `${output}.jpg`;
          run("ffmpeg", [
            "-y", "-hide_banner", "-loglevel", "error", "-ss", "0.1", "-i", output,
            "-frames:v", "1", "-vf", `scale=w='min(${PREVIEW_MAX_EDGE},iw)':h=-2`, "-q:v", "3", poster,
          ]);

          const target = path.posix.join(path.posix.dirname(visual), transcodedName(path.posix.basename(visual)));
          for (const [object, bytes, mime] of [
            [target, readFileSync(output), "video/mp4"],
            [`${target}${PREVIEW_SUFFIX}`, readFileSync(poster), "image/jpeg"],
          ] as const) {
            const { error: uploadError } = await admin.storage
              .from(VISUALS_BUCKET)
              .upload(object, bytes, { contentType: mime, upsert: true, cacheControl: "31536000" });
            if (uploadError) throw new Error(`dépôt de ${object} : ${uploadError.message}`);
          }

          next[index] = target;
          removed.push(visual, `${visual}${PREVIEW_SUFFIX}`);
          converted += 1;
          console.log(`✓ ${subject.name} — ${path.posix.basename(visual)} → ${(size / 1048576).toFixed(1)} Mo`);
        } catch (cause) {
          failed += 1;
          console.error(`✗ ${subject.name} — ${visual} : ${(cause as Error).message}`);
        }
      }

      if (removed.length === 0) continue;
      // La publication pointe sur le MP4 avant que l'ancien fichier ne parte :
      // un échec entre les deux laisse un fichier en trop, jamais un trou.
      const { error: updateError } = await admin
        .from("planning_subjects")
        .update({ visual_urls: next })
        .eq("id", subject.id);
      if (updateError) {
        failed += 1;
        console.error(`✗ ${subject.name} — rebranchement : ${updateError.message}`);
        continue;
      }
      await admin.storage.from(VISUALS_BUCKET).remove(removed);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }

  console.log(`Converties : ${converted}, en échec : ${failed}.`);
  if (failed > 0) process.exit(1);
}

if (process.argv[1]?.endsWith("videos-lisibles.ts")) {
  void main();
}
