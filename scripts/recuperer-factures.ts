/**
 * Le passage de récupération des factures — sur le Mac, jamais sur Vercel.
 *
 *   pnpm factures:connexion <lien>   ouvre le navigateur du passage sur le
 *                                    site d'un fournisseur, pour s'y connecter
 *                                    une fois ; la session reste dans le profil
 *   pnpm factures:passage            le passage du jour : demande au dashboard
 *                                    quelles factures chercher, les télécharge,
 *                                    les dépose au dashboard qui les envoie à
 *                                    Airwallex
 *   pnpm factures:installer          planifie le passage chaque matin à 9 h,
 *                                    en fond, par launchd — à faire une fois
 *   pnpm factures:desinstaller       retire cette planification
 *
 * Pourquoi ici et pas dans le dashboard : une fonction Vercel n'a pas de
 * navigateur qui garde ses sessions d'une exécution à l'autre, et c'est la
 * session ouverte chez le fournisseur qui donne accès aux factures. Le profil
 * de navigateur vit dans `~/.antidotes/factures/navigateur`, le journal à
 * côté. Le dashboard reste la source de vérité : liens, dates de prélèvement,
 * état du mois. Ce script ne décide rien, il exécute.
 *
 * Le passage ne fait qu'une requête au dashboard par jour ; le navigateur ne
 * s'ouvre que pour un fournisseur dont le prélèvement du mois date de la
 * veille ou avant — c'est le dashboard qui le dit.
 *
 * Aucun secret de messagerie ici : le PDF est déposé au dashboard, qui l'envoie
 * depuis la boîte Gmail déjà connectée aux Reçus. Seul `CRON_SECRET` — celui
 * de Vercel — est nécessaire, avec l'adresse du dashboard.
 */
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { chromium, type BrowserContext, type Locator, type Page } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

const HOME = process.env.FACTURES_HOME ?? path.join(homedir(), ".antidotes", "factures");
const PROFILE_DIR = path.join(HOME, "navigateur");
const JOURNAL_DIR = path.join(HOME, "journal");
const LABEL = "com.antidotes.recuperer-factures";
const PLIST = path.join(homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);
const PASSAGE_HOUR = 9;

const PDF_MAGIC = "%PDF-";
const MIN_PDF_BYTES = 1024;
/* Ce qui, sur une page de fournisseur, désigne une facture ou son
   téléchargement — en français et en anglais, les deux langues des sites
   qu'on rencontre. */
const INVOICE_WORDS = /facture|invoice|receipt|re[cç]u|t[ée]l[ée]charger|download|\.pdf/i;
const LOGIN_URL = /login|signin|sign-in|log-in|auth|sso|connexion|password|passwd|ims\/|account\.adobe\.com\/[^?]*\/(login|signin)/i;

const run = promisify(execFile);

type PdfFile = { fileName: string; content: Buffer };

export type Source = {
  id: string;
  merchant: string;
  source_link: string;
  reason_label: string;
  due_on: string | null;
};

type ScheduleEntry = Source & { due: boolean };

function log(line: string): void {
  const stamp = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
  console.log(`[${stamp}] ${line}`);
}

function config(): { url: string; secret: string } {
  const url = (process.env.FACTURES_DASHBOARD_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "")
    .trim()
    .replace(/\/+$/, "");
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  const missing = [
    !url && "FACTURES_DASHBOARD_URL (l'adresse de ton dashboard en ligne)",
    !secret && "CRON_SECRET (le même que sur Vercel)",
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(`Il manque dans .env.local : ${missing.join(", ")}.`);
  }
  return { url, secret };
}

async function api<T>(
  method: "GET" | "POST" | "PATCH",
  route: string,
  body?: BodyInit,
  contentType?: string,
): Promise<T> {
  const { url, secret } = config();
  const headers: Record<string, string> = { Authorization: `Bearer ${secret}` };
  if (contentType) headers["Content-Type"] = contentType;
  const response = await fetch(`${url}${route}`, { method, headers, body });
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = null;
  }
  if (response.status === 401) {
    throw new Error("Le dashboard refuse le secret : CRON_SECRET de .env.local n'est pas celui de Vercel.");
  }
  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : text.slice(0, 200);
    throw new Error(`${method} ${route} → ${response.status} : ${detail}`);
  }
  return payload as T;
}

