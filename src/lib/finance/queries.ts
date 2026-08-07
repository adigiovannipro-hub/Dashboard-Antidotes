import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  buildBalanceSeries,
  buildExpenseBuckets,
  type SeriesExpense,
  type SeriesPoint,
} from "./series";
import type {
  ChartWindow,
  FinanceAccount,
  FinanceBalanceSnapshot,
  FinanceCategory,
  FinanceCategoryRule,
  FinanceInvoice,
  FinanceSyncKind,
  FinanceSyncRun,
  FinanceTransaction,
} from "./types";
import { CHART_WINDOWS } from "./types";

/**
 * Lectures de l'écran Finance.
 *
 * Toutes passent par le client porteur de la session, donc par la RLS : un
 * oubli de filtre ici ne peut pas faire fuiter la comptabilité, la base
 * refuserait de la rendre. Le dashboard ne parle jamais à Airwallex — il lit
 * ce que la synchronisation a laissé.
 */

// --- Trésorerie ------------------------------------------------------------

export type TreasuryAccount = {
  account: FinanceAccount;
  latest: FinanceBalanceSnapshot | null;
};

export type Treasury = {
  /** Comptes EUR, leur dernier solde connu. */
  accounts: TreasuryAccount[];
  /** Somme des soldes disponibles EUR, en centimes. */
  total_cents: number;
  /** Devises présentes hors EUR — signalées, pas totalisées. */
  other_currencies: string[];
};

export async function getTreasury(orgId: string): Promise<Treasury> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("finance_accounts")
    .select("*")
    .eq("org_id", orgId)
    .order("currency")
    .order("name");
  if (error) throw new Error(`Lecture des comptes : ${error.message}`);

  const accounts = (data ?? []) as unknown as FinanceAccount[];
  const eurAccounts = accounts.filter((account) => account.currency === "EUR");

  // Un dernier instantané par compte. Une requête chacun : il y a une poignée
  // de wallets, et postgrest ne sait pas faire « le dernier par groupe ».
  const latests = await Promise.all(
    eurAccounts.map(async (account) => {
      const { data: rows, error: snapshotError } = await supabase
        .from("finance_balances_history")
        .select("*")
        .eq("account_id", account.id)
        .order("snapshot_hour", { ascending: false })
        .limit(1);
      if (snapshotError) {
        throw new Error(`Lecture des soldes : ${snapshotError.message}`);
      }
      return {
        account,
        latest: (rows?.[0] ?? null) as unknown as FinanceBalanceSnapshot | null,
      };
    }),
  );

  return {
    accounts: latests,
    total_cents: latests.reduce(
      (sum, entry) => sum + (entry.latest?.available_cents ?? 0),
      0,
    ),
    other_currencies: [
      ...new Set(
        accounts
          .map((account) => account.currency)
          .filter((currency) => currency !== "EUR"),
      ),
    ],
  };
}

// --- Courbe ----------------------------------------------------------------

export type BalanceSeriesByWindow = Record<ChartWindow, SeriesPoint[]>;

/**
 * Les trois fenêtres d'un coup, construites côté serveur : le client reçoit
 * ~300 points au lieu des milliers d'instantanés horaires, et le toggle
 * 7 j / 30 j / 90 j n'a pas besoin d'un aller-retour.
 */
export async function getBalanceSeries(
  orgId: string,
  now: Date = new Date(),
): Promise<BalanceSeriesByWindow> {
  const supabase = await createClient();

  const oldest = new Date(now.getTime() - 91 * 24 * 3_600_000).toISOString();
  const { data, error } = await supabase
    .from("finance_balances_history")
    .select("account_id, available_cents, snapshot_hour")
    .eq("org_id", orgId)
    .eq("currency", "EUR")
    .gte("snapshot_hour", oldest)
    .order("snapshot_hour");
  if (error) throw new Error(`Lecture de l'historique : ${error.message}`);

  const snapshots = (data ?? []) as unknown as {
    account_id: string;
    available_cents: number;
    snapshot_hour: string;
  }[];

  return Object.fromEntries(
    CHART_WINDOWS.map((window) => [
      window,
      buildBalanceSeries(snapshots, window, now),
    ]),
  ) as BalanceSeriesByWindow;
}

/** Dépenses agrégées par créneau, indexées par le début de créneau ISO. */
export type ExpenseBucketsByWindow = Record<ChartWindow, Record<string, number>>;

