/**
 * Amorçage des données de démonstration du module Finance.
 *
 *   pnpm seed:finance          crée ou met à jour
 *   pnpm seed:finance --reset  efface d'abord les données Finance de l'org
 *
 * Le jeu de données reproduit la réalité du compte : dépenses en IDR financées
 * depuis le wallet EUR, factures clients en EUR, historique de solde horaire
 * sur 90 jours. La marche aléatoire du solde est déterministe — deux
 * exécutions produisent exactement la même courbe.
 *
 * Idempotent : réexécutable sans créer de doublon. Les identifiants sont
 * dérivés de clés stables, les insertions se réconcilient par identifiant
 * externe.
 */
import { createHash } from "node:crypto";

import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: ".env.local", quiet: true });

/** UUID stable dérivé d'une clé : rejouer l'amorçage ne recrée rien. */
function stableId(key: string): string {
  const hex = createHash("sha256").update(`finance:${key}`).digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join("-");
}

/** PRNG déterministe (mulberry32) : la courbe de démo ne change pas d'un run
    à l'autre, et un bug s'y reproduit à l'identique. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function daysAgo(days: number, hour = 10, minute = 0): Date {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return new Date(date.getTime() - days * DAY);
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// --- Catégories ------------------------------------------------------------

const CATEGORIES = [
  { slug: "transports", name: "Transports" },
  { slug: "restauration", name: "Restauration" },
  { slug: "logiciel", name: "Logiciel" },
  { slug: "voyage", name: "Voyage" },
  { slug: "hebergement", name: "Hébergement" },
  { slug: "autre", name: "Autre" },
];

/* Deux règles pour montrer la table de correspondance : les libellés anglais
   que l'API renvoie parfois, mappés vers le plan français. Les libellés déjà
   identiques (« Transports » → « Transports ») passent par l'égalité de nom. */
const RULES = [
  { matcher: "Software", category: "logiciel" },
  { matcher: "Meals", category: "restauration" },
];

// --- Factures --------------------------------------------------------------

type InvoiceSeed = {
  key: string;
  client: string;
  amountCents: number;
  status: "draft" | "sent" | "paid" | "void";
  rawStatus: string;
  issuedDaysAgo: number;
  dueInDays: number | null;
  paidDaysAgo?: number;
};

const INVOICES: InvoiceSeed[] = [
  // L'encours du mois : deux clients, échéances à venir.
  { key: "bondet-2026-08", client: "Bondet", amountCents: 250_000, status: "sent", rawStatus: "SENT", issuedDaysAgo: 5, dueInDays: 15 },
  { key: "silmo-2026-08", client: "Silmo Paris", amountCents: 180_000, status: "sent", rawStatus: "SENT", issuedDaysAgo: 3, dueInDays: 23 },
  // Le retard qui doit s'afficher en rouge.
  { key: "datack-2026-07", client: "Datack", amountCents: 95_000, status: "sent", rawStatus: "SENT", issuedDaysAgo: 40, dueInDays: -11 },
  // Un brouillon : compté dans l'encours client, pas dans l'attendu du mois.
  { key: "perrin-2026-08", client: "Maison Perrin", amountCents: 120_000, status: "draft", rawStatus: "DRAFT", issuedDaysAgo: 1, dueInDays: null },
  // Deux payées récentes, pour la profondeur de l'écran.
  { key: "bondet-2026-07", client: "Bondet", amountCents: 250_000, status: "paid", rawStatus: "PAID", issuedDaysAgo: 36, dueInDays: -6, paidDaysAgo: 8 },
  { key: "silmo-2026-07", client: "Silmo Paris", amountCents: 140_000, status: "paid", rawStatus: "PAID", issuedDaysAgo: 33, dueInDays: -3, paidDaysAgo: 2 },
];

// --- Dépenses --------------------------------------------------------------

type TransactionSeed = {
  key: string;
  merchant: string;
  merchantRaw?: string;
  amountCents: number;
  currency: string;
  billingCents: number | null;
  categoryRaw: string;
  status: string;
  daysAgo: number;
  hour?: number;
  hasReceipt?: boolean;
};

