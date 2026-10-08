/**
 * Les meilleurs reels Instagram d'un client, en vignettes et en extraits pour
 * le site vitrine — par la Graph API, avec le jeton rangé dans la base.
 *
 *   pnpm visuels:iway                                  # espace i-way
 *   pnpm visuels:iway --espace i-way --nombre 5 --mois 12
 *
 * Pourquoi par l'API et non par une liste d'URL : les liens `cdninstagram.com`
 * collés dans `site/scripts/visuels.json` sont signés et périment en quelques
 * jours — les quatre vignettes d'I-WAY sont tombées en 403 au premier
 * passage. Le jeton du compte, lui, est renouvelé par le branchement, et
 * `/{ig-user}/media` rend pour chaque reel une vignette et le fichier vidéo.
 *
 * Ce que le passage fait, dans l'ordre :
 *
 *   1. retrouve l'espace par son slug ou son nom, le compte Instagram qui lui
 *      est affecté dans Connexions, et déchiffre son jeton ;
 *   2. liste les médias des douze derniers mois (pagination `paging.next`
 *      suivie telle quelle) et ne garde que les reels ;
 *   3. classe par **vues** — lues dans `social_posts`, ce que le Reporting a
 *      déjà relevé ; un reel que la base ne connaît pas est demandé à
 *      `/{media}/insights?metric=views` — et retient le reel phare (F1) plus
 *      les N meilleurs ;
 *   4. produit pour chacun `site/public/cas/iway-<slug>.webp` (720 px de
 *      large) et `iway-<slug>.mp4` (six secondes muettes en 540p H.264,
 *      les mêmes réglages que `site/scripts/visuels-cas.mjs`) ;
 *   5. écrit `site/public/cas/iway.json` — slug, shortcode, permalien, date,
 *      vues, j'aime, commentaires, fichiers produits — pour que le site
 *      étiquette ses mockups avec de vrais chiffres.
 *
 * Un reel refusé (vignette périmée, vidéo que Meta ne rend pas) ne fait pas
 * tomber le passage : il est compté, et le passage n'échoue que si rien n'a
 * été produit. **Aucun jeton n'est jamais imprimé** : ni URL de Graph (le
 * jeton est dans la requête), ni `paging.next` (il le porte aussi), ni lien
 * de média (signé). Les messages d'erreur passent par `redact` par ceinture.
 *
 * Outils du runner : ffmpeg (et ffprobe), ImageMagick (`convert`, `identify`).
 * Variables requises : NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY, CREDENTIALS_ENCRYPTION_KEY.
 */
import dotenv from "dotenv";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

dotenv.config({ path: ".env.local", quiet: true });

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CREDENTIALS_ENCRYPTION_KEY",
] as const;

/**
 * Les reels à prendre **quoi qu'il arrive**, avec le slug qu'on leur donne :
 * le reel F1 du 16 octobre 2025 est celui dont le site cite les 241 918 vues.
 * Les autres reçoivent un slug tiré de leur légende, ou de leur shortcode.
 */
const PINNED: Record<string, string> = { DP3YuJ7DqJ_: "f1" };

/** Préfixe de tous les fichiers produits : `iway-f1.webp`, `iway-f1.mp4`. */
const PREFIX = "iway";

/** Le même budget qu'un appel du connecteur ; jamais rejoué. */
const GRAPH_TIMEOUT_MS = 45_000;

/** Au-delà, on considère que la pagination boucle. */
const MAX_PAGES = 30;

/** Combien de reels inconnus de la base on redemande à Graph, au plus. */
const MAX_VIEWS_LOOKUPS = 80;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

/** Mots sans relief d'une légende, qu'un slug ne reprend pas. */
const STOP_WORDS = new Set([
  "les", "des", "une", "pour", "avec", "vous", "nous", "dans", "sur", "chez",
  "que", "qui", "pas", "plus", "est", "the", "and", "your", "you", "notre",
  "votre", "vos", "nos", "tout", "tous", "toute", "toutes", "cette", "mais",
  "aussi", "comme", "sont", "ont", "par", "aux", "ces", "son", "ses", "leur",
  "leurs", "elle", "ils", "elles", "quand", "sans", "bien", "très", "tres",
  "iway", "way", "ici", "lyon", "paris", "venez", "vite", "moment", "jour",
]);

