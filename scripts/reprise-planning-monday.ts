/**
 * Reprise définitive d'un planning Monday 2026 dans Antidotes, visuels compris.
 *
 *   pnpm reprise:monday --espace anmf                      aperçu, rien d'écrit
 *   pnpm reprise:monday --espace anmf --ecrire             lignes seulement
 *   pnpm reprise:monday --espace anmf --ecrire --medias    lignes, puis fichiers
 *   … --budget-video 260                                   plafond vidéo, en Mo
 *
 * Lit l'instantané figé `scripts/data/reprise-monday/<espace>.json` — le
 * wording y est à l'octet, relisible avant de partir — et applique le plan de
 * `planReprise` : les mois décrits par Monday sont remplacés, les autres ne
 * bougent pas (octobre, en préparation, est exclu dans l'instantané même).
 *
 * Les fichiers : les URL Monday sont protégées, donc illisibles dans
 * Antidotes. Chaque fichier est téléchargé (`MONDAY_API_TOKEN`), déposé au
 * bucket sous le chemin de sa publication, avec sa miniature. Les vidéos,
 * déjà publiées, passent en 720p (`transcode.ts`) : le stockage gratuit tient
 * 1 Go pour tout le projet et refuse un fichier de plus de 50 Mo.
 *
 * Rejouable : lignes par `external_id`, fichiers par chemin déterministe
 * (`monday-<asset>-<nom>`) — un fichier déjà au bucket n'est pas réenvoyé.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import dotenv from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

import { monthGroupLabel, normalizeLabel } from "../src/lib/planning/monday-mapping";
import {
  planReprise,
  wouldAutoPublish,
  type MondayFile,
  type RepriseSnapshot,
  type SubjectDraft,
} from "../src/lib/planning/reprise";
import { PREVIEW_SUFFIX, VISUALS_BUCKET } from "../src/lib/planning/storage";
import {
  MAX_UPLOAD_BYTES,
  capForUploadLimit,
  isVideoName,
  parseProbe,
  targetVideoKbps,
  transcodeArgs,
  transcodedName,
  type VideoProbe,
} from "../src/lib/planning/transcode";

dotenv.config({ path: ".env.local", quiet: true });

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1) return process.argv[index + 1];
  return process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
}

const WRITE = process.argv.includes("--ecrire");
const MEDIA = process.argv.includes("--medias");
const SLUG = option("espace");
const BUDGET_MB = option("budget-video");

/** Un an : le chemin est déterministe et son contenu ne change jamais. */
const CACHE_CONTROL_SECONDS = "31536000";
const PREVIEW_MAX_EDGE = 1080;
const PREVIEW_QUALITY = 82;
/** Sous 150 Ko, le navigateur ne fabrique pas de miniature : même règle. */
const PREVIEW_SKIP_BYTES = 150 * 1024;

const MONDAY_API = "https://api.monday.com/v2";

// Client non typé, comme les autres scripts de reprise : chaque lecture est
// castée à sa forme, la convention `as unknown as T` du dépôt.
type Admin = SupabaseClient;

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function must<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  // Une table absente rend un `data` nul, donc « rien à faire » : on ne s'y
  // fie jamais sans avoir lu l'erreur.
  if (result.error) fail(`${what} : ${result.error.message}`);
  return result.data as T;
}

function parisToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// --- Fichiers ----------------------------------------------------------------

type Kind = { ext: string; mime: string; video: boolean };

/** Le type se lit sur les octets : deux fichiers Monday n'ont pas d'extension. */
function sniff(bytes: Buffer): Kind | null {
  const head = bytes.subarray(0, 16);
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: "png", mime: "image/png", video: false };
  }
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg", video: false };
  }
  if (head.subarray(0, 4).toString("latin1") === "GIF8") {
    return { ext: "gif", mime: "image/gif", video: false };
  }
  if (
    head.subarray(0, 4).toString("latin1") === "RIFF" &&
    head.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return { ext: "webp", mime: "image/webp", video: false };
  }
  if (head.subarray(0, 4).toString("latin1") === "%PDF") {
    return { ext: "pdf", mime: "application/pdf", video: false };
  }
  if (head.subarray(4, 8).toString("latin1") === "ftyp") {
    const brand = head.subarray(8, 12).toString("latin1");
    if (brand.startsWith("heic") || brand.startsWith("heix") || brand === "mif1") return null;
    return { ext: "mp4", mime: "video/mp4", video: true };
  }
  return null;
}

