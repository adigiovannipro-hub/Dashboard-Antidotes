import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import { reconcileBillingInstallments } from "@/lib/billing/sync";
import {
  getCustomerName,
  listBalances,
  listFinanceExpenses,
  listIssuedInvoices,
  listLedgerEntries,
} from "./airwallex";
import { DEFAULT_CATEGORIES, resolveCategory } from "./categories";
import { ledgerOutflowToExpense } from "./normalize";
import { syncMerchantLogos } from "./logos";
import type {
  FinanceCategory,
  FinanceCategoryRule,
  FinanceSyncKind,
} from "./types";

/**
 * Le passage de synchronisation du module Finance.
 *
 * Cinq étapes indépendantes — soldes, dépenses, factures, grand livre, puis
 * le rapprochement des Échéances qui les consomme. Une étape en échec
 * n'annule pas les autres : perdre les factures ne doit pas priver la courbe
 * de son instantané horaire. Chaque étape écrit sa ligne au journal
 * `finance_sync_runs`, réussie ou non — l'écran affiche le dernier passage, et
 * un échec silencieux est le pire état possible.
 *
 * Tout est idempotent : les upserts se réconcilient par identifiant externe,
 * les instantanés par (compte, heure). Le passage peut se rejouer sans rien
 * doubler.
 */

/** Fenêtre de resynchronisation des dépenses : assez large pour couvrir les
    trois mois que l'écran sait filtrer, assez courte pour tenir dans un cron —
    trois pages de cent lignes au rythme actuel. */
const EXPENSES_LOOKBACK_DAYS = 92;

/** Fenêtre du grand livre : la courbe du solde couvre douze mois, la
    resynchronisation doit donc en couvrir un peu plus. */
const LEDGER_LOOKBACK_DAYS = 400;

export type SyncStepReport = {
  kind: FinanceSyncKind;
  status: "success" | "error";
  rows: number;
  error?: string;
};

export async function runFinanceSync(options: {
  orgId: string;
  triggeredVia: "cron" | "manual";
  requestedBy?: string | null;
}): Promise<SyncStepReport[]> {
  const steps: {
    kind: FinanceSyncKind;
    work: (orgId: string) => Promise<number>;
  }[] = [
    { kind: "balances", work: syncBalances },
    { kind: "transactions", work: syncTransactions },
    { kind: "invoices", work: syncInvoices },
    { kind: "ledger", work: syncLedger },
    /* En dernier : le rapprochement des Échéances consomme les factures que
       l'étape `invoices` vient de rafraîchir — aucun appel Airwallex, deux
       tables locales croisées. */
    { kind: "billing", work: reconcileBillingInstallments },
  ];

  const reports: SyncStepReport[] = [];

  for (const step of steps) {
    const runId = await openRun(options, step.kind);
    try {
      const rows = await step.work(options.orgId);
      await closeRun(runId, { status: "success", rows });
      reports.push({ kind: step.kind, status: "success", rows });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await closeRun(runId, { status: "error", rows: 0, error: message });
      reports.push({ kind: step.kind, status: "error", rows: 0, error: message });
    }
  }

  return reports;
}

// --- Journal -----------------------------------------------------------------

async function openRun(
  options: { orgId: string; triggeredVia: "cron" | "manual"; requestedBy?: string | null },
  kind: FinanceSyncKind,
): Promise<number | null> {
  const { data, error } = await createAdminClient()
    .from("finance_sync_runs")
    .insert({
      org_id: options.orgId,
      kind,
      status: "running",
      triggered_via: options.triggeredVia,
      requested_by: options.requestedBy ?? null,
    } as never)
    .select("id")
    .single();

  // Un journal qui ne s'écrit pas ne doit pas empêcher la synchronisation :
  // l'étape tournera sans trace plutôt que pas du tout — et l'erreur du
  // journal remontera par la première étape qui échoue vraiment.
  if (error) return null;
  return (data as { id: number } | null)?.id ?? null;
}

