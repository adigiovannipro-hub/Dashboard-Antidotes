/**
 * La récupération des factures d'abonnement — sur un runner GitHub, pas sur
 * Vercel, et plus sur le Mac.
 *
 *   pnpm factures:passage             le passage quotidien, sans écran
 *                                     (workflow `recuperer-factures.yml`)
 *   pnpm factures:connexion <marchand> ouvre un vrai navigateur pour se
 *                                     connecter une fois chez un fournisseur,
 *                                     et range la session chiffrée en base
 *   pnpm factures:connexion           liste les fiches et l'état de leur session
 *
 * Pourquoi ça ne peut pas vivre sur Vercel : une fonction serverless n'a pas de
 * navigateur, et surtout rien n'y survit d'une exécution à l'autre — or une
 * page de factures est réservée aux clients connectés. Le runner GitHub n'a pas
 * de mémoire non plus, mais il peut **rejouer** une session : cookies et
 * stockage local sont capturés une fois depuis un vrai navigateur, chiffrés
 * (`FACTURES_SESSION_KEY`), rangés sur la fiche du fournisseur, et restaurés à
 * chaque passage. C'est le même compromis que les Reçus, dont le jeton Gmail
 * est capturé une fois puis rafraîchi sans personne.
 *
 * Ce que le passage ne fait jamais : se connecter. Un mot de passe, une
 * double authentification, un captcha ne s'automatisent pas — et essayer ferait
 * bloquer le compte. Quand la session est refusée, la fiche passe en échec avec
 * la marche à suivre, et l'écran l'affiche en rouge.
 *
 * Le passage ne parle qu'à Supabase et aux sites des fournisseurs : pas de
 * route HTTP, pas de secret d'application. L'envoi à Airwallex réutilise la
 * boîte Gmail déjà connectée aux Reçus — une seule chaîne d'envoi pour tout le
 * projet.
 */
import { chromium, type BrowserContext, type Locator, type Page } from "@playwright/test";
import dotenv from "dotenv";

// Next lit `.env.local` nativement, pas les scripts Node lancés à la main.
dotenv.config({ path: ".env.local", quiet: true });

/** La clé qui chiffre les sessions — distincte de celle des jetons Gmail. */
const SESSION_KEY_ENV = "FACTURES_SESSION_KEY";

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  SESSION_KEY_ENV,
] as const;

const PDF_MAGIC = "%PDF-";
const MIN_PDF_BYTES = 1024;
/* Ce qui, sur la page d'un fournisseur, désigne une facture ou son
   téléchargement — en français et en anglais, les deux langues des sites
   qu'on rencontre. */
const INVOICE_WORDS = /facture|invoice|receipt|re[cç]u|t[ée]l[ée]charger|download|\.pdf/i;
const LOGIN_URL = /login|signin|sign-in|log-in|auth|sso|connexion|password|passwd|ims\//i;
/* Deux mois de prélèvements : on ne cherche que celui du mois courant. */
const CHARGE_WINDOW_DAYS = 62;

type PdfFile = { fileName: string; content: Buffer };

function log(line: string): void {
  const stamp = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
  console.log(`[${stamp}] ${line}`);
}