/* La première page reproduit l'écran Airwallex du 5 août — mêmes marchands,
   mêmes montants IDR, mêmes statuts. Les lignes plus anciennes donnent de la
   matière aux filtres : approuvées, munies de justificatifs, en EUR. */
const TRANSACTIONS: TransactionSeed[] = [
  { key: "grab-0805", merchant: "Grab", merchantRaw: "Grab* A-9MXOR7UGWAE9AV, 6281384748739, IDN", amountCents: 15_880_000, currency: "IDR", billingCents: 773, categoryRaw: "Transports", status: "incomplete", daysAgo: 0, hour: 14 },
  { key: "gwallet-0805", merchant: "Google Wallet", amountCents: 999, currency: "EUR", billingCents: null, categoryRaw: "Logiciel", status: "incomplete", daysAgo: 0, hour: 9 },
  { key: "blacksand-0804", merchant: "Black Sand Brewery", amountCents: 42_559_000, currency: "IDR", billingCents: 2_073, categoryRaw: "Restauration", status: "incomplete", daysAgo: 1, hour: 20 },
  { key: "grab-0804a", merchant: "Grab", merchantRaw: "Grab* A-4KXTR2UGWAE9AV, 6281384748739, IDN", amountCents: 17_650_000, currency: "IDR", billingCents: 861, categoryRaw: "Transports", status: "incomplete", daysAgo: 1, hour: 18 },
  { key: "grab-0804b", merchant: "Grab", merchantRaw: "Grab* A-7PXOR9UGWAE9AV, 6281384748739, IDN", amountCents: 34_830_000, currency: "IDR", billingCents: 1_700, categoryRaw: "Transports", status: "incomplete", daysAgo: 1, hour: 12 },
  { key: "starbucks-0804", merchant: "Starbucks", amountCents: 15_100_000, currency: "IDR", billingCents: 735, categoryRaw: "Restauration", status: "incomplete", daysAgo: 1, hour: 8 },
  { key: "unbranded-0804", merchant: "PT Unbranded Hospitality", merchantRaw: "PT UNBRANDED HOSPITALITY, Lombok Tengah, IDN, 314900 IDR payment converted to EUR", amountCents: 31_490_000, currency: "IDR", billingCents: 1_534, categoryRaw: "Restauration", status: "incomplete", daysAgo: 1, hour: 13 },
  { key: "lombok-0803", merchant: "Commerce Lombok", merchantRaw: ", LOMBOK, IDN, 537075 IDR payment converted to EUR", amountCents: 53_707_500, currency: "IDR", billingCents: 2_615, categoryRaw: "Autre", status: "incomplete", daysAgo: 2, hour: 16 },
  { key: "tampah-0803", merchant: "Tampah Hills", amountCents: 65_945_000, currency: "IDR", billingCents: 3_211, categoryRaw: "Voyage", status: "pending_approval", daysAgo: 2, hour: 11 },
  { key: "unbranded-0803", merchant: "PT Unbranded Hospitality", merchantRaw: "PT UNBRANDED HOSPITALITY, Lombok Tengah, IDN, 361500 IDR payment converted to EUR", amountCents: 36_150_000, currency: "IDR", billingCents: 1_761, categoryRaw: "Restauration", status: "incomplete", daysAgo: 2, hour: 19 },
  { key: "grab-0802", merchant: "Grab", merchantRaw: "Grab* A-2QXOR5UGWAE9AV, 6281384748739, IDN", amountCents: 47_520_000, currency: "IDR", billingCents: 2_313, categoryRaw: "Transports", status: "incomplete", daysAgo: 3, hour: 21 },
  { key: "ashtari-0802", merchant: "Ashtari Restaurant", amountCents: 53_661_300, currency: "IDR", billingCents: 2_607, categoryRaw: "Restauration", status: "incomplete", daysAgo: 3, hour: 13 },
  { key: "jelajah-0802", merchant: "Jelajah Coffee Roasters", amountCents: 20_900_000, currency: "IDR", billingCents: 1_014, categoryRaw: "Restauration", status: "pending_approval", daysAgo: 3, hour: 9 },
  { key: "oz-0801", merchant: "OZ Restaurant", merchantRaw: "OZ RESTAURANT, Lombok Tengah, IDN, 338140 IDR payment converted to EUR", amountCents: 33_814_000, currency: "IDR", billingCents: 1_648, categoryRaw: "Restauration", status: "incomplete", daysAgo: 4, hour: 20 },
  { key: "codium-0801", merchant: "Restaurant Codium", amountCents: 24_780_000, currency: "IDR", billingCents: 1_207, categoryRaw: "Restauration", status: "incomplete", daysAgo: 4, hour: 13 },
  { key: "anchor-0801", merchant: "Anchor Bed and Bread", merchantRaw: "ANCHOR BED AND BREAD, Lombok Tenga, IDN, 269500 IDR payment", amountCents: 26_950_000, currency: "IDR", billingCents: 1_312, categoryRaw: "Voyage", status: "incomplete", daysAgo: 4, hour: 8 },
  { key: "bara-0731", merchant: "BARA Lombok Tenga", amountCents: 41_200_000, currency: "IDR", billingCents: 2_005, categoryRaw: "Restauration", status: "pending_approval", daysAgo: 5, hour: 19 },
  // Plus ancien, approuvé, justificatif en place : la vie normale du tableau.
  { key: "anthropic-0728", merchant: "Anthropic", amountCents: 9_000, currency: "EUR", billingCents: null, categoryRaw: "Software", status: "approved", daysAgo: 8, hasReceipt: true },
  { key: "vercel-0726", merchant: "Vercel", amountCents: 2_000, currency: "EUR", billingCents: null, categoryRaw: "Software", status: "approved", daysAgo: 10, hasReceipt: true },
  { key: "notion-0722", merchant: "Notion Labs", amountCents: 1_200, currency: "EUR", billingCents: null, categoryRaw: "Software", status: "approved", daysAgo: 14, hasReceipt: true },
  { key: "grab-0720", merchant: "Grab", amountCents: 22_400_000, currency: "IDR", billingCents: 1_090, categoryRaw: "Transports", status: "approved", daysAgo: 16, hasReceipt: true },
  { key: "villa-0715", merchant: "Villa Selong Belanak", amountCents: 210_000_000, currency: "IDR", billingCents: 10_240, categoryRaw: "Hébergement", status: "approved", daysAgo: 21, hasReceipt: true },
  { key: "warung-0712", merchant: "Warung Bamboo", amountCents: 18_500_000, currency: "IDR", billingCents: 903, categoryRaw: "Restauration", status: "approved", daysAgo: 24, hasReceipt: true },
  { key: "meta-0710", merchant: "Meta Ads", amountCents: 45_000, currency: "EUR", billingCents: null, categoryRaw: "Autre", status: "approved", daysAgo: 26, hasReceipt: true },
];