async function closeRun(
  runId: number | null,
  outcome: { status: "success" | "error"; rows: number; error?: string },
): Promise<void> {
  if (runId === null) return;
  await createAdminClient()
    .from("finance_sync_runs")
    .update({
      status: outcome.status,
      finished_at: new Date().toISOString(),
      rows_synced: outcome.rows,
      error: outcome.error ?? null,
    } as never)
    .eq("id", runId);
}

// --- Soldes ------------------------------------------------------------------

/* L'API des soldes ne nomme pas de compte : elle rend l'état du wallet, devise
   par devise. `external_id` est donc une constante — c'est la paire
   (external_id, devise) qui identifie la ligne de trésorerie. */
const WALLET_EXTERNAL_ID = "airwallex-wallet";

async function syncBalances(orgId: string): Promise<number> {
  const balances = await listBalances();
  if (balances.length === 0) return 0;

  const admin = createAdminClient();

  const { data: accounts, error: accountsError } = await admin
    .from("finance_accounts")
    .upsert(
      balances.map((balance) => ({
        org_id: orgId,
        external_id: WALLET_EXTERNAL_ID,
        currency: balance.currency,
        name: `Wallet ${balance.currency}`,
        account_status: "active",
        synced_at: new Date().toISOString(),
      })) as never,
      { onConflict: "org_id,external_id,currency" },
    )
    .select("id, currency");
  if (accountsError) throw new Error(`Comptes : ${accountsError.message}`);

  const idByCurrency = new Map(
    ((accounts ?? []) as { id: string; currency: string }[]).map((account) => [
      account.currency,
      account.id,
    ]),
  );

  // L'instantané porte l'heure tronquée : le passage peut se rejouer dix fois
  // dans l'heure, il n'écrira qu'une ligne par compte.
  const snapshotHour = new Date(
    Math.floor(Date.now() / 3_600_000) * 3_600_000,
  ).toISOString();

  const { error: snapshotError } = await admin.from("finance_balances_history").upsert(
    balances
      .filter((balance) => idByCurrency.has(balance.currency))
      .map((balance) => ({
        org_id: orgId,
        account_id: idByCurrency.get(balance.currency),
        currency: balance.currency,
        available_cents: balance.available_cents,
        pending_cents: balance.pending_cents,
        reserved_cents: balance.reserved_cents,
        snapshot_hour: snapshotHour,
      })) as never,
    { onConflict: "account_id,snapshot_hour", ignoreDuplicates: true },
  );
  if (snapshotError) throw new Error(`Instantanés : ${snapshotError.message}`);

  return balances.length;
}

// --- Dépenses ----------------------------------------------------------------

async function syncTransactions(orgId: string): Promise<number> {
  const admin = createAdminClient();

  const fromDate = new Date(
    Date.now() - EXPENSES_LOOKBACK_DAYS * 24 * 3_600_000,
  );
  const expenses = await listFinanceExpenses({ fromDate });
  if (expenses.length === 0) return 0;

  // L'upsert ne porte pas `category_id` : une recatégorisation faite à la main
  // dans l'écran survit ainsi à toutes les resynchronisations. La
  // correspondance automatique ne remplit que les lignes encore vierges,
  // en second passage.
  const { error: upsertError } = await admin.from("finance_transactions").upsert(
    expenses.map((expense) => ({
      org_id: orgId,
      external_id: expense.external_id,
      occurred_at: expense.occurred_at,
      posted_at: expense.posted_at,
      merchant: expense.merchant,
      merchant_raw: expense.merchant_raw,
      amount_cents: expense.amount_cents,
      currency: expense.currency,
      billing_amount_cents: expense.billing_amount_cents,
      billing_currency: expense.billing_currency,
      category_raw: expense.category_raw,
      status: expense.status,
      source: "airwallex",
      has_receipt: expense.has_receipt,
      card_last_four: expense.card_last_four,
      cardholder_name: expense.cardholder_name,
      raw: expense.raw,
      synced_at: new Date().toISOString(),
    })) as never,
    { onConflict: "org_id,external_id" },
  );
  if (upsertError) throw new Error(`Dépenses : ${upsertError.message}`);

  await applyCategoryRules(orgId, expenses);

  /* Les logos dans la foulée des dépenses, en meilleur effort : un service
     de favicons en panne ne doit pas faire passer l'étape en échec — le
     tableau retombe sur les initiales, et le prochain passage retentera les
     marchands jamais journalisés. */
  try {
    await syncMerchantLogos(orgId, expenses);
  } catch {
    // Silence assumé : rien d'actionnable, et l'étape a réussi son travail.
  }

  return expenses.length;
}