// --- Le navigateur -----------------------------------------------------------

export async function openBrowser(headless: boolean): Promise<BrowserContext> {
  await mkdir(PROFILE_DIR, { recursive: true });
  await mkdir(JOURNAL_DIR, { recursive: true });
  return chromium.launchPersistentContext(PROFILE_DIR, {
    headless,
    acceptDownloads: true,
    viewport: headless ? { width: 1440, height: 1000 } : null,
    locale: "fr-FR",
  });
}

async function looksLikeLogin(page: Page): Promise<boolean> {
  if (LOGIN_URL.test(page.url())) return true;
  const password = page.locator('input[type="password"]');
  return (await password.count()) > 0 && (await password.first().isVisible().catch(() => false));
}

function isPdf(content: Buffer): boolean {
  return content.length >= MIN_PDF_BYTES && content.subarray(0, PDF_MAGIC.length).toString() === PDF_MAGIC;
}

function fileNameFor(source: Source, suggested: string | null | undefined): string {
  const safe = (suggested ?? "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^[._-]+/, "");
  if (safe.toLowerCase().endsWith(".pdf") && safe.length > 4) return safe;
  const key = source.merchant.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `facture-${key || "fournisseur"}-${new Date().toISOString().slice(0, 10)}.pdf`;
}

/**
 * Les éléments de la page qui parlent de facture ou de téléchargement, du
 * plus prometteur au moins : un lien vers un `.pdf` d'abord, puis ce qui dit
 * « facture », puis ce qui dit « télécharger ». À rang égal, le premier dans
 * la page — les listes de factures commencent par la plus récente.
 */
async function findCandidates(page: Page): Promise<{ locator: Locator; text: string }[]> {
  const all = page.locator('a[href], button, [role="button"], [role="link"]');
  const count = Math.min(await all.count(), 400);
  const found: { locator: Locator; text: string; score: number; index: number }[] = [];

  for (let index = 0; index < count; index += 1) {
    const element = all.nth(index);
    if (!(await element.isVisible().catch(() => false))) continue;
    const [inner, label, title, href] = await Promise.all([
      element.innerText().catch(() => ""),
      element.getAttribute("aria-label").catch(() => null),
      element.getAttribute("title").catch(() => null),
      element.getAttribute("href").catch(() => null),
    ]);
    const text = [inner, label, title, href].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    if (!INVOICE_WORDS.test(text)) continue;

    let score = 0;
    if (href && /\.pdf(\?|$)/i.test(href)) score += 3;
    if (/facture|invoice/i.test(text)) score += 2;
    if (/t[ée]l[ée]charger|download/i.test(text)) score += 1;
    found.push({ locator: element, text: text.slice(0, 120), score, index });
  }

  return found
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ locator, text }) => ({ locator, text }));
}