function checkEnv(): void {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Variables absentes : ${missing.join(", ")}. ` +
        "En local elles se lisent dans .env.local, sur GitHub dans les secrets Actions.",
    );
  }
}

// --- Le navigateur ------------------------------------------------------------

/* Ce qui distingue un navigateur piloté d'un navigateur ordinaire, et que
   Google refuse : la barre « Chrome est contrôlé par un logiciel de test »
   (`--enable-automation`) et le drapeau `navigator.webdriver`
   (`AutomationControlled`). Les retirer ne déguise rien — c'est la même
   personne, sur sa machine, avec son mot de passe. Cela évite seulement un
   refus qui ne protège personne ici. */
const SANS_BANDEAU_AUTOMATISATION = {
  args: [
    "--disable-blink-features=AutomationControlled",
    "--no-first-run",
    "--no-default-browser-check",
  ],
  ignoreDefaultArgs: ["--enable-automation"],
};

/**
 * Ouvre un navigateur, en préférant le **Chrome installé** au Chromium fourni
 * avec Playwright.
 *
 * Google bloque la connexion depuis Chromium — « Impossible de vous
 * connecter : ce navigateur ou cette application ne sont peut-être pas
 * sécurisés » — et aucun réglage n'y change rien : c'est la build qui est
 * refusée. Avec le Chrome du système, la connexion passe. Sur un runner
 * GitHub, Chrome n'existe pas : on retombe sur Chromium, ce qui suffit, le
 * passage ne se connectant jamais — il rejoue une session déjà ouverte.
 */
async function lancerNavigateur(visible: boolean) {
  const commun = { headless: !visible, ...SANS_BANDEAU_AUTOMATISATION };
  try {
    return await chromium.launch({ ...commun, channel: "chrome" });
  } catch {
    if (visible) {
      log("  (Chrome introuvable — repli sur Chromium ; Google refusera peut-être la connexion.)");
    }
    return await chromium.launch(commun);
  }
}


async function looksLikeLogin(page: Page): Promise<boolean> {
  if (LOGIN_URL.test(page.url())) return true;
  const password = page.locator('input[type="password"]');
  return (await password.count()) > 0 && (await password.first().isVisible().catch(() => false));
}

function isPdf(content: Buffer): boolean {
  return (
    content.length >= MIN_PDF_BYTES &&
    content.subarray(0, PDF_MAGIC.length).toString() === PDF_MAGIC
  );
}

function fileNameFor(merchant: string, suggested: string | null | undefined): string {
  const safe = (suggested ?? "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^[._-]+/, "");
  if (safe.toLowerCase().endsWith(".pdf") && safe.length > 4) return safe;
  const key = merchant.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `facture-${key || "fournisseur"}-${new Date().toISOString().slice(0, 10)}.pdf`;
}

/**
 * Les éléments de la page qui parlent de facture ou de téléchargement, du plus
 * prometteur au moins : un lien vers un `.pdf` d'abord, puis ce qui dit
 * « facture », puis ce qui dit « télécharger ». À rang égal, le premier dans la
 * page — une liste de factures commence par la plus récente.
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
  merchant: string,
): Promise<PdfFile | null> {
  const wait = 15_000;
  const { readFile } = await import("node:fs/promises");
  const path = await import("node:path");

  const download = page
    .waitForEvent("download", { timeout: wait })
    .then(async (item) => ({
      fileName: fileNameFor(merchant, item.suggestedFilename()),
      content: await readFile(await item.path()),
    }))
    .catch(() => null);

  const inPage = page
    .waitForResponse(
      (response) => (response.headers()["content-type"] ?? "").includes("application/pdf"),
      { timeout: wait },
    )
    .then(async (response) => ({
      fileName: fileNameFor(merchant, path.basename(new URL(response.url()).pathname)),
      content: await response.body(),
    }))
    .catch(() => null);

  const popup = context
    .waitForEvent("page", { timeout: wait })
    .then(async (tab) => {
      const tabDownload = tab
        .waitForEvent("download", { timeout: 10_000 })
        .then(async (item) => ({
          fileName: fileNameFor(merchant, item.suggestedFilename()),
          content: await readFile(await item.path()),
        }))
        .catch(() => null);
      const tabFetch = tab
        .waitForLoadState("domcontentloaded", { timeout: 10_000 })
        .then(async () => {
          const response = await context.request.get(tab.url(), { timeout: 20_000 });
          const content = await response.body();
          return isPdf(content)
            ? {
                fileName: fileNameFor(merchant, path.basename(new URL(tab.url()).pathname)),
                content,
              }
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

/** Va chercher la facture la plus récente derrière le lien d'une fiche. */
async function fetchInvoice(
  context: BrowserContext,
  merchant: string,
  link: string,
): Promise<PdfFile> {
  const { readFile } = await import("node:fs/promises");
  const page = await context.newPage();
  try {
    const direct = page
      .waitForEvent("download", { timeout: 20_000 })
      .then(async (item) => ({
        fileName: fileNameFor(merchant, item.suggestedFilename()),
        content: await readFile(await item.path()),
      }))
      .catch(() => null);

    const response = await page
      .goto(link, { waitUntil: "domcontentloaded", timeout: 60_000 })
      .catch(() => null);

    /* Le lien pointe droit sur le PDF : il arrive en réponse, ou en
       téléchargement quand le navigateur n'a pas de visionneuse. */
    if (response && (response.headers()["content-type"] ?? "").includes("application/pdf")) {
      const content = await response.body();
      if (isPdf(content)) return { fileName: fileNameFor(merchant, null), content };
    }
    const downloaded = await firstResult([direct], 3_000);
    if (downloaded) return downloaded;

    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);

    if (await looksLikeLogin(page)) {
      throw new Error(
        `Session ${merchant} expirée ou refusée — rouvrir une session avec ` +
          `\`pnpm factures:connexion ${merchant}\`.`,
      );
    }

    const candidates = await findCandidates(page);
    if (candidates.length === 0) {
      throw new Error(
        `Aucun lien ni bouton de facture sur ${page.url()} — vérifier que le lien ` +
          "pointe bien sur la page où la facture se télécharge.",
      );
    }

    for (const candidate of candidates.slice(0, 6)) {
      log(`  · essai : « ${candidate.text} »`);
      const pdf = await tryDownload(context, page, candidate.locator, merchant);
      if (pdf) return pdf;
      /* Un clic a pu changer de page : revenir au point de départ, sans quoi
         les candidats suivants ne sont plus là. */
      if (page.url() !== link) {
        await page.goto(link, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => undefined);
        await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
      }
    }

    throw new Error(
      `Des liens de facture existent (${candidates
        .slice(0, 3)
        .map((candidate) => `« ${candidate.text} »`)
        .join(", ")}) mais aucun n'a donné un PDF.`,
    );
  } finally {
    await page.close().catch(() => undefined);
  }
}