async function applyCategoryRules(
  orgId: string,
  expenses: {
    external_id: string;
    category_raw: string | null;
    merchant: string | null;
    merchant_raw: string | null;
  }[],
): Promise<void> {
  const admin = createAdminClient();

  /* Le plan par défaut est garanti avant de ranger : Airwallex n'envoie
     aucune catégorie, tout le rangement se déduit du marchand — sans
     catégories en base, il ne se passerait simplement rien. Idempotent :
     les slugs déjà présents ne bougent pas, les renommages survivent. */
  const { error: seedError } = await admin.from("finance_categories").upsert(
    DEFAULT_CATEGORIES.map((entry, index) => ({
      org_id: orgId,
      name: entry.name,
      slug: entry.slug,
      position: index,
    })) as never,
    { onConflict: "org_id,slug", ignoreDuplicates: true },
  );
  if (seedError) throw new Error(`Plan de catégories : ${seedError.message}`);

  const [{ data: categoriesData }, { data: rulesData }] = await Promise.all([
    admin.from("finance_categories").select("*").eq("org_id", orgId),
    admin.from("finance_category_rules").select("*").eq("org_id", orgId),
  ]);
  const categories = (categoriesData ?? []) as unknown as FinanceCategory[];
  const rules = (rulesData ?? []) as unknown as FinanceCategoryRule[];
  if (categories.length === 0) return;

  // Un update par catégorie visée, pas un par ligne.
  const byCategory = new Map<string, string[]>();
  for (const expense of expenses) {
    const category = resolveCategory(
      {
        category_raw: expense.category_raw,
        merchant: expense.merchant ?? expense.merchant_raw,
      },
      rules,
      categories,
    );
    if (!category) continue;
    const list = byCategory.get(category.id) ?? [];
    list.push(expense.external_id);
    byCategory.set(category.id, list);
  }

  for (const [categoryId, externalIds] of byCategory) {
    const { error } = await admin
      .from("finance_transactions")
      .update({ category_id: categoryId } as never)
      .eq("org_id", orgId)
      .in("external_id", externalIds)
      .is("category_id", null);
    if (error) throw new Error(`Catégorisation : ${error.message}`);
  }
}

// --- Grand livre -------------------------------------------------------------

async function syncLedger(orgId: string): Promise<number> {
  const admin = createAdminClient();

  const fromDate = new Date(Date.now() - LEDGER_LOOKBACK_DAYS * 24 * 3_600_000);
  const entries = await listLedgerEntries({ fromDate });
  if (entries.length === 0) return 0;

  const { error } = await admin.from("finance_ledger_entries").upsert(
    entries.map((entry) => ({
      org_id: orgId,
      external_id: entry.external_id,
      occurred_at: entry.occurred_at,
      amount_cents: entry.amount_cents,
      fee_cents: entry.fee_cents,
      net_cents: entry.net_cents,
      currency: entry.currency,
      transaction_type: entry.transaction_type,
      source_type: entry.source_type,
      description: entry.description,
      status: entry.status,
      raw: entry.raw,
      synced_at: new Date().toISOString(),
    })) as never,
    { onConflict: "org_id,external_id" },
  );
  if (error) throw new Error(`Grand livre : ${error.message}`);

  await mirrorLedgerOutflows(orgId, entries);

  return entries.length;
}

