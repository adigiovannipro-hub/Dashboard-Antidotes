// Rapatrie les visuels des cas clients et les logos du marquee dans
// site/public, depuis le bucket privé du dashboard (planning-visuals,
// workspace-logos) et depuis les sites des clients. Tourne sur un runner
// GitHub (.github/workflows/site-visuels.yml) : le bac à sable de
// développement ne joint ni Supabase ni ces sites, et un visuel ne doit
// jamais transiter par une conversation.
//
// Aucune dépendance : fetch de Node 22, ImageMagick et ffmpeg du runner.
// Les sorties sont légères par construction : images en WebP à 720 px de
// large au plus, vidéos en extraits muets de six secondes en 540p H.264,
// affiche extraite à la première seconde. Un visuel déjà présent est
// recalculé à chaque passage : la liste fait foi.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = join(HERE, "..");
const LIST = JSON.parse(readFileSync(join(HERE, "visuels.json"), "utf8"));
const TMP = join(HERE, ".visuels-tmp");
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis");

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

async function download(source, target) {
  const response = source.bucket
    ? await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/${source.bucket}/${source.path}`, {
        headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` },
      })
    : await fetch(source.url, { headers: { "user-agent": UA, accept: "*/*" }, redirect: "follow" });
  if (!response.ok) throw new Error(`${response.status} sur ${source.bucket ? source.path : source.url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  writeFileSync(target, bytes);
  return bytes.length;
}

function run(cmd, args) {
  execFileSync(cmd, args, { stdio: ["ignore", "inherit", "inherit"] });
}

function sizeOf(path) {
  return existsSync(path) ? Math.round(statSync(path).size / 1024) : 0;
}

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(join(SITE, "public", "cas"), { recursive: true });
mkdirSync(join(SITE, "public", "logos"), { recursive: true });

const report = [];
for (const item of LIST.cases) {
  const ext = (item.path ?? item.url).split(/[?#]/)[0].split(".").pop().toLowerCase();
  const src = join(TMP, `${item.out}.${ext}`);
  const bytes = await download(item, src);
  const base = join(SITE, "public", "cas", item.out);
  if (item.kind === "video") {
    // Affiche à t = 1 s, puis extrait muet : ce qu'un téléphone dans la page
    // montre en boucle, sans que personne n'attende un chargement.
    run("ffmpeg", ["-y", "-loglevel", "error", "-ss", "1", "-i", src, "-frames:v", "1", "-vf", "scale=720:-2", "-q:v", "80", `${base}.webp`]);
    run("ffmpeg", [
      "-y", "-loglevel", "error", "-ss", String(item.start ?? 0.5), "-t", String(item.seconds ?? 6), "-i", src,
      "-vf", "scale=540:-2:flags=lanczos,fps=24", "-an", "-c:v", "libx264", "-profile:v", "main", "-pix_fmt", "yuv420p",
      "-crf", "30", "-preset", "slow", "-movflags", "+faststart", `${base}.mp4`,
    ]);
    report.push(`${item.out}: source ${Math.round(bytes / 1024)} Ko → affiche ${sizeOf(`${base}.webp`)} Ko, extrait ${sizeOf(`${base}.mp4`)} Ko`);
  } else {
    run("convert", [`${src}[0]`, "-auto-orient", "-resize", "720x>", "-strip", "-quality", "82", `${base}.webp`]);
    report.push(`${item.out}: source ${Math.round(bytes / 1024)} Ko → ${sizeOf(`${base}.webp`)} Ko`);
  }
}

for (const logo of LIST.logos) {
  const ext = (logo.path ?? logo.url).split(/[?#]/)[0].split(".").pop().toLowerCase();
  const src = join(TMP, `${logo.out}.${ext}`);
  const bytes = await download(logo, src);
  const target = join(SITE, "public", "logos", logo.out);
  if (ext === "svg") {
    // Un SVG se garde tel quel : c'est la CSS qui le passe en monochrome.
    writeFileSync(`${target}.svg`, readFileSync(src));
    report.push(`${logo.out}: svg ${Math.round(bytes / 1024)} Ko`);
  } else {
    // Fond blanc rendu transparent, hauteur 160 px : le marquee le peint
    // en blanc par filtre CSS, un fond opaque ferait un pavé.
    run("convert", [src, "-auto-orient", "-fuzz", `${logo.fuzz ?? 8}%`, "-transparent", "white", "-trim", "+repage", "-resize", "x160", "-strip", `${target}.png`]);
    report.push(`${logo.out}: ${ext} ${Math.round(bytes / 1024)} Ko → png ${sizeOf(`${target}.png`)} Ko`);
  }
}

rmSync(TMP, { recursive: true, force: true });
console.log(report.join("\n"));
