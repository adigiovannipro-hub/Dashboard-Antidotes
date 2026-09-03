/**
 * Sonde l'API de facturation Airwallex **en direct**, et en lecture seule.
 *
 *   pnpm sonde:factures
 *
 * Une seule question : peut-on créer une facture par l'API, ou faut-il
 * dupliquer à la main dans l'interface ? La documentation dit oui
 * (`POST /api/v1/billing/invoices/create`, puis `add_line_items`, puis
 * `finalize`), mais elle décrit le produit, pas ce compte-ci : la facturation
 * est une brique Airwallex qui s'active, et une brique inactive répond 401 ou
 * 403 là où la documentation promet 200.
 *
 * Rien n'est créé. Le seul appel en écriture est un `create` volontairement
 * incomplet : un 400 de validation prouve que l'endpoint existe et que ce
 * compte a le droit de l'appeler, sans qu'aucune facture n'apparaisse. Un 401,
 * un 403 ou un 404 disent l'inverse, et chacun pour une raison différente.
 *
 * À jouer depuis un runner GitHub : Airwallex refuse les adresses IP de
 * Vercel, et les clés ne vivent pas sur cette machine.
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

const BASE =
  process.env.AIRWALLEX_BASE_URL?.trim().replace(/\/$/, "") ??
  (process.env.AIRWALLEX_ENV === "production"
    ? "https://api.airwallex.com"
    : "https://api-demo.airwallex.com");

function short(value: unknown, max = 1200): string {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 1);
  return (text ?? "").slice(0, max);
}

async function login(): Promise<string> {
  const clientId = process.env.AIRWALLEX_CLIENT_ID;
  const apiKey = process.env.AIRWALLEX_API_KEY;
  if (!clientId || !apiKey) {
    console.error("AIRWALLEX_CLIENT_ID et AIRWALLEX_API_KEY sont requis.");
    process.exit(1);
  }

  const response = await fetch(`${BASE}/api/v1/authentication/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "user-agent": "Antidotes/1.0",
      "x-client-id": clientId,
      "x-api-key": apiKey,
    },
    body: "{}",
  });

  if (!response.ok) {
    console.error(`Authentification refusée (${response.status}) sur ${BASE}`);
    console.error(short(await response.text(), 400));
    process.exit(1);
  }

  const payload = (await response.json()) as { token: string };
  return payload.token;
}

type Sondage = { status: number; body: unknown };

async function get(token: string, path: string): Promise<Sondage> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { authorization: `Bearer ${token}`, "user-agent": "Antidotes/1.0" },
  });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* Une réponse HTML est un diagnostic en soi : on la garde telle quelle. */
  }
  return { status: response.status, body };
}

async function post(
  token: string,
  path: string,
  payload: Record<string, unknown>,
): Promise<Sondage> {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "user-agent": "Antidotes/1.0",
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* idem */
  }
  return { status: response.status, body };
}

function titre(texte: string): void {
  console.log(`\n${"=".repeat(70)}\n${texte}\n${"=".repeat(70)}`);
}