// --- Les commandes -------------------------------------------------------------

/**
 * Le passage : ce qui est à récupérer aujourd'hui, et rien d'autre.
 *
 * Le navigateur ne s'ouvre que si une fiche est due — le lendemain du
 * prélèvement du mois, jamais avant. Une journée sans rien à faire coûte une
 * requête à Supabase.
 */
async function passage(): Promise<void> {
  checkEnv();
  const [{ createAdminClient }, { decryptSecret, encryptSecret }, retrieval, { merchantKey }, { sendFileToAirwallex }] =
    await Promise.all([
      import("@/lib/supabase/server"),
      import("@/lib/moderation/crypto"),
      import("@/lib/finance/retrieval"),
      import("@/lib/finance/merchant-logo"),
      import("@/lib/recus/pipeline"),
    ]);
  type Source = import("@/lib/finance/types").FinanceRetrievalSource;

  const admin = createAdminClient();
  const now = new Date();

  const { data, error } = await admin
    .from("finance_retrieval_sources")
    .select("*")
    .not("source_link", "is", null)
    .order("merchant_label", { ascending: true });
  /* L'erreur se teste, pas seulement la donnée : une table absente rendrait
     une liste vide, donc un « rien à faire » parfaitement rassurant. */
  if (error) throw new Error(`Lecture des fiches : ${error.message}`);

  const sources = (data ?? []) as unknown as Source[];
  if (sources.length === 0) {
    log("Aucun fournisseur suivi — coller un lien depuis la colonne Récupération de Finance.");
    return;
  }

  // Le dernier prélèvement carte de chaque marchand : c'est lui qui date le
  // passage. Un virement n'est pas un prélèvement, la source `ledger` sort.
  const since = new Date(now.getTime() - CHARGE_WINDOW_DAYS * 86_400_000).toISOString();
  const { data: charges, error: chargesError } = await admin
    .from("finance_transactions")
    .select("org_id, merchant, merchant_raw, occurred_at")
    .in("org_id", [...new Set(sources.map((source) => source.org_id))])
    .neq("source", "ledger")
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(2000);
  if (chargesError) throw new Error(`Lecture des prélèvements : ${chargesError.message}`);

  const lastCharge: Record<string, string> = {};
  for (const row of (charges ?? []) as unknown as {
    org_id: string;
    merchant: string | null;
    merchant_raw: string | null;
    occurred_at: string;
  }[]) {
    const key = `${row.org_id}:${merchantKey(row.merchant ?? row.merchant_raw)}`;
    // Trié du plus récent au plus ancien : la première occurrence gagne.
    if (!(key in lastCharge)) lastCharge[key] = row.occurred_at;
  }

  const due: { source: Source; label: string }[] = [];
  log(`Calendrier ${retrieval.currentUtcMonth(now)} — ${sources.length} fournisseur(s) suivi(s) :`);
  for (const source of sources) {
    const decision = retrieval.decideRetrieval({
      source,
      lastChargeAt: lastCharge[`${source.org_id}:${source.merchant_key}`] ?? null,
      now,
    });
    const label = retrieval.RETRIEVAL_REASON_LABELS[decision.reason];
    log(`  ${decision.due ? "→" : "·"} ${source.merchant_label} : ${label}${decision.dueOn ? ` (${decision.dueOn})` : ""}`);
    if (decision.due) due.push({ source, label });
  }

  if (due.length === 0) {
    log("Rien à récupérer aujourd'hui.");
    return;
  }

  const browser = await lancerNavigateur(false);
  let failures = 0;
  try {
    for (const { source } of due) {
      log(`${source.merchant_label} — ${source.source_link}`);
      /* Sans session, on tente quand même : un lien qui pointe droit sur un
         PDF public n'a besoin de personne. C'est la page de connexion, plus
         loin, qui tranchera. */
      const storageState = source.session_encrypted
        ? (JSON.parse(
            decryptSecret(source.session_encrypted, SESSION_KEY_ENV),
          ) as Awaited<ReturnType<BrowserContext["storageState"]>>)
        : undefined;
      const context = await browser.newContext({ storageState, acceptDownloads: true, locale: "fr-FR" });

      try {
        const pdf = await fetchInvoice(context, source.merchant_label, source.source_link!);
        log(`  PDF : ${pdf.fileName} (${Math.round(pdf.content.length / 1024)} Ko)`);

        const sent = await sendFileToAirwallex({
          orgId: source.org_id,
          subject: `Facture ${source.merchant_label} - ${now.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}`,
          merchant: source.merchant_label,
          fileName: pdf.fileName,
          content: pdf.content,
        });
        if (!sent.ok) throw new Error(`Envoi : ${sent.error}`);
        log(`  Envoyée à ${sent.to}.`);

        /* La session se réécrit rafraîchie : un site qui prolonge son cookie à
           chaque visite garde ainsi la porte ouverte, mois après mois. */
        const refreshed = encryptSecret(
          JSON.stringify(await context.storageState()),
          SESSION_KEY_ENV,
        );
        const { error: writeError } = await admin
          .from("finance_retrieval_sources")
          .update({
            retrieval_status: "done",
            auto_retrieved_at: now.toISOString(),
            last_error: null,
            session_encrypted: refreshed,
            session_saved_at: now.toISOString(),
          } as never)
          .eq("id", source.id);
        if (writeError) {
          log(`  ATTENTION : facture envoyée mais fiche non marquée — ${writeError.message}`);
        }
      } catch (cause) {
        failures += 1;
        const message = cause instanceof Error ? cause.message : String(cause);
        log(`  ÉCHEC : ${message}`);
        await admin
          .from("finance_retrieval_sources")
          .update({ retrieval_status: "failed", last_error: message.slice(0, 500) } as never)
          .eq("id", source.id);
      } finally {
        await context.close().catch(() => undefined);
      }
    }
  } finally {
    await browser.close().catch(() => undefined);
  }

  log(failures === 0 ? "Passage terminé." : `Passage terminé, ${failures} échec(s) — voir ci-dessus.`);
}