/**
 * Les sorties du grand livre — virements émis, frais — rejoignent le tableau
 * des dépenses.
 *
 * Sans cela, un virement par RIB ne s'affichait nulle part : la courbe le
 * voyait sortir du wallet, le tableau ne le connaissait pas. Les mouvements
 * de carte sont écartés par `ledgerOutflowToExpense` — ils arrivent déjà par
 * l'API Spend, avec leur marchand et leurs deux devises.
 *
 * `has_receipt` reste `false` — c'est la vérité, aucune pièce n'est attachée.
 * C'est la **lecture** qui sait qu'un virement n'en attend pas : le compteur
 * « sans reçu » les écarte et l'écran affiche « sans objet » plutôt qu'un
 * manque. Mentir dans la colonne pour arranger un compteur se paierait
 * partout ailleurs, à commencer par l'export comptable.
 */
async function mirrorLedgerOutflows(
  orgId: string,
  entries: readonly {
    external_id: string;
    occurred_at: string;
    amount_cents: number;
    currency: string;
    transaction_type: string | null;
    description: string | null;
    status: string | null;
  }[],
): Promise<void> {
  const outflows = entries
    .map(ledgerOutflowToExpense)
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  if (outflows.length === 0) return;

  const admin = createAdminClient();

  const { error } = await admin.from("finance_transactions").upsert(
    outflows.map((outflow) => ({
      org_id: orgId,
      external_id: outflow.external_id,
      occurred_at: outflow.occurred_at,
      merchant: outflow.merchant,
      merchant_raw: outflow.merchant_raw,
      amount_cents: outflow.amount_cents,
      currency: outflow.currency,
      /* Le débit vaut le montant : un mouvement du compte est déjà dans la
         devise du wallet, il n'y a pas de conversion à afficher. */
      billing_amount_cents: outflow.amount_cents,
      billing_currency: outflow.currency,
      category_raw: outflow.category_raw,
      status: outflow.status,
      source: "ledger",
      has_receipt: false,
      synced_at: new Date().toISOString(),
    })) as never,
    { onConflict: "org_id,external_id" },
  );
  if (error) throw new Error(`Sorties du compte : ${error.message}`);

  await applyCategoryRules(
    orgId,
    outflows.map((outflow) => ({
      external_id: outflow.external_id,
      category_raw: outflow.category_raw,
      merchant: outflow.merchant,
      merchant_raw: outflow.merchant_raw,
    })),
  );
}

// --- Factures ----------------------------------------------------------------

async function syncInvoices(orgId: string): Promise<number> {
  const invoices = await listIssuedInvoices();
  if (invoices.length === 0) return 0;

  /* L'API des factures ne porte que l'identifiant du client (`bcus_…`), pas
     son nom. Une résolution par client distinct — une poignée d'appels, pas
     une par facture — et un échec de résolution laisse « Client inconnu »
     plutôt que de faire échouer la synchronisation entière. */
  const names = new Map<string, string | null>();
  for (const invoice of invoices) {
    const customerId = invoice.client_external_id;
    if (!customerId || names.has(customerId)) continue;
    try {
      names.set(customerId, await getCustomerName(customerId));
    } catch {
      names.set(customerId, null);
    }
  }

  const { error } = await createAdminClient()
    .from("finance_invoices")
    .upsert(
      invoices.map((invoice) => ({
        org_id: orgId,
        external_id: invoice.external_id,
        client_name:
          (invoice.client_external_id
            ? names.get(invoice.client_external_id)
            : null) ?? invoice.client_name,
        client_external_id: invoice.client_external_id,
        amount_cents: invoice.amount_cents,
        currency: invoice.currency,
        status: invoice.status,
        raw_status: invoice.raw_status,
        issued_on: invoice.issued_on,
        due_on: invoice.due_on,
        paid_at: invoice.paid_at,
        raw: invoice.raw,
        synced_at: new Date().toISOString(),
      })) as never,
      { onConflict: "org_id,external_id" },
    );
  if (error) throw new Error(`Factures : ${error.message}`);

  return invoices.length;
}