function safeName(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "visuel"
  );
}

/** `<espace>/<publication>/monday-<asset>-<nom>` : le préfixe fait la propriété. */
function storedPath(workspaceId: string, subjectId: string, file: MondayFile, ext: string): string {
  const base = safeName(file.name).replace(/\.[a-zA-Z0-9]+$/, "");
  return `${workspaceId}/${subjectId}/monday-${file.assetId}-${base}.${ext}`;
}

class Monday {
  constructor(private readonly token: string) {}

  /** URL de téléchargement signée, valable une heure : demandée au dernier moment. */
  async publicUrls(ids: string[]): Promise<Map<string, string>> {
    const response = await fetch(MONDAY_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.token,
        "API-Version": "2024-10",
      },
      body: JSON.stringify({
        query: "query ($ids: [ID!]!) { assets (ids: $ids) { id public_url } }",
        variables: { ids },
      }),
    });
    if (!response.ok) throw new Error(`Monday a répondu ${response.status}`);
    const payload = (await response.json()) as {
      data?: { assets: { id: string; public_url: string | null }[] };
      errors?: { message: string }[];
    };
    if (payload.errors?.length) throw new Error(payload.errors.map((e) => e.message).join(" · "));
    return new Map(
      (payload.data?.assets ?? [])
        .filter((asset) => asset.public_url)
        .map((asset) => [String(asset.id), asset.public_url as string]),
    );
  }
}