/**
 * Les connexions aux fournisseurs : la seule étape qui demande un humain.
 *
 * Sans argument, elle enchaîne **toutes** les fiches à qui il manque une
 * session : une fenêtre s'ouvre sur le premier fournisseur, tu te connectes,
 * tu fermes ; la suivante s'ouvre aussitôt. C'est fait pour une seule séance,
 * le jour où l'on colle une série de liens — un aller-retour par fournisseur
 * serait le vrai coût de cette fonctionnalité.
 *
 * Le dashboard, lui, ne peut pas ouvrir cette fenêtre : il tourne sur Vercel,
 * à l'autre bout du monde, et n'a aucun moyen d'atteindre ce Mac. C'est
 * pourquoi la connexion est une commande d'ici, et non un bouton de l'écran.
 *
 * Un mot de passe, une double authentification, un captcha ne s'automatisent
 * pas — et les contourner ferait bloquer le compte. Ce qui sort d'ici, cookies
 * et stockage local, est chiffré et rangé sur la fiche : c'est ce que le
 * runner GitHub rejouera, sans écran et sans personne, les mois suivants.
 */
async function connexion(argument: string | undefined): Promise<void> {
  checkEnv();
  const [{ createAdminClient }, { encryptSecret }] = await Promise.all([
    import("@/lib/supabase/server"),
    import("@/lib/moderation/crypto"),
  ]);
  type Source = import("@/lib/finance/types").FinanceRetrievalSource;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("finance_retrieval_sources")
    .select("*")
    .not("source_link", "is", null)
    .order("merchant_label", { ascending: true });
  if (error) throw new Error(`Lecture des fiches : ${error.message}`);
  const sources = (data ?? []) as unknown as Source[];

  if (sources.length === 0) {
    log("Aucun lien enregistré : commence par en coller depuis la colonne Récupération de Finance.");
    return;
  }

  const cible = argument?.trim().toLowerCase();
  let aFaire: Source[];

  if (cible && cible !== "--tout") {
    const trouvee = sources.find(
      (candidate) =>
        candidate.merchant_key === cible ||
        candidate.merchant_label.toLowerCase() === cible ||
        candidate.merchant_label.toLowerCase().includes(cible),
    );
    if (!trouvee) {
      throw new Error(
        `Aucune fiche ne correspond à « ${argument} ». Connues : ` +
          sources.map((source) => source.merchant_label).join(", "),
      );
    }
    aFaire = [trouvee];
  } else if (cible === "--tout") {
    aFaire = sources;
  } else {
    /* Le défaut : seulement ce qui manque. Rouvrir une session déjà valide
       ferait perdre du temps sans rien gagner. */
    aFaire = sources.filter((source) => !source.session_saved_at);
    if (aFaire.length === 0) {
      log("Toutes les fiches ont déjà une session :");
      for (const source of sources) {
        log(
          `  · ${source.merchant_label} — session du ` +
            `${new Date(source.session_saved_at!).toLocaleDateString("fr-FR")}`,
        );
      }
      log("Pour en rouvrir une : pnpm factures:connexion <marchand> — ou --tout pour toutes.");
      return;
    }
  }

  log(`${aFaire.length} session(s) à ouvrir. Une fenêtre par fournisseur, dans l'ordre.`);

  for (const [index, source] of aFaire.entries()) {
    log(`(${index + 1}/${aFaire.length}) ${source.merchant_label} — ${source.source_link}`);
    const state = await capturerSession(source.merchant_label, source.source_link!);
    if (!state) {
      log("  Session non lue — fenêtre fermée trop tôt ? Fiche laissée en l'état.");
      continue;
    }
    const { error: writeError } = await admin
      .from("finance_retrieval_sources")
      .update({
        session_encrypted: encryptSecret(state, SESSION_KEY_ENV),
        session_saved_at: new Date().toISOString(),
        retrieval_status: "pending",
        last_error: null,
      } as never)
      .eq("id", source.id);
    if (writeError) {
      log(`  ÉCHEC de l'enregistrement : ${writeError.message}`);
      continue;
    }
    log("  Session enregistrée.");
  }

  log("Terminé. Le passage rejouera ces sessions sans écran, le lendemain de chaque prélèvement.");
}

