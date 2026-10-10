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
const failures = [];
for (const item of LIST.cases) {
  const ext = (item.path ?? item.url).split(/[?#]/)[0].split(".").pop().toLowerCase();
  const src = join(TMP, `${item.out}.${ext}`);
  let bytes = 0;
  try {
    bytes = await download(item, src);
  } catch (error) {
    // Une source refusée (lien Instagram périmé, site qui bloque) ne doit pas
    // priver le passage de tout le reste : on la note et on continue.
    failures.push(`${item.out}: ${error instanceof Error ? error.message : String(error)}`);
    continue;
  }
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

// ---------------------------------------------------------------------------
// Les logos du bandeau. Une entrée nomme sa sortie (`out`) et sa source :
//
//   url          un fichier direct ;
//   urls         plusieurs fichiers, essayés dans l'ordre : le premier qui
//                répond est pris ;
//   pages        des pages du site de la marque, lues sur le runner : les
//                images candidates (img et srcset, svg en ligne, icônes,
//                og:image, toute URL qui contient « logo ») sont listées au
//                journal, et la première qui répond à `pick` (expression
//                régulière, sur l'URL, l'alt, la classe et le contexte) est
//                prise ;
//   commons      une recherche Wikimedia Commons : les fichiers trouvés sont
//                listés au journal, et pris comme une page si `pick` y répond ;
//   bucket/path  le bucket du dashboard.
//
// `candidats: true` dépose en plus, tels quels, les candidats qui parlent de
// logo dans `public/logos/_candidats` : de quoi les regarder avant de choisir.
// Le dossier est vidé à chaque passage — un passage sans candidats l'efface.
//
// Traitement : un SVG est gardé tel quel, c'est la CSS qui le passe en blanc.
// Une image matricielle est rognée ; son fond blanc n'est rendu transparent
// que si elle est opaque — un PNG déjà détouré garde ses blancs, qui sont
// souvent le dessin lui-même (`transparent` force une couleur, ou `none`) —
// puis elle est ramenée à `height` px de haut au plus (240 par défaut : un
// logo de 32 px reste net sur un écran 3x). Une sortie qui change de format
// remplace l'ancienne : la liste fait foi.
// ---------------------------------------------------------------------------
const LOGOS_DIR = join(SITE, "public", "logos");
const CANDIDATES_DIR = join(LOGOS_DIR, "_candidats");
const COMMONS_UA = "antidotes-site-visuels/1.0 (https://antidotes.agency; noreply@antidotes.agency)";
rmSync(CANDIDATES_DIR, { recursive: true, force: true });

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#x2F;|&#47;/gi, "/");
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match ? decodeEntities(match[1] ?? match[2] ?? match[3] ?? "") : "";
}

function absolute(url, base) {
  if (!url || url.startsWith("data:")) return null;
  try {
    return new URL(decodeEntities(url.trim()), base).href;
  } catch {
    return null;
  }
}

function squash(text, max = 160) {
  const flat = text.replace(/\s+/g, " ").replace(/\sd="[^"]{40,}"/g, ' d="…"').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

/** Les images d'une page qui pourraient être un logo, dans l'ordre du HTML. */
async function discover(pageUrl) {
  const response = await fetch(pageUrl, { headers: { "user-agent": UA, accept: "text/html,*/*" }, redirect: "follow" });
  const html = await response.text();
  const base = response.url;
  console.log(`\n— ${pageUrl} → ${response.status} ${base} (${Math.round(html.length / 1024)} Ko)`);
  if (!response.ok) throw new Error(`${response.status} sur ${pageUrl}`);
  const found = [];
  const seen = new Set();
  const push = (kind, url, index, extra = "") => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    const context = html.slice(Math.max(0, index - 220), index).replace(/<script[\s\S]*?<\/script>/gi, "");
    found.push({ kind, url, index, text: `${url} ${extra} ${squash(context, 220)}` });
  };
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const extra = `alt="${attr(tag, "alt")}" class="${attr(tag, "class")}" id="${attr(tag, "id")}" w=${attr(tag, "width")} h=${attr(tag, "height")}`;
    for (const name of ["src", "data-src", "data-lazy-src", "data-original"]) push("img", absolute(attr(tag, name), base), match.index, extra);
    for (const name of ["srcset", "data-srcset"]) {
      for (const part of attr(tag, name).split(/,\s+/)) push("srcset", absolute(part.trim().split(/\s+/)[0], base), match.index, extra);
    }
  }
  for (const match of html.matchAll(/<source\b[^>]*>/gi)) {
    for (const part of attr(match[0], "srcset").split(/,\s+/)) push("source", absolute(part.trim().split(/\s+/)[0], base), match.index);
  }
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    if (/icon|logo/i.test(attr(match[0], "rel"))) push("link", absolute(attr(match[0], "href"), base), match.index, `rel=${attr(match[0], "rel")} sizes=${attr(match[0], "sizes")}`);
  }
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (/og:image|twitter:image|logo/i.test(attr(match[0], "property") + attr(match[0], "name") + attr(match[0], "itemprop"))) {
      push("meta", absolute(attr(match[0], "content"), base), match.index);
    }
  }
  for (const match of html.matchAll(/<svg\b[\s\S]*?<\/svg>/gi)) {
    if (match[0].length < 400) continue; // une icône de menu, pas un logo
    // Un SVG en ligne se passe de xmlns dans le HTML ; seul dans un fichier,
    // il ne s'afficherait plus.
    let svg = match[0];
    if (!/\sxmlns=/.test(svg.slice(0, svg.indexOf(">")))) svg = svg.replace(/^<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    if (/xlink:/.test(svg) && !/xmlns:xlink=/.test(svg)) svg = svg.replace(/^<svg\b/i, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    found.push({
      kind: "svg",
      url: null,
      svg,
      index: match.index,
      text: `${squash(match[0].slice(0, 300), 300)} ${squash(html.slice(Math.max(0, match.index - 220), match.index), 220)}`,
    });
  }
  for (const match of html.matchAll(/["'(]([^"'()\s]*logo[^"'()\s]*\.(?:svg|png|webp|jpe?g|avif)(?:\?[^"'()\s]*)?)/gi)) {
    push("texte", absolute(match[1].replace(/\\\//g, "/"), base), match.index);
  }
  const header = html.match(/<header\b[\s\S]*?<\/header>/i);
  if (header) console.log(`  <header> ${squash(header[0].replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<svg[\s\S]*?<\/svg>/gi, "<svg…/>"), 900)}`);
  found.sort((a, b) => a.index - b.index);
  found.slice(0, 45).forEach((item, n) => {
    const where = item.svg ? `svg en ligne (${Math.round(item.svg.length / 1024)} Ko)` : item.url;
    console.log(`  [${n}] ${item.kind} ${where} | ${squash(item.text, 260)}`);
  });
  return found.map((item) => ({ ...item, referer: base }));
}

/** Les fichiers de Wikimedia Commons qui répondent à une recherche. */
async function searchCommons(term) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=20&gsrsearch=${encodeURIComponent(term)}&prop=imageinfo&iiprop=url|size|mime`;
  const response = await fetch(api, { headers: { "user-agent": COMMONS_UA } });
  if (!response.ok) throw new Error(`${response.status} sur Commons (${term})`);
  const pages = Object.values((await response.json()).query?.pages ?? {}).sort((a, b) => a.index - b.index);
  console.log(`\n— Commons « ${term} » : ${pages.length} fichier(s)`);
  return pages.map((page, n) => {
    const info = page.imageinfo?.[0] ?? {};
    console.log(`  [${n}] ${page.title} ${info.width}×${info.height} ${info.mime} ${info.url}`);
    return { kind: "commons", url: info.url, index: n, text: `${info.url} ${page.title}`, ua: COMMONS_UA };
  });
}

function sniffSvg(bytes) {
  const head = bytes.subarray(0, 1024).toString("utf8");
  return /<svg[\s>]/i.test(head) || (/^\s*<\?xml/i.test(head) && bytes.toString("utf8").includes("<svg"));
}

async function fetchBytes(url, { referer, ua } = {}) {
  const headers = { "user-agent": ua ?? UA, accept: "image/svg+xml,image/*,*/*" };
  if (referer) headers.referer = referer;
  const response = await fetch(url, { headers, redirect: "follow" });
  if (!response.ok) throw new Error(`${response.status} sur ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

function message(error) {
  return error instanceof Error ? error.message : String(error);
}

/** La source d'un logo, en octets : fichier direct, liste, page ou Commons. */
async function resolveLogo(logo) {
  if (logo.bucket) {
    const src = join(TMP, `${logo.out}.source`);
    await download(logo, src);
    return { bytes: readFileSync(src), from: `${logo.bucket}/${logo.path}` };
  }
  const errors = [];
  for (const url of logo.urls ?? (logo.url ? [logo.url] : [])) {
    try {
      return { bytes: await fetchBytes(url, { ua: /wikimedia\.org/.test(url) ? COMMONS_UA : UA }), from: url };
    } catch (error) {
      errors.push(message(error));
    }
  }
  const found = [];
  for (const page of logo.pages ?? []) {
    try {
      found.push(...(await discover(page)));
    } catch (error) {
      errors.push(message(error));
    }
  }
  if (logo.commons) {
    try {
      found.push(...(await searchCommons(logo.commons)));
    } catch (error) {
      errors.push(message(error));
    }
  }
  if (logo.candidats) {
    mkdirSync(CANDIDATES_DIR, { recursive: true });
    let saved = 0;
    for (const item of found.filter((entry) => /logo|marque|brand/i.test(entry.text))) {
      if (saved >= 12) break;
      try {
        const bytes = item.svg ? Buffer.from(item.svg) : await fetchBytes(item.url, item);
        if (bytes.length > 1_500_000) continue;
        const ext = item.svg || sniffSvg(bytes) ? "svg" : (item.url.split(/[?#]/)[0].split(".").pop() || "bin").toLowerCase().slice(0, 4);
        const name = `${logo.out}-${String(saved).padStart(2, "0")}.${ext}`;
        writeFileSync(join(CANDIDATES_DIR, name), bytes);
        console.log(`  candidat ${name} ← ${item.svg ? "svg en ligne" : item.url}`);
        saved += 1;
      } catch (error) {
        console.log(`  candidat refusé : ${message(error)}`);
      }
    }
  }
  if (logo.pick) {
    const pattern = new RegExp(logo.pick, "i");
    for (const item of found.filter((entry) => pattern.test(entry.text))) {
      try {
        if (item.svg) return { bytes: Buffer.from(item.svg), from: `svg en ligne de ${item.referer}` };
        return { bytes: await fetchBytes(item.url, item), from: item.url };
      } catch (error) {
        errors.push(message(error));
      }
    }
    errors.push(`aucun candidat ne répond à /${logo.pick}/`);
  }
  throw new Error(errors.join(" ; ") || "aucune source");
}

for (const logo of LIST.logos) {
  let source;
  try {
    source = await resolveLogo(logo);
  } catch (error) {
    failures.push(`${logo.out}: ${message(error)}`);
    continue;
  }
  const target = join(LOGOS_DIR, logo.out);
  if (sniffSvg(source.bytes)) {
    // Un SVG se garde tel quel : c'est la CSS qui le passe en monochrome.
    rmSync(`${target}.png`, { force: true });
    writeFileSync(`${target}.svg`, source.bytes);
    const svg = source.bytes.toString("utf8");
    const box = svg.match(/viewBox\s*=\s*"([^"]*)"/i)?.[1] ?? "?";
    const colours = [...new Set(svg.match(/#[0-9a-f]{3,8}\b|rgb\([^)]*\)/gi) ?? [])].slice(0, 8).join(" ");
    report.push(`${logo.out}: svg ${Math.round(source.bytes.length / 1024)} Ko, viewBox ${box}, couleurs ${colours || "—"} ← ${source.from}`);
  } else {
    const src = join(TMP, `${logo.out}.raster`);
    writeFileSync(src, source.bytes);
    const opaque = execFileSync("identify", ["-format", "%[opaque]", `${src}[0]`]).toString().trim().toLowerCase() === "true";
    const knockout = logo.transparent ?? (opaque ? "white" : "none");
    const args = [`${src}[0]`, "-auto-orient"];
    if (knockout !== "none") args.push("-fuzz", `${logo.fuzz ?? 8}%`, "-transparent", knockout);
    args.push("-trim", "+repage", "-resize", `x${logo.height ?? 240}>`, "-strip", `${target}.png`);
    rmSync(`${target}.svg`, { force: true });
    run("convert", args);
    const size = execFileSync("identify", ["-format", "%wx%h", `${target}.png`]).toString().trim();
    report.push(`${logo.out}: ${opaque ? "opaque" : "détouré"}, fond ${knockout} → png ${size}, ${sizeOf(`${target}.png`)} Ko ← ${source.from}`);
  }
}

rmSync(TMP, { recursive: true, force: true });
console.log(report.join("\n"));
if (failures.length > 0) console.log("\nRefusés :\n" + failures.join("\n"));
if (report.length === 0) throw new Error("aucun visuel rapatrié");