async function download(url: string): Promise<Buffer> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`téléchargement ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (cause) {
      if (attempt >= 3) throw cause;
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
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

function probe(file: string): VideoProbe {
  return parseProbe(
    run("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", file]),
  );
}

function videoPoster(file: string): Buffer {
  const output = `${file}.poster.jpg`;
  run("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    "0.1",
    "-i",
    file,
    "-frames:v",
    "1",
    "-vf",
    `scale=w='min(${PREVIEW_MAX_EDGE},iw)':h=-2`,
    "-q:v",
    "3",
    output,
  ]);
  return readFileSync(output);
}

async function imagePreview(original: Buffer): Promise<Buffer> {
  return sharp(original)
    .rotate()
    .resize(PREVIEW_MAX_EDGE, PREVIEW_MAX_EDGE, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: PREVIEW_QUALITY })
    .toBuffer();
}

async function upload(admin: Admin, target: string, bytes: Buffer, mime: string) {
  const { error } = await admin.storage.from(VISUALS_BUCKET).upload(target, bytes, {
    contentType: mime,
    upsert: true,
    cacheControl: CACHE_CONTROL_SECONDS,
  });
  if (error) throw new Error(`dépôt de ${target} : ${error.message}`);
}

async function existingObjects(admin: Admin, prefix: string): Promise<Set<string>> {
  const { data, error } = await admin.storage.from(VISUALS_BUCKET).list(prefix, { limit: 1000 });
  if (error) throw new Error(`lecture du bucket ${prefix} : ${error.message}`);
  return new Set((data ?? []).map((entry) => `${prefix}/${entry.name}`));
}

// --- Programme ----------------------------------------------------------------

async function main() {
  if (!SLUG) fail("Usage : pnpm reprise:monday --espace <slug> [--ecrire] [--medias]");

  const file = path.join("scripts", "data", "reprise-monday", `${SLUG}.json`);
  const snapshot = JSON.parse(readFileSync(file, "utf8")) as RepriseSnapshot;
  if (snapshot.workspace !== SLUG) fail(`${file} décrit « ${snapshot.workspace} », pas « ${SLUG} ».`);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) fail("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.");

  const admin: Admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const workspace = must(
    await admin.from("workspaces").select("id, name").eq("slug", SLUG).maybeSingle(),
    "Lecture de l'espace",
  ) as { id: string; name: string } | null;
  if (!workspace) fail(`Espace « ${SLUG} » introuvable.`);

  const board = must(
    await admin
      .from("planning_boards")
      .select("id, name")
      .eq("workspace_id", workspace.id)
      .eq("kind", "editorial")
      .eq("year", snapshot.year)
      .maybeSingle(),
    "Lecture du tableau",
  ) as { id: string; name: string } | null;
  if (!board) fail(`Aucun tableau éditorial ${snapshot.year} chez ${workspace.name}.`);
  const boardId = board.id;
  const workspaceId = workspace.id;

  const [months, lanes, subjects] = await Promise.all([
    admin.from("planning_months").select("id, month, deleted_at").eq("board_id", board.id),
    admin.from("planning_lanes").select("id, month_id, external_id").eq("board_id", board.id),
    admin
      .from("planning_subjects")
      .select("id, month_id, lane_id, external_id, name, wording, visual_urls, deleted_at, custom")
      .eq("board_id", board.id),
  ]);
  const existingMonths = must(months, "Lecture des mois") as {
    id: string;
    month: string;
    deleted_at: string | null;
  }[];
  const existingLanes = must(lanes, "Lecture des couloirs") as {
    id: string;
    month_id: string;
    external_id: string | null;
  }[];
  const existingSubjects = must(subjects, "Lecture des publications") as {
    id: string;
    month_id: string;
    lane_id: string;
    external_id: string | null;
    name: string;
    wording: string | null;
    visual_urls: string[];
    deleted_at: string | null;
    custom: Record<string, unknown>;
  }[];

  const plan = planReprise({
    snapshot,
    months: existingMonths,
    lanes: existingLanes,
    subjects: existingSubjects,
  });

  // --- Aperçu ---
  const byMonth = new Map<string, SubjectDraft[]>();
  for (const subject of plan.subjects) {
    byMonth.set(subject.month, [...(byMonth.get(subject.month) ?? []), subject]);
  }
  const fileCount = plan.subjects.reduce((sum, s) => sum + s.files.length, 0);

  console.log(`${workspace.name} — ${board.name} — instantané du ${snapshot.capturedAt}`);
  console.log(`Mois exclus : ${snapshot.excludedMonths.join(", ") || "aucun"}`);
  for (const entry of plan.months) {
    const rows = byMonth.get(entry.month) ?? [];
    const state = entry.existingId ? (entry.restore ? "relevé de la corbeille" : "existant") : "créé";
    console.log(
      `  ${entry.month}  ${String(rows.length).padStart(3)} publications, ` +
        `${rows.reduce((sum, s) => sum + s.files.length, 0)} fichiers (${state})`,
    );
  }
  console.log(
    `Couloirs ${plan.lanes.length} · publications ${plan.subjects.length} · fichiers ${fileCount}`,
  );
  console.log(
    `Ménage : ${plan.deleteSubjectIds.length} essais effacés, ` +
      `${plan.trashSubjects.filter((t) => !t.alreadyTrashed).length} lignes à la corbeille, ` +
      `${plan.deleteLaneIds.length} couloirs retirés`,
  );
  if (plan.skippedGroups.length > 0) console.log(`Groupes ignorés : ${plan.skippedGroups.join(", ")}`);
  for (const warning of plan.warnings) console.log(`⚠ ${warning}`);

  const today = parisToday();
  for (const subject of plan.subjects.filter((s) => wouldAutoPublish(s, today))) {
    console.log(`⚠ « ${subject.name} » est validé pour le ${subject.scheduledOn} : il partira tout seul.`);
  }

  if (!WRITE) {
    console.log("\nAperçu seulement. Ajouter --ecrire pour appliquer.");
    return;
  }

  // --- Mois ---
  const monthIdByKey = new Map(existingMonths.map((row) => [row.month, row.id]));
  for (const entry of plan.months) {
    if (entry.existingId === null) {
      const created = must(
        await admin
          .from("planning_months")
          .insert({
            board_id: board.id,
            workspace_id: workspace.id,
            month: entry.month,
            label: monthGroupLabel(entry.month),
            // La place dans le calendrier, pas la fin de la liste.
            position: Number(entry.month.slice(5, 7)) - 1,
          } as never)
          .select("id")
          .single(),
        `Création du mois ${entry.month}`,
      ) as { id: string };
      monthIdByKey.set(entry.month, created.id);
    } else if (entry.restore) {
      must(
        await admin
          .from("planning_months")
          .update({ deleted_at: null } as never)
          .eq("id", entry.existingId),
        `Relève du mois ${entry.month}`,
      );
    }
  }

  // --- Couloirs ---
  must(
    await admin.from("planning_lanes").upsert(
      plan.lanes.map((lane) => ({
        month_id: monthIdByKey.get(lane.month)!,
        board_id: board.id,
        workspace_id: workspace.id,
        platform: lane.platform,
        name: lane.name,
        position: lane.position,
        external_id: lane.externalId,
      })) as never,
      { onConflict: "board_id,external_id" },
    ),
    "Écriture des couloirs",
  );
  const laneRows = must(
    await admin
      .from("planning_lanes")
      .select("id, external_id, month_id")
      .eq("board_id", board.id)
      .not("external_id", "is", null),
    "Relecture des couloirs",
  ) as { id: string; external_id: string; month_id: string }[];
  const laneIdByExternal = new Map(laneRows.map((row) => [row.external_id, row.id]));

  // --- Colonnes que Monday porte et que le modèle n'a pas ---
  const columns = must(
    await admin.from("planning_columns").select("id, label, type").eq("board_id", board.id),
    "Lecture des colonnes",
  ) as { id: string; label: string | null; type: string | null }[];

  async function ensureColumn(label: string, type: "text" | "checkbox", position: number) {
    const found = columns.find(
      (column) => column.type === type && normalizeLabel(column.label) === normalizeLabel(label),
    );
    if (found) return found.id;
    const created = must(
      await admin
        .from("planning_columns")
        .insert({ board_id: boardId, workspace_id: workspaceId, type, label, position } as never)
        .select("id")
        .single(),
      `Création de la colonne ${label}`,
    ) as { id: string };
    return created.id;
  }

  const commentsColumn = plan.subjects.some((s) => s.comments)
    ? await ensureColumn("Commentaires", "text", 100)
    : null;
  const okColumn = plan.subjects.some((s) => s.ok) ? await ensureColumn("OK", "checkbox", 110) : null;

  // --- Propriétaires : un nom Monday n'est rattaché que s'il est sans ambiguïté ---
  const profiles = must(await admin.from("profiles").select("id, full_name"), "Lecture des profils") as {
    id: string;
    full_name: string | null;
  }[];
  const profileByName = new Map(
    profiles.filter((p) => p.full_name).map((p) => [normalizeLabel(p.full_name), p.id]),
  );
  const ownerOf = (name: string | null) => {
    if (!name) return null;
    const first = name.split(",")[0]!;
    return profileByName.get(normalizeLabel(first)) ?? null;
  };

  // --- Publications ---
  const existingByExternal = new Map(
    existingSubjects.filter((s) => s.external_id).map((s) => [s.external_id!, s]),
  );

  const rows = plan.subjects.map((subject) => {
    const previous = existingByExternal.get(subject.externalId);
    const custom: Record<string, unknown> = { ...(previous?.custom ?? {}) };
    if (commentsColumn) custom[commentsColumn] = subject.comments;
    if (okColumn) custom[okColumn] = subject.ok;

    return {
      lane_id: laneIdByExternal.get(subject.laneExternalId)!,
      month_id: monthIdByKey.get(subject.month)!,
      board_id: board.id,
      workspace_id: workspace.id,
      name: subject.name,
      status: subject.status,
      format: subject.format,
      scheduled_on: subject.scheduledOn,
      wording: subject.wording,
      sponsoring: subject.sponsoring,
      ad_objective: subject.adObjective,
      ad_status: subject.adStatus,
      owner_id: ownerOf(subject.ownerName),
      // Une seconde passe ne doit pas effacer les fichiers déjà rapatriés.
      visual_urls: previous?.visual_urls ?? [],
      position: subject.position,
      external_id: subject.externalId,
      custom,
      deleted_at: null,
    };
  });

  if (rows.some((row) => !row.lane_id || !row.month_id)) fail("Couloir ou mois introuvable après écriture.");

  must(
    await admin
      .from("planning_subjects")
      .upsert(rows as never, { onConflict: "board_id,external_id" }),
    "Écriture des publications",
  );

  const subjectRows = must(
    await admin
      .from("planning_subjects")
      .select("id, external_id, visual_urls")
      .eq("board_id", board.id)
      .not("external_id", "is", null),
    "Relecture des publications",
  ) as { id: string; external_id: string; visual_urls: string[] }[];
  const subjectIdByExternal = new Map(subjectRows.map((row) => [row.external_id, row.id]));

  // --- Ménage : corbeille d'abord, sinon la suppression des couloirs l'emporterait ---
  const firstLaneOfMonth = new Map<string, string>();
  for (const lane of [...plan.lanes].sort((a, b) => a.position - b.position)) {
    if (!firstLaneOfMonth.has(lane.month)) {
      firstLaneOfMonth.set(lane.month, laneIdByExternal.get(lane.externalId)!);
    }
  }
  const trashedAt = new Date().toISOString();
  for (const entry of plan.trashSubjects) {
    const lane = firstLaneOfMonth.get(entry.month)!;
    must(
      await admin
        .from("planning_subjects")
        .update(
          (entry.alreadyTrashed ? { lane_id: lane } : { deleted_at: trashedAt, lane_id: lane }) as never,
        )
        .eq("id", entry.id),
      "Mise à la corbeille",
    );
  }
  if (plan.deleteSubjectIds.length > 0) {
    must(
      await admin.from("planning_subjects").delete().in("id", plan.deleteSubjectIds),
      "Effacement des essais",
    );
  }
  if (plan.deleteLaneIds.length > 0) {
    const left = must(
      await admin.from("planning_subjects").select("id").in("lane_id", plan.deleteLaneIds),
      "Contrôle des couloirs à retirer",
    ) as { id: string }[];
    if (left.length > 0) fail(`${left.length} publications portent encore un couloir à retirer : arrêt.`);
    must(await admin.from("planning_lanes").delete().in("id", plan.deleteLaneIds), "Retrait des couloirs");
  }
  if (plan.orphanVisualPaths.length > 0) {
    const targets = plan.orphanVisualPaths.flatMap((entry) => [entry, `${entry}${PREVIEW_SUFFIX}`]);
    const { error } = await admin.storage.from(VISUALS_BUCKET).remove(targets);
    if (error) console.log(`⚠ Fichiers des essais non retirés : ${error.message}`);
  }
  console.log("✓ Lignes écrites.");

  if (MEDIA) await migrateMedia(admin, workspace.id, plan.subjects, subjectIdByExternal);

  await verify(admin, board.id, plan.subjects, snapshot.excludedMonths);
}

// --- Fichiers ---------------------------------------------------------------

async function migrateMedia(
  admin: Admin,
  workspaceId: string,
  subjects: SubjectDraft[],
  subjectIdByExternal: Map<string, string>,
) {
  const token = process.env.MONDAY_API_TOKEN;
  if (!token) {
    console.log("⚠ MONDAY_API_TOKEN absent : les fichiers restent à rapatrier.");
    process.exitCode = 1;
    return;
  }
  const monday = new Monday(token);
  const workDir = mkdtempSync(path.join(tmpdir(), "reprise-monday-"));
  const budgetBytes = BUDGET_MB ? Number(BUDGET_MB) * 1024 * 1024 : null;

  type Job = { subjectId: string; file: MondayFile; index: number };
  const jobs: Job[] = subjects.flatMap((subject) =>
    subject.files.map((file, index) => ({
      subjectId: subjectIdByExternal.get(subject.externalId)!,
      file,
      index,
    })),
  );

  // Ce qui est déjà au bucket ne repart pas.
  const present = new Set<string>();
  for (const subjectId of new Set(jobs.map((job) => job.subjectId))) {
    for (const entry of await existingObjects(admin, `${workspaceId}/${subjectId}`)) present.add(entry);
  }
  const alreadyThere = (job: Job) =>
    [...present].find(
      (entry) =>
        entry.startsWith(`${workspaceId}/${job.subjectId}/monday-${job.file.assetId}-`) &&
        !entry.endsWith(PREVIEW_SUFFIX),
    ) ?? null;

  const pathByJob = new Map<Job, string>();
  const failures: string[] = [];
  const pending: Job[] = [];
  for (const job of jobs) {
    const found = alreadyThere(job);
    if (found) pathByJob.set(job, found);
    else pending.push(job);
  }
  console.log(`Fichiers : ${jobs.length} au total, ${jobs.length - pending.length} déjà au bucket.`);

  // Téléchargement par lots : l'URL Monday ne vit qu'une heure.
  type Local = { job: Job; file: string; kind: Kind; bytes: number; sha: string };
  const videos: (Local & { probe: VideoProbe })[] = [];
  let imageBytes = 0;

  try {
    for (let start = 0; start < pending.length; start += 20) {
      const batch = pending.slice(start, start + 20);
      const urls = await monday.publicUrls([...new Set(batch.map((job) => job.file.assetId))]);

      for (const job of batch) {
        const label = `${job.file.name} (${job.file.assetId})`;
        try {
          const source = urls.get(job.file.assetId);
          if (!source) throw new Error("asset introuvable chez Monday");
          const bytes = await download(source);
          // Un .mov de QuickTime peut s'ouvrir sur un atome `wide` avant `ftyp` :
          // l'extension tranche alors.
          const kind =
            sniff(bytes) ??
            (isVideoName(job.file.name) ? { ext: "mp4", mime: "video/mp4", video: true } : null);
          if (!kind) throw new Error("type de fichier non reconnu");

          if (kind.video) {
            // Une vidéo recopiée d'un couloir à l'autre (META et TIKTOK) porte
            // les mêmes octets : on ne l'écrit et ne la réencode qu'une fois.
            const sha = createHash("sha256").update(bytes).digest("hex");
            const local = path.join(workDir, sha);
            const known = videos.find((video) => video.sha === sha);
            if (!known) writeFileSync(local, bytes);
            videos.push({
              job,
              file: local,
              kind,
              bytes: bytes.length,
              sha,
              probe: known?.probe ?? probe(local),
            });
            continue;
          }

          const target = storedPath(workspaceId, job.subjectId, job.file, kind.ext);
          await upload(admin, target, bytes, kind.mime);
          if (kind.mime.startsWith("image/") && bytes.length >= PREVIEW_SKIP_BYTES) {
            await upload(admin, `${target}${PREVIEW_SUFFIX}`, await imagePreview(bytes), "image/jpeg");
          }
          imageBytes += bytes.length;
          pathByJob.set(job, target);
        } catch (cause) {
          failures.push(`${label} : ${(cause as Error).message}`);
        }
      }
    }
    console.log(`Images déposées : ${(imageBytes / 1048576).toFixed(1)} Mo.`);

    // Le débit se fixe sur l'ensemble : c'est le total déposé qui doit tenir,
    // copies comprises — chacune occupe sa place au bucket.
    const totalSeconds = videos.reduce((sum, video) => sum + video.probe.durationSeconds, 0);
    const kbps = targetVideoKbps({ totalSeconds, budgetBytes });
    console.log(
      `Vidéos : ${videos.length}, ${(videos.reduce((s, v) => s + v.bytes, 0) / 1048576).toFixed(0)} Mo ` +
        `à l'origine, ${Math.round(totalSeconds)} s, plafond ${kbps} kbit/s.`,
    );

    let videoBytes = 0;
    const encoded = new Set<string>();
    for (const video of videos) {
      const label = `${video.job.file.name} (${video.job.file.assetId})`;
      try {
        const output = `${video.file}.mp4`;
        if (!encoded.has(video.sha)) {
          run(
            "ffmpeg",
            transcodeArgs({
              source: video.file,
              output,
              probe: video.probe,
              videoKbps: capForUploadLimit(kbps, video.probe.durationSeconds),
            }),
          );
          encoded.add(video.sha);
        }
        const size = statSync(output).size;
        if (size > MAX_UPLOAD_BYTES) throw new Error(`encore ${(size / 1048576).toFixed(0)} Mo après réencodage`);

        const renamed = { ...video.job.file, name: transcodedName(video.job.file.name) };
        const target = storedPath(workspaceId, video.job.subjectId, renamed, "mp4");
        await upload(admin, target, readFileSync(output), "video/mp4");
        await upload(admin, `${target}${PREVIEW_SUFFIX}`, videoPoster(output), "image/jpeg");
        pathByJob.set(video.job, target);
        videoBytes += size;
        console.log(
          `  ✓ ${label} ${(video.bytes / 1048576).toFixed(1)} → ${(size / 1048576).toFixed(1)} Mo`,
        );
      } catch (cause) {
        failures.push(`${label} : ${(cause as Error).message}`);
      }
    }
    console.log(`Vidéos déposées : ${(videoBytes / 1048576).toFixed(1)} Mo.`);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }

  // Les chemins dans l'ordre Monday — c'est l'ordre du carrousel.
  const bySubject = new Map<string, string[]>();
  for (const job of jobs) {
    const target = pathByJob.get(job);
    if (!target) continue;
    bySubject.set(job.subjectId, [...(bySubject.get(job.subjectId) ?? []), target]);
  }
  for (const [subjectId, paths] of bySubject) {
    must(
      await admin
        .from("planning_subjects")
        .update({ visual_urls: paths } as never)
        .eq("id", subjectId),
      "Écriture des visuels",
    );
  }

  if (failures.length > 0) {
    console.log(`✗ ${failures.length} fichier(s) non repris :`);
    for (const failure of failures) console.log(`  – ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${jobs.length} fichiers en place.`);
  }
}