/**
 * Ouvre une fenêtre sur la page d'un fournisseur et rend l'état de session
 * au moment où elle se ferme.
 *
 * Un contexte neuf par fournisseur : partager le même mélangerait les cookies
 * d'Adobe et de Google dans les deux fiches. L'état se lit **avant** la
 * fermeture du navigateur — un contexte fermé n'a plus rien à donner — d'où
 * l'écoute sur la page plutôt que sur le navigateur.
 */
async function capturerSession(merchant: string, link: string): Promise<string | null> {
  const browser = await lancerNavigateur(true);
  const context = await browser.newContext({ acceptDownloads: true, locale: "fr-FR" });
  const page = await context.newPage();
  await page.goto(link, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => undefined);

  log(`  Connecte-toi à ${merchant} dans la fenêtre, jusqu'à voir la liste des factures.`);
  log("  Ferme ensuite la fenêtre pour passer au suivant.");

  await new Promise<void>((resolve) => {
    page.on("close", () => resolve());
    browser.on("disconnected", () => resolve());
    // Un quart d'heure par fournisseur : au-delà, on n'attend plus.
    setTimeout(resolve, 15 * 60_000);
  });

  const state = await context
    .storageState()
    .then((value) => JSON.stringify(value))
    .catch(() => null);
  await browser.close().catch(() => undefined);
  return state;
}

async function main(): Promise<void> {
  const [command, argument] = process.argv.slice(2);
  switch (command) {
    case "passage":
      return passage();
    case "connexion":
      return connexion(argument);
    default:
      throw new Error(
        "Commandes : passage · connexion [marchand|--tout] " +
          "(sans argument : toutes les fiches sans session)",
      );
  }
}

main().catch((error: unknown) => {
  log(`ERREUR : ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