/**
 * Ce qui est sorti du wallet, sur la même grille que la courbe du solde.
 *
 * Le graphe superpose les deux : la ligne verte dit où en est la trésorerie,
 * les barres rouges disent ce qui l'a fait bouger. Sans elles, un décrochage
 * de la courbe ne se distingue pas d'un trou de synchronisation.
 */
export async function getExpenseSeries(
  orgId: string,
  now: Date = new Date(),
): Promise<ExpenseBucketsByWindow> {
  const supabase = await createClient();

  const oldest = new Date(now.getTime() - 91 * 24 * 3_600_000).toISOString();
  const { data, error } = await supabase
    .from("finance_transactions")
    .select("occurred_at, billing_amount_cents, billing_currency")
    .eq("org_id", orgId)
    .eq("billing_currency", "EUR")
    .gte("occurred_at", oldest)
    .order("occurred_at")
    .limit(5_000);
  if (error) throw new Error(`Lecture des dépenses de la courbe : ${error.message}`);

  const expenses = (data ?? []) as unknown as SeriesExpense[];

  return Object.fromEntries(
    CHART_WINDOWS.map((window) => [
      window,
      buildExpenseBuckets(expenses, window, now),
    ]),
  ) as ExpenseBucketsByWindow;
}

// --- Factures --------------------------------------------------------------

/**
 * Les factures ouvertes, plus les payées récentes : l'écran montre l'encours,
 * pas les archives — une facture soldée depuis six mois n'apprend rien.
 */
export async function listInvoices(orgId: string): Promise<FinanceInvoice[]> {
  const supabase = await createClient();

  const horizon = new Date();
  horizon.setMonth(horizon.getMonth() - 3);
  const horizonDate = horizon.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("finance_invoices")
    .select("*")
    .eq("org_id", orgId)
    .or(`status.in.(draft,sent),issued_on.gte.${horizonDate}`)
    .order("due_on", { ascending: true, nullsFirst: false });
  if (error) throw new Error(`Lecture des factures : ${error.message}`);

  return (data ?? []) as unknown as FinanceInvoice[];
}

// --- Dépenses --------------------------------------------------------------

export type ExpenseFilters = {
  /** Bornes calendaires incluses, YYYY-MM-DD. */
  from?: string;
  to?: string;
  /** Identifiant de catégorie, ou `"aucune"` pour les lignes non rangées. */
  categoryId?: string;
  /** Ne garder que les lignes sans justificatif. */
  missingReceipt?: boolean;
};

export type ExpenseSortField = "occurred_at" | "billing" | "merchant";

export type ExpenseSort = {
  field: ExpenseSortField;
  direction: "asc" | "desc";
};

export const EXPENSES_PAGE_SIZE = 25;

/** Plafond de l'export : au-delà, c'est un dump de base, pas un export. */
const EXPORT_CAP = 5_000;

type Supabase = Awaited<ReturnType<typeof createClient>>;

function nextDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
}

/* Le même constructeur sert le tableau et l'export CSV : deux implémentations
   finiraient par diverger, et l'export mentirait sur ce que l'écran montre. */
function expenseQuery(
  supabase: Supabase,
  orgId: string,
  filters: ExpenseFilters,
  sort: ExpenseSort,
) {
  let query = supabase
    .from("finance_transactions")
    .select("*", { count: "exact" })
    .eq("org_id", orgId);

  if (filters.from) query = query.gte("occurred_at", filters.from);
  if (filters.to) query = query.lt("occurred_at", nextDay(filters.to));
  if (filters.categoryId === "aucune") {
    query = query.is("category_id", null);
  } else if (filters.categoryId) {
    query = query.eq("category_id", filters.categoryId);
  }
  if (filters.missingReceipt) query = query.eq("has_receipt", false);

  const ascending = sort.direction === "asc";
  if (sort.field === "billing") {
    // Les montants débités se comparent entre eux : même devise. Les lignes
    // dont Airwallex n'a pas encore fixé le débit partent en queue.
    return query.order("billing_amount_cents", { ascending, nullsFirst: false });
  }
  if (sort.field === "merchant") {
    return query.order("merchant", { ascending, nullsFirst: false });
  }
  return query.order("occurred_at", { ascending });
}

export type ExpensePage = {
  rows: FinanceTransaction[];
  total: number;
  page: number;
  page_count: number;
};