// --- Amorçage --------------------------------------------------------------

async function main() {
  const reset = process.argv.includes("--reset");

  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error("SUPABASE_DB_URL absent de .env.local.");
    process.exit(1);
  }

  // Supabase impose TLS ; un Postgres local n'en parle pas. Forcer `ssl` sur
  // le second ferait échouer la connexion avant la première requête.
  const local = /localhost|127\.0\.0\.1|sslmode=disable/.test(connectionString);
  const db = new Client({
    connectionString,
    ssl: local ? undefined : { rejectUnauthorized: false },
  });
  await db.connect();

  try {
    const { rows: orgs } = await db.query<{ id: string }>(
      "select id from organizations where slug = 'antidotes'",
    );
    const orgId = orgs[0]?.id;
    if (!orgId) throw new Error("Organisation « antidotes » introuvable.");

    if (reset) {
      // L'ordre suit les clés étrangères.
      await db.query("delete from finance_receipts where org_id = $1", [orgId]);
      await db.query("delete from finance_transactions where org_id = $1", [orgId]);
      await db.query("delete from finance_category_rules where org_id = $1", [orgId]);
      await db.query("delete from finance_categories where org_id = $1", [orgId]);
      await db.query("delete from finance_invoices where org_id = $1", [orgId]);
      await db.query("delete from finance_balances_history where org_id = $1", [orgId]);
      await db.query("delete from finance_sync_runs where org_id = $1", [orgId]);
      await db.query("delete from finance_accounts where org_id = $1", [orgId]);
      console.log("Données Finance effacées.");
    }

    // --- Comptes ---
    const eurAccountId = stableId("account:eur");
    const usdAccountId = stableId("account:usd");
    await db.query(
      `insert into finance_accounts (id, org_id, external_id, currency, name, account_status)
       values
         ($1, $3, 'acct_antidotes', 'EUR', 'Wallet EUR', 'active'),
         ($2, $3, 'acct_antidotes', 'USD', 'Wallet USD', 'active')
       on conflict (org_id, external_id, currency) do update set name = excluded.name`,
      [eurAccountId, usdAccountId, orgId],
    );

    // --- Historique de solde : 90 jours, heure par heure, déterministe ---
    const random = mulberry32(20_260_805);
    const now = Date.now();
    const start = Math.floor((now - 90 * DAY) / HOUR) * HOUR;

    let balance = 910_000; // 9 100 € il y a 90 jours
    const snapshots: { hour: string; cents: number }[] = [];
    for (let at = start; at <= now; at += HOUR) {
      const date = new Date(at);
      // Encaissements : les factures du 1er et du 15, en journée.
      if ((date.getUTCDate() === 1 || date.getUTCDate() === 15) && date.getUTCHours() === 10) {
        balance += date.getUTCDate() === 1 ? 250_000 : 165_000;
      }
      // Dépenses carte : petites sorties irrégulières.
      if (random() < 0.035) {
        balance -= Math.round(300 + random() * 6_000);
      }
      // Loyer et charges : le 5 du mois.
      if (date.getUTCDate() === 5 && date.getUTCHours() === 8) {
        balance -= 82_000;
      }
      snapshots.push({ hour: new Date(at).toISOString(), cents: balance });
    }

    for (let offset = 0; offset < snapshots.length; offset += 500) {
      const chunk = snapshots.slice(offset, offset + 500);
      const values: string[] = [];
      const params: unknown[] = [orgId, eurAccountId];
      for (const [index, snapshot] of chunk.entries()) {
        const base = 2 + index * 2;
        values.push(`($1, $2, 'EUR', $${base + 1}, $${base + 2})`);
        params.push(snapshot.cents, snapshot.hour);
      }
      await db.query(
        `insert into finance_balances_history
           (org_id, account_id, currency, available_cents, snapshot_hour)
         values ${values.join(", ")}
         on conflict (account_id, snapshot_hour) do nothing`,
        params,
      );
    }

    // Le wallet USD : un point par jour suffit à la démonstration.
    for (let day = 90; day >= 0; day -= 1) {
      const hour = new Date(Math.floor(daysAgo(day, 12).getTime() / HOUR) * HOUR);
      await db.query(
        `insert into finance_balances_history
           (org_id, account_id, currency, available_cents, snapshot_hour)
         values ($1, $2, 'USD', $3, $4)
         on conflict (account_id, snapshot_hour) do nothing`,
        [orgId, usdAccountId, 48_200, hour.toISOString()],
      );
    }

    // --- Catégories et règles ---
    const categoryIds = new Map<string, string>();
    for (const [position, category] of CATEGORIES.entries()) {
      const id = stableId(`category:${category.slug}`);
      categoryIds.set(category.slug, id);
      await db.query(
        `insert into finance_categories (id, org_id, name, slug, position)
         values ($1, $2, $3, $4, $5)
         on conflict (org_id, slug) do update set name = excluded.name, position = excluded.position`,
        [id, orgId, category.name, category.slug, position],
      );
    }
    for (const rule of RULES) {
      await db.query(
        `insert into finance_category_rules (id, org_id, matcher, category_id)
         values ($1, $2, $3, $4)
         on conflict (org_id, matcher) do update set category_id = excluded.category_id`,
        [stableId(`rule:${rule.matcher}`), orgId, rule.matcher, categoryIds.get(rule.category)],
      );
    }

    // --- Factures ---
    for (const seed of INVOICES) {
      const issued = daysAgo(seed.issuedDaysAgo);
      const due = seed.dueInDays === null ? null : dateOnly(daysAgo(-seed.dueInDays));
      const paidAt = seed.paidDaysAgo === undefined ? null : daysAgo(seed.paidDaysAgo).toISOString();
      await db.query(
        `insert into finance_invoices
           (id, org_id, external_id, client_name, amount_cents, currency,
            status, raw_status, issued_on, due_on, paid_at)
         values ($1, $2, $3, $4, $5, 'EUR', $6, $7, $8, $9, $10)
         on conflict (org_id, external_id) do update set
           client_name = excluded.client_name,
           amount_cents = excluded.amount_cents,
           status = excluded.status,
           raw_status = excluded.raw_status,
           issued_on = excluded.issued_on,
           due_on = excluded.due_on,
           paid_at = excluded.paid_at`,
        [
          stableId(`invoice:${seed.key}`),
          orgId,
          `inv_${seed.key}`,
          seed.client,
          seed.amountCents,
          seed.status,
          seed.rawStatus,
          dateOnly(issued),
          due,
          paidAt,
        ],
      );
    }

    // --- Dépenses ---
    for (const seed of TRANSACTIONS) {
      const categorySlug = CATEGORIES.find(
        (category) => category.name === seed.categoryRaw,
      )?.slug;
      await db.query(
        `insert into finance_transactions
           (id, org_id, external_id, occurred_at, merchant, merchant_raw,
            amount_cents, currency, billing_amount_cents, billing_currency,
            category_id, category_raw, status, source, has_receipt,
            card_last_four, cardholder_name)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                 'airwallex', $14, '0162', 'Alessandro Di Giovanni')
         on conflict (org_id, external_id) do update set
           occurred_at = excluded.occurred_at,
           merchant = excluded.merchant,
           amount_cents = excluded.amount_cents,
           billing_amount_cents = excluded.billing_amount_cents,
           status = excluded.status,
           has_receipt = excluded.has_receipt`,
        [
          stableId(`transaction:${seed.key}`),
          orgId,
          `exp_${seed.key}`,
          daysAgo(seed.daysAgo, seed.hour ?? 12).toISOString(),
          seed.merchant,
          seed.merchantRaw ?? null,
          seed.amountCents,
          seed.currency,
          seed.billingCents,
          seed.billingCents === null ? null : "EUR",
          categorySlug ? categoryIds.get(categorySlug) : null,
          seed.categoryRaw,
          seed.status,
          seed.hasReceipt ?? false,
        ],
      );
    }

    // --- Justificatifs : un rapproché, un en attente de décision ---
    await db.query(
      `insert into finance_receipts
         (id, org_id, source, storage_path, file_name, mime_type, merchant,
          amount_cents, currency, occurred_on, payment_method,
          transaction_id, match_confidence, match_status)
       values
         ($1, $3, 'manual', 'seed/anthropic-2026-07.pdf', 'anthropic-juillet.pdf',
          'application/pdf', 'Anthropic', 9000, 'EUR', $4, 'card',
          $5, 0.970, 'confirmed'),
         ($2, $3, 'manual', 'seed/starbucks-ticket.jpg', 'ticket-starbucks.jpg',
          'image/jpeg', 'Starbucks', 15100000, 'IDR', $6, 'card',
          $7, 0.720, 'pending')
       on conflict (id) do nothing`,
      [
        stableId("receipt:anthropic"),
        stableId("receipt:starbucks"),
        orgId,
        dateOnly(daysAgo(8)),
        stableId("transaction:anthropic-0728"),
        dateOnly(daysAgo(1)),
        stableId("transaction:starbucks-0804"),
      ],
    );

    /* Aucune ligne n'est écrite dans `finance_sync_runs`, et c'est le
       correctif d'un mensonge : l'amorçage y inscrivait trois passages
       « réussis » datés de la minute, si bien que l'écran annonçait une
       synchronisation Airwallex qui n'avait jamais eu lieu. Un amorçage ne
       synchronise rien. Tant que rien n'a tourné, la bande affiche « Aucune
       synchronisation encore passée », ce qui est la vérité. */

    console.log(
      `Amorçage Finance terminé : ${CATEGORIES.length} catégories, ` +
        `${INVOICES.length} factures, ${TRANSACTIONS.length} dépenses, ` +
        `${snapshots.length} instantanés de solde.`,
    );
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