async function main() {
  console.log(`Hôte : ${BASE}`);
  const token = await login();
  console.log("Authentification : ok");

  // --- 1. Les deux chemins de listing ---------------------------------------
  // Le code de production lit `/api/v1/invoices` et rapporte trente factures ;
  // la documentation, elle, décrit `/api/v1/billing/invoices`. Savoir lequel
  // répond, et si les deux rendent la même chose, décide où écrire la suite.
  titre("1. Listing — les deux chemins");
  for (const path of ["/api/v1/invoices?page_size=2", "/api/v1/billing/invoices?page_size=2"]) {
    const result = await get(token, path);
    const items = (result.body as { items?: unknown[] })?.items;
    console.log(`${path} → ${result.status}${Array.isArray(items) ? ` (${items.length} éléments)` : ""}`);
    if (result.status !== 200) console.log(`  ${short(result.body, 300)}`);
  }

  // --- 2. Une facture en détail ---------------------------------------------
  // Le listing ne rend pas les lignes. C'est la lecture unitaire qui dit à quoi
  // ressemble une facture réelle — donc ce qu'il faudra reproduire pour la
  // dupliquer : produit, prix, quantité, mentions légales.
  titre("2. Une facture existante, en détail");
  const listing = await get(token, "/api/v1/invoices?page_size=1");
  const first = (listing.body as { items?: { id?: string; billing_customer_id?: string }[] })
    ?.items?.[0];
  const invoiceId = first?.id ?? null;
  const customerId = first?.billing_customer_id ?? null;
  console.log(`Facture témoin : ${invoiceId ?? "aucune"}`);

  if (invoiceId) {
    for (const path of [
      `/api/v1/invoices/${invoiceId}`,
      `/api/v1/billing/invoices/${invoiceId}`,
      `/api/v1/billing/invoices/${invoiceId}/items?page_size=20`,
      `/api/v1/invoice_items?invoice_id=${invoiceId}&page_size=20`,
      `/api/v1/billing/invoice_items?invoice_id=${invoiceId}&page_size=20`,
    ]) {
      const result = await get(token, path);
      console.log(`\n${path} → ${result.status}`);
      console.log(short(result.body, 2000));
    }
  }

  // --- 3. Produits et prix ---------------------------------------------------
  // Une ligne de facture référence un `price_id` : si des prix existent déjà,
  // la duplication mensuelle n'a qu'à les réutiliser.
  titre("3. Produits et prix déjà en place");
  for (const path of [
    "/api/v1/products?page_size=10",
    "/api/v1/billing/products?page_size=10",
    "/api/v1/prices?page_size=10",
    "/api/v1/billing/prices?page_size=10",
  ]) {
    const result = await get(token, path);
    const items = (result.body as { items?: unknown[] })?.items;
    console.log(`${path} → ${result.status}${Array.isArray(items) ? ` (${items.length})` : ""}`);
    if (result.status === 200 && Array.isArray(items) && items.length > 0) {
      console.log(short(items[0], 800));
    }
  }

  // --- 4. Le client de facturation ------------------------------------------
  titre("4. Le client de facturation de la facture témoin");
  if (customerId) {
    const result = await get(token, `/api/v1/billing_customers/${customerId}`);
    console.log(`/api/v1/billing_customers/${customerId} → ${result.status}`);
    console.log(short(result.body, 1200));
  }

  // --- 5. Le droit de créer, sans rien créer --------------------------------
  // Corps volontairement incomplet : il manque `billing_customer_id`. Un 400 de
  // validation est la meilleure nouvelle possible — l'endpoint existe, le
  // compte a le droit, et rien n'a été écrit. Un 401/403 signe une brique
  // désactivée, un 404 un chemin qui n'existe pas sur ce compte.
  titre("5. Le droit de créer (sans créer)");
  for (const path of ["/api/v1/invoices/create", "/api/v1/billing/invoices/create"]) {
    const result = await post(token, path, {
      request_id: `sonde-${Date.now()}`,
      currency: "EUR",
    });
    console.log(`\nPOST ${path} → ${result.status}`);
    console.log(short(result.body, 600));
  }

  // --- 6. La chaîne complète, en brouillon puis effacée ---------------------
  // `--ecriture` : à jouer une fois, le jour où la clé API reçoit le droit
  // d'écrire. Elle crée un brouillon, lui pose une ligne, puis le supprime —
  // un brouillon n'a ni numéro, ni PDF, ni existence pour le client, et se
  // supprime pour de bon. Ce qui n'est **pas** joué : `finalize`, seul point
  // de non-retour de la chaîne.
  if (process.argv.includes("--ecriture")) {
    titre("6. La chaîne d'émission, en brouillon (créé puis supprimé)");
    if (!customerId) {
      console.log("Aucun client de facturation témoin : rien à tenter.");
    } else {
      const stamp = `sonde-${Date.now()}`;
      const prices = await get(token, "/api/v1/prices?page_size=1");
      const productId = (prices.body as { items?: { product_id?: string }[] })
        ?.items?.[0]?.product_id;
      console.log(`Produit témoin : ${productId ?? "aucun"}`);

      const price = productId
        ? await post(token, "/api/v1/prices/create", {
            request_id: `${stamp}-prix`,
            product_id: productId,
            currency: "EUR",
            unit_amount: 1,
            type: "ONE_OFF",
            pricing_model: "PER_UNIT",
            active: true,
          })
        : null;
      if (price) console.log(`POST /api/v1/prices/create → ${price.status}`);
      const priceId = (price?.body as { id?: string })?.id;

      const draft = await post(token, "/api/v1/invoices/create", {
        request_id: stamp,
        billing_customer_id: customerId,
        currency: "EUR",
        collection_method: "OUT_OF_BAND",
        days_until_due: 30,
      });
      console.log(`POST /api/v1/invoices/create → ${draft.status}`);
      console.log(short(draft.body, 600));

      const draftId = (draft.body as { id?: string })?.id;
      if (draftId && priceId) {
        const lines = await post(token, `/api/v1/invoices/${draftId}/add_line_items`, {
          request_id: `${stamp}-lignes`,
          line_items: [{ price_id: priceId, quantity: 1 }],
        });
        console.log(`POST /api/v1/invoices/${draftId}/add_line_items → ${lines.status}`);
        console.log(short(lines.body, 600));
      }

      if (draftId) {
        const removed = await post(token, `/api/v1/invoices/${draftId}/delete`, {});
        console.log(`POST /api/v1/invoices/${draftId}/delete → ${removed.status}`);
        if (removed.status !== 200) {
          console.log(
            `⚠ Brouillon ${draftId} non supprimé — à retirer à la main dans Airwallex.`,
          );
        }
      }

      /* Le prix, lui, ne se supprime pas : on le désactive. Un prix ponctuel
         d'un euro laissé actif traînerait dans les listes de l'interface sans
         jamais servir. */
      if (priceId) {
        const disabled = await post(token, `/api/v1/prices/${priceId}/update`, {
          request_id: `${stamp}-desactivation`,
          active: false,
        });
        console.log(`POST /api/v1/prices/${priceId}/update → ${disabled.status}`);
        if (disabled.status !== 200) {
          console.log(
            `⚠ Prix ${priceId} laissé actif — à désactiver à la main dans Airwallex.`,
          );
        }
      }
    }
  }

  titre(
    process.argv.includes("--ecriture")
      ? "Fin de la sonde — seul un brouillon a été créé, puis supprimé"
      : "Fin de la sonde — rien n'a été créé",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