export async function listExpenses({
  orgId,
  filters,
  sort,
  page,
}: {
  orgId: string;
  filters: ExpenseFilters;
  sort: ExpenseSort;
  page: number;
}): Promise<ExpensePage> {
  const supabase = await createClient();

  const start = (page - 1) * EXPENSES_PAGE_SIZE;
  const { data, count, error } = await expenseQuery(
    supabase,
    orgId,
    filters,
    sort,
  ).range(start, start + EXPENSES_PAGE_SIZE - 1);
  if (error) throw new Error(`Lecture des dépenses : ${error.message}`);

  const total = count ?? 0;
  return {
    rows: (data ?? []) as unknown as FinanceTransaction[],
    total,
    page,
    page_count: Math.max(1, Math.ceil(total / EXPENSES_PAGE_SIZE)),
  };
}

export async function listExpensesForExport({
  orgId,
  filters,
  sort,
}: {
  orgId: string;
  filters: ExpenseFilters;
  sort: ExpenseSort;
}): Promise<FinanceTransaction[]> {
  const supabase = await createClient();

  const { data, error } = await expenseQuery(supabase, orgId, filters, sort)
    .limit(EXPORT_CAP);
  if (error) throw new Error(`Export des dépenses : ${error.message}`);

  return (data ?? []) as unknown as FinanceTransaction[];
}

// --- Catégories ------------------------------------------------------------

/**
 * Deux mesures de dépense pour la bande haute.
 *
 * Le mois en cours est compté sur le **montant débité du wallet**
 * (`billing_amount_cents`), pas sur le montant facturé par le commerçant :
 * une course en roupies ne s'additionne pas à un abonnement en euros, et
 * c'est le débit qui a réellement quitté le compte. Les lignes sans montant
 * débité — une dépense saisie à la main, par exemple — sont donc hors du
 * total, et le compteur de justificatifs, lui, les compte toutes.
 */
export type ExpenseSummary = {
  month_billed_cents: number;
  month_count: number;
  missing_receipts: number;
};

export async function getExpenseSummary(orgId: string): Promise<ExpenseSummary> {
  const supabase = await createClient();
  const monthStart = `${new Date().toISOString().slice(0, 7)}-01`;

  const [{ data: monthRows }, { data: missingRows }] = await Promise.all([
    supabase
      .from("finance_transactions")
      .select("billing_amount_cents, billing_currency")
      .eq("org_id", orgId)
      .gte("occurred_at", monthStart)
      .limit(1000),
    supabase
      .from("finance_transactions")
      .select("id")
      .eq("org_id", orgId)
      .eq("has_receipt", false)
      .limit(1000),
  ]);

  const rows = (monthRows ?? []) as unknown as {
    billing_amount_cents: number | null;
    billing_currency: string | null;
  }[];

  return {
    month_billed_cents: rows.reduce(
      (sum, row) =>
        row.billing_currency === "EUR" ? sum + (row.billing_amount_cents ?? 0) : sum,
      0,
    ),
    month_count: rows.length,
    missing_receipts: (missingRows ?? []).length,
  };
}

export async function listCategories(orgId: string): Promise<FinanceCategory[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("finance_categories")
    .select("*")
    .eq("org_id", orgId)
    .order("position")
    .order("name");
  if (error) throw new Error(`Lecture des catégories : ${error.message}`);

  return (data ?? []) as unknown as FinanceCategory[];
}

export async function listCategoryRules(
  orgId: string,
): Promise<FinanceCategoryRule[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("finance_category_rules")
    .select("*")
    .eq("org_id", orgId);
  if (error) throw new Error(`Lecture des règles de catégories : ${error.message}`);

  return (data ?? []) as unknown as FinanceCategoryRule[];
}

// --- Synchronisation -------------------------------------------------------

export type SyncOverview = {
  /** Le tout dernier passage, quel qu'en soit le sort. */
  last_run: FinanceSyncRun | null;
  /** Le dernier passage de chaque nature, pour le détail. */
  by_kind: Partial<Record<FinanceSyncKind, FinanceSyncRun>>;
};

export async function getSyncOverview(orgId: string): Promise<SyncOverview> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("finance_sync_runs")
    .select("*")
    .eq("org_id", orgId)
    .order("started_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(`Lecture du journal de synchronisation : ${error.message}`);

  const runs = (data ?? []) as unknown as FinanceSyncRun[];
  const byKind: SyncOverview["by_kind"] = {};
  for (const run of runs) {
    byKind[run.kind] ??= run;
  }

  return { last_run: runs[0] ?? null, by_kind: byKind };
}
