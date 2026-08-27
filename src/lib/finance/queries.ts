import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { BreakdownRow } from "./breakdown";
import type {
  FinanceAccount,
  FinanceBalanceSnapshot,
  FinanceCategory,
  FinanceCategoryRule,
  FinanceInvoice,
  FinanceSyncRun,
  FinanceTransaction,
} from "./types";

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

/** Une période du wallet : où en est le solde, ce qui est entré, ce qui est sorti. */
export type PeriodFlow = {
  /** `AAAA-MM` pour un mois, `AAAA-MM-JJ` pour un jour. UTC. */
  period: string;
  /** Le solde EUR à la fin de la période — celui du wallet, pas un calcul à
      part. Pour la période en cours : le solde d'aujourd'hui. */
  balance_cents: number;
  in_cents: number;
  out_cents: number;
};

/**
 * Le wallet période par période : solde de fin de période, entrées, sorties.
 *
 * Lu du grand livre Airwallex (`finance_ledger_entries`), où chaque mouvement
 * est signé : positif quand l'argent rentre, négatif quand il sort. EUR
 * seulement — c'est la devise du wallet ; les mouvements dans une autre
 * devise ne s'additionnent pas à ceux-ci, jamais de taux deviné.
 *
 * Le solde n'est pas une somme à part : il est **ancré sur le disponible
 * réel** (`balanceNowCents`, le chiffre de la carte « Disponible ») et
 * remonte le temps en retranchant les mouvements — le dernier point de la
 * courbe est donc, par construction, le montant du wallet. La marche arrière
 * prend **tous** les mouvements, réserves comprises : ce sont eux qui font
 * le solde.
 *
 * Les entrées / sorties de la période, elles, écartent les autorisations
 * carte : chaque achat pose une réserve (`HOLD`, négatif) puis la relâche
 * (`RELEASE`, positif) avant le débit réel (`CAPTURE`) — les compter
 * gonflerait les deux mesures du même montant.
 *
 * Chaque période de la fenêtre a sa ligne, même sans mouvement : l'absence
 * vaut zéro, pas « inconnu », et une courbe à trous mentirait sur la période.
 */
const TECHNICAL_LEDGER_TYPES = new Set([
  "ISSUING_AUTHORISATION_HOLD",
  "ISSUING_AUTHORISATION_RELEASE",
]);

type LedgerRow = {
  occurred_at: string;
  amount_cents: number;
  transaction_type: string | null;
};

/**
 * Le cœur commun aux deux granularités. `periods` est la liste des clés
 * attendues, de la plus ancienne à la plus récente ; `keyOf` range un
 * mouvement dans l'une d'elles.
 */
async function buildFlows(options: {
  orgId: string;
  balanceNowCents: number;
  since: Date;
  periods: string[];
  keyOf: (occurredAt: string) => string;
}): Promise<PeriodFlow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("finance_ledger_entries")
    .select("occurred_at, amount_cents, currency, transaction_type")
    .eq("org_id", options.orgId)
    .eq("currency", "EUR")
    .gte("occurred_at", options.since.toISOString())
    .limit(10_000);
  if (error) throw new Error(`Lecture du grand livre : ${error.message}`);

  const flows = new Map<string, PeriodFlow>(
    options.periods.map((period) => [
      period,
      { period, balance_cents: 0, in_cents: 0, out_cents: 0 },
    ]),
  );

  const netAllByPeriod = new Map<string, number>();
  for (const row of (data ?? []) as unknown as LedgerRow[]) {
    const period = options.keyOf(row.occurred_at);
    netAllByPeriod.set(
      period,
      (netAllByPeriod.get(period) ?? 0) + row.amount_cents,
    );

    const flow = flows.get(period);
    if (!flow) continue;
    if (row.transaction_type && TECHNICAL_LEDGER_TYPES.has(row.transaction_type)) {
      continue;
    }
    if (row.amount_cents >= 0) flow.in_cents += row.amount_cents;
    else flow.out_cents += -row.amount_cents;
  }

  // Marche arrière depuis aujourd'hui : le solde de fin de période P est le
  // disponible actuel moins tout ce qui a bougé après P.
  let balance = options.balanceNowCents;
  for (let index = options.periods.length - 1; index >= 0; index -= 1) {
    const period = options.periods[index]!;
    flows.get(period)!.balance_cents = balance;
    balance -= netAllByPeriod.get(period) ?? 0;
  }

  return options.periods.map((period) => flows.get(period)!);
}

/** Les douze derniers mois, du plus ancien au plus récent. */
export async function getMonthlyFlows(options: {
  orgId: string;
  /** Le solde EUR disponible aujourd'hui, en centimes — l'ancre de la courbe. */
  balanceNowCents: number;
  months?: number;
  now?: Date;
}): Promise<PeriodFlow[]> {
  const months = options.months ?? 12;
  const now = options.now ?? new Date();

  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1),
  );

  const periods = Array.from({ length: months }, (_, back) =>
    new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + back, 1))
      .toISOString()
      .slice(0, 7),
  );

  return buildFlows({
    orgId: options.orgId,
    balanceNowCents: options.balanceNowCents,
    since: start,
    periods,
    keyOf: (occurredAt) => occurredAt.slice(0, 7),
  });
}

/**
 * Les sept derniers jours, du plus ancien au plus récent.
 *
 * Même construction que les mois — c'est le grain qui change, pas la règle.
 * Utile quand la carte vient de bouger : à l'échelle du mois, une course à
 * 7 € ne se voit pas.
 */