// --- Contrôle ---------------------------------------------------------------

/** Relit la base et la compare à l'instantané : « ✓ écrit » ne prouve rien. */
async function verify(
  admin: Admin,
  boardId: string,
  expected: SubjectDraft[],
  excludedMonths: string[],
) {
  const rows = must(
    await admin
      .from("planning_subjects")
      .select("external_id, name, status, wording, sponsoring, scheduled_on, visual_urls, deleted_at, month_id")
      .eq("board_id", boardId)
      .not("external_id", "is", null),
    "Contrôle final",
  ) as {
    external_id: string;
    name: string;
    status: string;
    wording: string | null;
    sponsoring: number | null;
    scheduled_on: string | null;
    visual_urls: string[];
    deleted_at: string | null;
    month_id: string;
  }[];
  const byExternal = new Map(rows.map((row) => [row.external_id, row]));

  const problems: string[] = [];
  for (const subject of expected) {
    const row = byExternal.get(subject.externalId);
    if (!row) problems.push(`absente : ${subject.name}`);
    else if (row.deleted_at) problems.push(`à la corbeille : ${subject.name}`);
    else if (row.name !== subject.name) problems.push(`nom : ${subject.name}`);
    else if (row.status !== subject.status) problems.push(`statut : ${subject.name}`);
    else if ((row.wording ?? null) !== subject.wording) problems.push(`wording : ${subject.name}`);
    else if ((row.scheduled_on ?? null) !== subject.scheduledOn) problems.push(`date : ${subject.name}`);
    else if ((row.sponsoring === null ? null : Number(row.sponsoring)) !== subject.sponsoring) {
      problems.push(`sponsorisation : ${subject.name}`);
    } else if (MEDIA && row.visual_urls.length !== subject.files.length) {
      problems.push(`visuels ${row.visual_urls.length}/${subject.files.length} : ${subject.name}`);
    }
  }

  const months = must(
    await admin.from("planning_months").select("id, month").eq("board_id", boardId),
    "Contrôle des mois",
  ) as { id: string; month: string }[];
  const excludedIds = new Set(months.filter((m) => excludedMonths.includes(m.month)).map((m) => m.id));
  const touchedExcluded = rows.filter((row) => excludedIds.has(row.month_id));
  if (touchedExcluded.length > 0) problems.push(`${touchedExcluded.length} ligne(s) Monday dans un mois exclu`);

  if (problems.length > 0) {
    console.log(`✗ Contrôle : ${problems.length} écart(s)`);
    for (const problem of problems.slice(0, 40)) console.log(`  – ${problem}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ Contrôle : ${expected.length} publications identiques à l'instantané.`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