type MediaRow = {
  id: string;
  shortcode?: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
};

type GraphError = { error?: { message?: string; code?: number } };
type GraphPage = GraphError & { data?: MediaRow[]; paging?: { next?: string } };
type GraphInsights = GraphError & {
  data?: { name?: string; values?: { value?: number }[] }[];
};

type KnownPost = {
  external_id: string;
  permalink: string | null;
  impressions: number;
  video_views: number;
  likes: number;
  comments: number;
};

type Candidate = {
  row: MediaRow;
  shortcode: string;
  views: number | null;
  pinned: boolean;
};

type Produced = {
  slug: string;
  shortcode: string;
  permalink: string | null;
  timestamp: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  image: string | null;
  video: string | null;
};

class GraphRefusal extends Error {
  constructor(
    message: string,
    readonly code: number | null,
    readonly status: number,
  ) {
    super(message);
    this.name = "GraphRefusal";
  }
}

function argValue(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  const value = index === -1 ? null : (process.argv[index + 1] ?? null);
  return value && !value.startsWith("--") ? value : null;
}

/** Ceinture : rien de ce qui s'imprime ne doit porter un jeton ou un lien signé. */
function redact(text: string): string {
  return text
    .replace(/(access_token|input_token)=[^&"\\\s]+/g, "$1=…")
    .replace(/"access_token"\s*:\s*"[^"]+"/g, '"access_token":"…"')
    .replace(/https?:\/\/[^\s"']+/g, "<url>");
}

function describe(error: unknown): string {
  return redact(error instanceof Error ? error.message : String(error));
}

/**
 * Un appel Graph, un seul — borné, jamais rejoué. L'URL ne figure dans
 * aucune erreur : elle porte le jeton.
 */
async function askGraph<T extends GraphError>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GRAPH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const payload = (await response.json().catch(() => ({}))) as T;
    if (!response.ok || payload.error) {
      throw new GraphRefusal(
        payload.error?.message ?? `Appel Meta refusé (${response.status}).`,
        payload.error?.code ?? null,
        response.status,
      );
    }
    return payload;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new GraphRefusal(
        `Meta n'a pas répondu en ${GRAPH_TIMEOUT_MS / 1000} s (timeout).`,
        null,
        504,
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function graphUrl(
  base: string,
  pathname: string,
  params: Record<string, string>,
): string {
  const url = new URL(`${base}${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

/** Le shortcode d'un média : le champ, sinon le permalien (`/reel/<code>/`). */
function shortcodeOf(row: MediaRow): string | null {
  if (row.shortcode) return row.shortcode;
  const match = /\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/.exec(row.permalink ?? "");
  return match?.[1] ?? null;
}

function isReel(row: MediaRow): boolean {
  return row.media_product_type === "REELS" || row.media_type === "VIDEO";
}

/**
 * Tous les médias depuis `since`, plus loin s'il le faut pour atteindre les
 * reels épinglés. `shortcode` est demandé d'abord ; si Meta refuse le champ
 * (code 100, « nonexisting field »), on redemande sans lui et le permalien
 * le donne — un champ inconnu fait tomber l'appel entier, jamais un champ
 * vide.
 */
async function listMedia(options: {
  base: string;
  igUserId: string;
  accessToken: string;
  since: string;
  pinned: Set<string>;
}): Promise<MediaRow[]> {
  const fieldsWith =
    "id,shortcode,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count";
  const fieldsWithout = fieldsWith.replace("shortcode,", "");

  const firstUrl = (fields: string) =>
    graphUrl(options.base, `/${options.igUserId}/media`, {
      access_token: options.accessToken,
      fields,
      limit: "100",
    });

  let url: string | undefined = firstUrl(fieldsWith);
  let first: GraphPage;
  try {
    first = await askGraph<GraphPage>(url);
  } catch (error) {
    if (error instanceof GraphRefusal && error.code === 100) {
      console.log("  (champ shortcode refusé par Graph — relu sans lui, le permalien le donne)");
      url = firstUrl(fieldsWithout);
      first = await askGraph<GraphPage>(url);
    } else {
      throw error;
    }
  }

  const rows: MediaRow[] = [];
  const pending = new Set(options.pinned);
  let page: GraphPage = first;
  for (let n = 0; n < MAX_PAGES; n += 1) {
    const items = page.data ?? [];
    rows.push(...items);
    for (const item of items) {
      const code = shortcodeOf(item);
      if (code) pending.delete(code);
    }
    const oldest = items.at(-1)?.timestamp?.slice(0, 10);
    const beyondWindow = !oldest || oldest < options.since;
    if ((beyondWindow && pending.size === 0) || !page.paging?.next) break;
    page = await askGraph<GraphPage>(page.paging.next);
  }

  if (pending.size > 0) {
    console.log(`  ⚠ reels épinglés introuvables dans le fil : ${[...pending].join(", ")}`);
  }
  return rows;
}

/** Les vues d'un média que la base ne connaît pas, demandées à Graph. */
async function fetchViews(
  base: string,
  mediaId: string,
  accessToken: string,
): Promise<number | null> {
  const payload = await askGraph<GraphInsights>(
    graphUrl(base, `/${mediaId}/insights`, { access_token: accessToken, metric: "views" }),
  );
  const value = payload.data?.[0]?.values?.[0]?.value;
  return typeof value === "number" ? value : null;
}

/**
 * Un slug lisible tiré de la légende : deux mots de trois lettres au moins,
 * sans mot creux, sans accent — « Le simulateur F1 arrive à Lyon » devient
 * `simulateur-arrive`. Faute de légende exploitable, le shortcode.
 */
function slugFromCaption(caption: string | undefined): string | null {
  if (!caption) return null;
  const words = caption
    .replace(/#\S+|@\S+|https?:\/\/\S+/g, " ")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
  if (words.length === 0) return null;
  return words.slice(0, 2).join("-");
}

function uniqueSlug(base: string, taken: Set<string>): string {
  let slug = base;
  for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${n}`;
  taken.add(slug);
  return slug;
}

async function download(url: string, target: string): Promise<number> {
  const response = await fetch(url, {
    headers: { "user-agent": UA, accept: "*/*" },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`téléchargement refusé (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  writeFileSync(target, bytes);
  return bytes.length;
}

function run(cmd: string, args: string[]): void {
  const result = spawnSync(cmd, args, { stdio: ["ignore", "inherit", "inherit"] });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${cmd} a rendu ${result.status}`);
}

function capture(cmd: string, args: string[]): string | null {
  const result = spawnSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return result.status === 0 ? result.stdout.trim() : null;
}

function kilo(file: string): number {
  return existsSync(file) ? Math.round(statSync(file).size / 1024) : 0;
}

function dimensionsOf(file: string): string {
  if (file.endsWith(".webp")) return capture("identify", ["-format", "%wx%h", file]) ?? "?";
  return (
    capture("ffprobe", [
      "-v", "error", "-select_streams", "v:0",
      "-show_entries", "stream=width,height", "-of", "csv=s=x:p=0", file,
    ]) ?? "?"
  );
}

async function main() {
  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    console.error(`Variables absentes : ${missing.join(", ")}.`);
    process.exit(1);
  }

  const label = argValue("espace") ?? "i-way";
  const wanted = Math.max(1, Number(argValue("nombre") ?? "5") || 5);
  const months = Math.max(1, Number(argValue("mois") ?? "12") || 12);
  const outDir = path.resolve(argValue("sortie") ?? path.join("site", "public", "cas"));

  /* `||` et non `??` : le workflow passe la variable vide quand le champ
     n'est pas rempli, et une chaîne vide fabriquerait une URL sans version. */
  const version = argValue("version") || process.env.META_GRAPH_VERSION || "v21.0";
  const base = `https://graph.facebook.com/${version}`;

  const sinceDate = new Date();
  sinceDate.setUTCMonth(sinceDate.getUTCMonth() - months);
  const since = sinceDate.toISOString().slice(0, 10);

  const { createAdminClient } = await import("../src/lib/supabase/server");
  const { decryptSecret } = await import("../src/lib/moderation/crypto");
  const { findWorkspaceByLabel } = await import("../src/lib/workspaces/lookup");

  const admin = createAdminClient();

  const { data: workspaces, error: workspacesError } = await admin
    .from("workspaces")
    .select("id, slug, name");
  if (workspacesError) {
    console.error(`Lecture des espaces : ${workspacesError.message}`);
    process.exit(1);
  }
  const known = (workspaces ?? []) as unknown as { id: string; slug: string; name: string }[];
  const workspace = findWorkspaceByLabel(label, known);
  if (!workspace) {
    console.error(
      `Espace « ${label} » introuvable. Connus : ${known.map((w) => w.slug).join(", ")}.`,
    );
    process.exit(1);
  }

  const { data: link, error: linkError } = await admin
    .from("workspace_social_accounts")
    .select("account_id")
    .eq("workspace_id", workspace.id)
    .eq("kind", "instagram")
    .maybeSingle();
  if (linkError) {
    console.error(`Lecture des affectations : ${linkError.message}`);
    process.exit(1);
  }
  const accountId = (link as { account_id?: string } | null)?.account_id;
  if (!accountId) {
    console.error(`Aucun compte Instagram affecté à l'espace ${workspace.slug}.`);
    process.exit(1);
  }

  const { data: account } = await admin
    .from("social_accounts")
    .select("external_id, display_name")
    .eq("id", accountId)
    .single();
  const compte = account as unknown as { external_id: string; display_name: string | null } | null;
  if (!compte) {
    console.error(`Compte Instagram ${accountId} introuvable.`);
    process.exit(1);
  }

  const { data: secret } = await admin
    .from("social_account_secrets")
    .select("credentials_encrypted")
    .eq("account_id", accountId)
    .maybeSingle();
  const blob = (secret as { credentials_encrypted?: string } | null)?.credentials_encrypted;
  if (!blob) {
    console.error("Aucun jeton enregistré pour ce compte — rebrancher Meta depuis Connexions.");
    process.exit(1);
  }
  const accessToken = decryptSecret(blob);

  console.log(
    `Graph ${version} — espace ${workspace.slug} · Instagram ${compte.display_name ?? compte.external_id} — reels depuis ${since}`,
  );

  // Ce que le Reporting a déjà relevé : c'est là que vivent les vues.
  const { data: posts, error: postsError } = await admin
    .from("social_posts")
    .select("external_id, permalink, impressions, video_views, likes, comments")
    .eq("workspace_id", workspace.id)
    .eq("platform", "instagram")
    .order("published_at", { ascending: false })
    .limit(1000);
  if (postsError) {
    console.error(`Lecture de social_posts : ${postsError.message}`);
    process.exit(1);
  }
  const knownById = new Map<string, KnownPost>();
  const knownByCode = new Map<string, KnownPost>();
  for (const post of (posts ?? []) as unknown as KnownPost[]) {
    const previous = knownById.get(post.external_id);
    if (previous && Math.max(previous.video_views, previous.impressions) >= Math.max(post.video_views, post.impressions)) {
      continue;
    }
    knownById.set(post.external_id, post);
    const code = /\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/.exec(post.permalink ?? "")?.[1];
    if (code) knownByCode.set(code, post);
  }
  console.log(`  ${knownById.size} publication(s) Instagram connue(s) de la base`);

  const pinned = new Set(Object.keys(PINNED));
  let rows: MediaRow[];
  try {
    rows = await listMedia({ base, igUserId: compte.external_id, accessToken, since, pinned });
  } catch (error) {
    console.error(`Listing des médias refusé : ${describe(error)}`);
    process.exit(1);
  }
  console.log(`  ${rows.length} média(s) lu(s) de Graph`);

  const candidates: Candidate[] = [];
  let lookups = 0;
  for (const row of rows) {
    if (!isReel(row)) continue;
    const shortcode = shortcodeOf(row);
    if (!shortcode) continue;
    const isPinned = pinned.has(shortcode);
    const inWindow = (row.timestamp?.slice(0, 10) ?? "") >= since;
    if (!isPinned && !inWindow) continue;

    const knownPost = knownById.get(row.id) ?? knownByCode.get(shortcode);
    let views: number | null = knownPost ? Math.max(knownPost.video_views, knownPost.impressions) : null;
    if (views === null && lookups < MAX_VIEWS_LOOKUPS) {
      lookups += 1;
      try {
        views = await fetchViews(base, row.id, accessToken);
      } catch (error) {
        console.log(`  (vues de ${shortcode} non rendues : ${describe(error)})`);
      }
    }
    candidates.push({ row, shortcode, views, pinned: isPinned });
  }
  console.log(
    `  ${candidates.length} reel(s) candidat(s), dont ${lookups} dont les vues ont été demandées à Graph`,
  );

  const byViews = (a: Candidate, b: Candidate) =>
    (b.views ?? -1) - (a.views ?? -1) ||
    (b.row.like_count ?? 0) - (a.row.like_count ?? 0);
  const chosen = [
    ...candidates.filter((c) => c.pinned).sort(byViews),
    ...candidates.filter((c) => !c.pinned).sort(byViews).slice(0, wanted),
  ];
  if (chosen.length === 0) {
    console.error("Aucun reel à produire.");
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });
  const tmp = mkdtempSync(path.join(tmpdir(), "visuels-iway-"));
  const taken = new Set<string>();
  const produced: Produced[] = [];
  const failures: string[] = [];
  const report: string[] = [];

  try {
    for (const candidate of chosen) {
      const { row, shortcode } = candidate;
      const slug = uniqueSlug(
        PINNED[shortcode] ?? slugFromCaption(row.caption) ?? shortcode.toLowerCase(),
        taken,
      );
      const name = `${PREFIX}-${slug}`;
      const image = path.join(outDir, `${name}.webp`);
      const video = path.join(outDir, `${name}.mp4`);
      const srcVideo = path.join(tmp, `${name}.mp4`);
      const srcImage = path.join(tmp, `${name}.jpg`);
      let hasVideo = false;
      let hasImage = false;

      // La vidéo d'abord : si la vignette manque, c'est d'elle qu'on la tire.
      if (row.media_url) {
        try {
          const bytes = await download(row.media_url, srcVideo);
          run("ffmpeg", [
            "-y", "-loglevel", "error", "-ss", "0.5", "-t", "6", "-i", srcVideo,
            "-vf", "scale=540:-2:flags=lanczos,fps=24", "-an", "-c:v", "libx264",
            "-profile:v", "main", "-pix_fmt", "yuv420p", "-crf", "30", "-preset", "slow",
            "-movflags", "+faststart", video,
          ]);
          hasVideo = true;
          report.push(`${name}.mp4 : source ${Math.round(bytes / 1024)} Ko → ${kilo(video)} Ko, ${dimensionsOf(video)}`);
        } catch (error) {
          failures.push(`${name} (vidéo, ${shortcode}) : ${describe(error)}`);
        }
      } else {
        failures.push(`${name} (vidéo, ${shortcode}) : Meta ne rend pas media_url`);
      }

      try {
        if (row.thumbnail_url) {
          await download(row.thumbnail_url, srcImage);
          run("convert", [`${srcImage}[0]`, "-auto-orient", "-resize", "720x>", "-strip", "-quality", "82", image]);
        } else if (hasVideo) {
          run("ffmpeg", ["-y", "-loglevel", "error", "-ss", "1", "-i", srcVideo, "-frames:v", "1", "-vf", "scale=720:-2", "-q:v", "80", image]);
        } else {
          throw new Error("ni thumbnail_url ni vidéo");
        }
        hasImage = true;
        report.push(`${name}.webp : ${kilo(image)} Ko, ${dimensionsOf(image)}`);
      } catch (error) {
        failures.push(`${name} (vignette, ${shortcode}) : ${describe(error)}`);
      }

      if (!hasImage && !hasVideo) continue;
      produced.push({
        slug,
        shortcode,
        permalink: row.permalink ?? null,
        timestamp: row.timestamp ?? null,
        views: candidate.views,
        likes: row.like_count ?? null,
        comments: row.comments_count ?? null,
        image: hasImage ? `${name}.webp` : null,
        video: hasVideo ? `${name}.mp4` : null,
      });
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  if (produced.length > 0) {
    writeFileSync(path.join(outDir, `${PREFIX}.json`), `${JSON.stringify(produced, null, 2)}\n`);
    report.push(`${PREFIX}.json : ${produced.length} reel(s)`);
  }

  console.log(`\n${report.join("\n")}`);
  if (failures.length > 0) console.log(`\nRefusés :\n${failures.join("\n")}`);
  if (produced.length === 0) {
    console.error("\nAucun visuel produit.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(describe(error));
  process.exit(1);
});