export async function getDailyFlows(options: {
  orgId: string;
  balanceNowCents: number;
  days?: number;
  now?: Date;
}): Promise<PeriodFlow[]> {
  const days = options.days ?? 7;
  const now = options.now ?? new Date();

  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)),
  );

  const periods = Array.from({ length: days }, (_, forward) =>
    new Date(
      Date.UTC(
        start.getUTCFullYear(),
        start.getUTCMonth(),
        start.getUTCDate() + forward,
      ),
    )
      .toISOString()
      .slice(0, 10),
  );

  return buildFlows({
    orgId: options.orgId,
    balanceNowCents: options.balanceNowCents,
    since: start,
    periods,
    keyOf: (occurredAt) => occurredAt.slice(0, 10),
  });
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
  // Même exclusion que le compteur : un virement n'a pas de justificatif
  // manquant, il n'en attend pas.
  if (filters.missingReceipt) {
    query = query.eq("has_receipt", false).neq("source", "ledger");
  }

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

export async function getExpenseSummary(
  orgId: string,
  /** Mois observé, `AAAA-MM`. Défaut : le mois en cours. */
  month?: string | null,
): Promise<ExpenseSummary> {
  const supabase = await createClient();

  const observed = month ?? new Date().toISOString().slice(0, 7);
  const monthStart = `${observed}-01`;
  const [year, monthNumber] = observed.split("-").map(Number);
  const nextMonthStart = new Date(Date.UTC(year!, monthNumber!, 1))
    .toISOString()
    .slice(0, 10);

  const [{ data: monthRows }, { data: missingRows }] = await Promise.all([
    supabase
      .from("finance_transactions")
      .select("billing_amount_cents, billing_currency")
      .eq("org_id", orgId)
      .gte("occurred_at", monthStart)
      .lt("occurred_at", nextMonthStart)
      .limit(1000),
    /* Les sorties du compte — virements émis, frais — n'attendent aucun
       justificatif : les compter réclamerait éternellement une pièce qui
       n'existe pas. */
    supabase
      .from("finance_transactions")
      .select("id")
      .eq("org_id", orgId)
      .eq("has_receipt", false)
      .neq("source", "ledger")
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

/**
 * Les lignes de la période, réduites à ce que la répartition consomme.
 *
 * Requête à part du tableau : lui est paginé à vingt-cinq lignes, la
 * répartition doit voir **tout** le mois — sommer une page donnerait un
 * camembert qui change en tournant les pages. Colonnes minimales, plafond
 * large : trois mois de rythme actuel tiennent en ~300 lignes.
 */
export async function listExpensesForBreakdown(options: {
  orgId: string;
  /** Mois observé `AAAA-MM`, ou `null` : toute la période synchronisée. */
  month: string | null;
}): Promise<BreakdownRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("finance_transactions")
    .select(
      "billing_amount_cents, billing_currency, category_id, category_raw, merchant, merchant_raw",
    )
    .eq("org_id", options.orgId)
    .limit(2000);

  if (options.month) {
    const [year, monthNumber] = options.month.split("-").map(Number);
    query = query
      .gte("occurred_at", `${options.month}-01`)
      .lt(
        "occurred_at",
        new Date(Date.UTC(year!, monthNumber!, 1)).toISOString().slice(0, 10),
      );
  }

  const { data } = await query;
  return (data ?? []) as unknown as BreakdownRow[];
}

// --- Synchronisation -------------------------------------------------------

/**
 * Le seul dernier passage, réussi ou non — l'âge affiché en tête de Finance
 * et d'Échéances, et l'état que la route de synchronisation renvoie au badge.
 *
 * Une ligne et non vingt : les deux écrans n'affichent que celle-là, et la
 * route la relit à chaque battement du sondage.
 */
export async function getLastSyncRun(orgId: string): Promise<FinanceSyncRun | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("finance_sync_runs")
    .select("*")
    .eq("org_id", orgId)
    .order("started_at", { ascending: false })
    .limit(1);

  return ((data ?? []) as unknown as FinanceSyncRun[])[0] ?? null;
}

// --- Logos de marchands ------------------------------------------------------

/**
 * Les URL signées des logos d'une liste de marchands, indexées par clé.
 *
 * Le client de service intervient ici pour signer les URL du bucket privé —
 * même doctrine que les justificatifs : jamais servi directement, signé après
 * que la page a déjà vérifié le droit de lecture (`requireFinanceAccess`).
 * Une heure de validité : la page se re-rend bien avant.
 */
export async function getMerchantLogoUrls(
  orgId: string,
  merchantKeys: string[],
): Promise<Record<string, string>> {
  if (merchantKeys.length === 0) return {};

  const supabase = await createClient();
  const { data } = await supabase
    .from("finance_merchant_logos")
    .select("merchant_key, storage_path")
    .eq("org_id", orgId)
    .in("merchant_key", merchantKeys)
    .not("storage_path", "is", null);

  const rows = (data ?? []) as unknown as {
    merchant_key: string;
    storage_path: string;
  }[];
  if (rows.length === 0) return {};

  const { createAdminClient } = await import("@/lib/supabase/server");
  const { data: signed } = await createAdminClient()
    .storage.from("merchant-logos")
    .createSignedUrls(
      rows.map((row) => row.storage_path),
      3_600,
    );

  const urls: Record<string, string> = {};
  for (const [index, row] of rows.entries()) {
    const url = signed?.[index]?.signedUrl;
    if (url) urls[row.merchant_key] = url;
  }
  return urls;
}