/** La première promesse qui rend autre chose que `null`, sinon `null` au bout du délai. */
function firstResult<T>(promises: Promise<T | null>[], timeoutMs: number): Promise<T | null> {
  const never = new Promise<never>(() => undefined);
  return Promise.race([
    ...promises.map((promise) => promise.then((value) => (value === null ? never : value))),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

/**
 * Clique un candidat et attend ce qu'un site peut faire d'un PDF : un
 * téléchargement, une réponse PDF dans la page, ou un nouvel onglet qui
 * l'affiche. Rend le fichier, ou `null` si rien n'est venu.
 */
async function tryDownload(
  context: BrowserContext,
  page: Page,
  candidate: Locator,
  source: Source,
): Promise<PdfFile | null> {
  const wait = 15_000;

  const download = page
    .waitForEvent("download", { timeout: wait })
    .then(async (item) => {
      const filePath = await item.path();
      const content = await readFile(filePath);
      return { fileName: fileNameFor(source, item.suggestedFilename()), content };
    })
    .catch(() => null);

  const inPage = page
    .waitForResponse(
      (response) => (response.headers()["content-type"] ?? "").includes("application/pdf"),
      { timeout: wait },
    )
    .then(async (response) => ({
      fileName: fileNameFor(source, path.basename(new URL(response.url()).pathname)),
      content: await response.body(),
    }))
    .catch(() => null);

  const popup = context
    .waitForEvent("page", { timeout: wait })
    .then(async (tab) => {
      const tabDownload = tab
        .waitForEvent("download", { timeout: 10_000 })
        .then(async (item) => ({
          fileName: fileNameFor(source, item.suggestedFilename()),
          content: await readFile(await item.path()),
        }))
        .catch(() => null);
      const tabFetch = tab
        .waitForLoadState("domcontentloaded", { timeout: 10_000 })
        .then(async () => {
          const response = await context.request.get(tab.url(), { timeout: 20_000 });
          const content = await response.body();
          return isPdf(content)
            ? { fileName: fileNameFor(source, path.basename(new URL(tab.url()).pathname)), content }
            : null;
        })
        .catch(() => null);
      const result = await firstResult([tabDownload, tabFetch], 12_000);
      await tab.close().catch(() => undefined);
      return result;
    })
    .catch(() => null);

  await candidate.click({ timeout: 10_000 }).catch(() => undefined);
  const result = await firstResult([download, inPage, popup], wait + 1_000);
  return result && isPdf(result.content) ? result : null;
}

async function snapshot(page: Page, source: Source, tag: string, candidates: string[]): Promise<string> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = path.join(JOURNAL_DIR, `${stamp}-${source.merchant.replace(/[^A-Za-z0-9]+/g, "_")}-${tag}`);
  await page.screenshot({ path: `${base}.png`, fullPage: true }).catch(() => undefined);
  await writeFile(
    `${base}.txt`,
    [`URL : ${page.url()}`, "", "Éléments repérés :", ...candidates.map((text) => `  - ${text}`)].join("\n"),
  ).catch(() => undefined);
  return `${base}.png`;
}

/** Va chercher la facture la plus récente derrière le lien d'une fiche. */
export async function fetchInvoice(context: BrowserContext, source: Source): Promise<PdfFile> {
  const page = await context.newPage();
  try {
    const direct = page
      .waitForEvent("download", { timeout: 20_000 })
      .then(async (item) => ({
        fileName: fileNameFor(source, item.suggestedFilename()),
        content: await readFile(await item.path()),
      }))
      .catch(() => null);

    const response = await page
      .goto(source.source_link, { waitUntil: "domcontentloaded", timeout: 60_000 })
      .catch(() => null);

    /* Le lien pointe directement sur le PDF : il arrive en réponse, ou en
       téléchargement quand le navigateur n'a pas de visionneuse. */
    if (response && (response.headers()["content-type"] ?? "").includes("application/pdf")) {
      const content = await response.body();
      if (isPdf(content)) return { fileName: fileNameFor(source, null), content };
    }
    const downloaded = await firstResult([direct], 3_000);
    if (downloaded) return downloaded;

    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);

    if (await looksLikeLogin(page)) {
      throw new Error(
        `Session ${source.merchant} expirée — lance \`pnpm factures:connexion "${source.source_link}"\` et reconnecte-toi.`,
      );
    }

    const candidates = await findCandidates(page);
    const texts = candidates.map((candidate) => candidate.text);
    if (candidates.length === 0) {
      const shot = await snapshot(page, source, "aucun-bouton", texts);
      throw new Error(`Aucun bouton ni lien de facture sur la page (capture : ${shot}).`);
    }

    for (const candidate of candidates.slice(0, 6)) {
      log(`  · essai : « ${candidate.text} »`);
      const pdf = await tryDownload(context, page, candidate.locator, source);
      if (pdf) return pdf;
      /* Un clic a pu changer de page : revenir au point de départ avant le
         candidat suivant, sans quoi les suivants ne sont plus là. */
      if (page.url() !== source.source_link) {
        await page.goto(source.source_link, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => undefined);
        await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
      }
    }

    const shot = await snapshot(page, source, "aucun-pdf", texts);
    throw new Error(`Des liens de facture existent, aucun n'a donné un PDF (capture : ${shot}).`);
  } finally {
    await page.close().catch(() => undefined);
  }
}

// --- Les commandes ------------------------------------------------------------

async function connexion(link: string | undefined): Promise<void> {
  if (!link) throw new Error("Usage : pnpm factures:connexion <lien de la page des factures>");
  const context = await openBrowser(false);
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(link, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => undefined);
  log("Connecte-toi dans la fenêtre qui vient de s'ouvrir, jusqu'à voir la page des factures.");
  log("Ensuite, ferme simplement la fenêtre : la session est gardée dans le profil.");
  await new Promise<void>((resolve) => context.on("close", () => resolve()));
  log(`Session enregistrée dans ${PROFILE_DIR}.`);
}

async function passage(): Promise<void> {
  const list = await api<{ ok: boolean; month: string; sources: Source[]; schedule: ScheduleEntry[] }>(
    "GET",
    "/api/finance/invoices/pending-retrieval",
  );

  log(`Calendrier ${list.month} — ${list.schedule.length} fournisseur(s) suivi(s) :`);
  for (const entry of list.schedule) {
    log(`  ${entry.due ? "→" : "·"} ${entry.merchant} : ${entry.reason_label}${entry.due_on ? ` (${entry.due_on})` : ""}`);
  }
  if (list.sources.length === 0) {
    log("Rien à récupérer aujourd'hui.");
    return;
  }

  const context = await openBrowser(true);
  let failures = 0;
  try {
    for (const source of list.sources) {
      log(`${source.merchant} — ${source.source_link}`);
      try {
        const pdf = await fetchInvoice(context, source);
        log(`  PDF : ${pdf.fileName} (${Math.round(pdf.content.length / 1024)} Ko)`);

        const form = new FormData();
        form.append("file", new Blob([new Uint8Array(pdf.content)], { type: "application/pdf" }), pdf.fileName);
        const sent = await api<{ ok: boolean; sent_to: string; subject: string }>(
          "POST",
          `/api/finance/invoices/${source.id}/document`,
          form,
        );
        log(`  Envoyée à ${sent.sent_to} — « ${sent.subject} ». Fiche marquée récupérée.`);
      } catch (cause) {
        failures += 1;
        const message = cause instanceof Error ? cause.message : String(cause);
        log(`  ÉCHEC : ${message}`);
        await api(
          "PATCH",
          `/api/finance/invoices/${source.id}/retrieval-status`,
          JSON.stringify({ retrieval_status: "failed", error: message.slice(0, 500) }),
          "application/json",
        ).catch((patchError: unknown) => {
          log(`  (et le dashboard n'a pas pu être prévenu : ${String(patchError)})`);
        });
      }
    }
  } finally {
    await context.close().catch(() => undefined);
  }
  log(failures === 0 ? "Passage terminé." : `Passage terminé, ${failures} échec(s) — voir ci-dessus.`);
}

async function installer(): Promise<void> {
  config();
  await mkdir(JOURNAL_DIR, { recursive: true });
  const repo = process.cwd();
  const logFile = path.join(JOURNAL_DIR, "passage.log");
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>cd ${shellQuote(repo)} &amp;&amp; pnpm factures:passage</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>${PASSAGE_HOUR}</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>${logFile}</string>
  <key>StandardErrorPath</key><string>${logFile}</string>
</dict>
</plist>
`;
  await mkdir(path.dirname(PLIST), { recursive: true });
  await run("launchctl", ["unload", PLIST]).catch(() => undefined);
  await writeFile(PLIST, plist);
  await run("launchctl", ["load", PLIST]);
  log(`Passage planifié chaque jour à ${PASSAGE_HOUR} h (${PLIST}).`);
  log(`Journal : ${logFile}`);
  log("Pour vérifier : launchctl list | grep antidotes — pour lancer tout de suite : pnpm factures:passage");
}

async function desinstaller(): Promise<void> {
  await run("launchctl", ["unload", PLIST]).catch(() => undefined);
  await rm(PLIST, { force: true });
  log("Passage retiré de la planification.");
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

async function main(): Promise<void> {
  const [command, argument] = process.argv.slice(2);
  switch (command) {
    case "connexion":
      return connexion(argument);
    case "passage":
      return passage();
    case "installer":
      return installer();
    case "desinstaller":
      return desinstaller();
    default:
      throw new Error("Commandes : connexion <lien> · passage · installer · desinstaller");
  }
}

/* Lancé en ligne de commande seulement : le harnais de test importe les
   fonctions sans déclencher de passage. */
if (process.argv[1]?.endsWith("recuperer-factures.ts")) {
  main().catch((error: unknown) => {
    log(`ERREUR : ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
