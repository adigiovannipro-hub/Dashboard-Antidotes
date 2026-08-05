import "server-only";

import { call } from "@/lib/airwallex/transport";
import {
  normalizeBalance,
  normalizeFinanceExpense,
  normalizeInvoice,
  type NormalizedBalance,
  type NormalizedFinanceExpense,
  type NormalizedInvoice,
} from "./normalize";

export { AirwallexError, checkConnection } from "@/lib/airwallex/transport";

/**
 * Endpoints Airwallex du module Finance — lecture seule, comme les Reçus.
 *
 * Trois lectures : les soldes du wallet, les dépenses carte, les factures
 * émises. Le transport (authentification, cache de jeton, bascule bac à
 * sable) vit dans `src/lib/airwallex/transport.ts`.
 */

// --- Soldes ------------------------------------------------------------------

export async function listBalances(): Promise<NormalizedBalance[]> {
  const raw = await call<Record<string, unknown>[]>("/api/v1/balances/current");
  return (Array.isArray(raw) ? raw : [])
    .map(normalizeBalance)
    .filter((balance): balance is NormalizedBalance => balance !== null);
}

// --- Dépenses ----------------------------------------------------------------

type Page = {
  items?: Record<string, unknown>[];
  page_after?: string;
  has_more?: boolean;
};

/**
 * Dépenses carte, avec leurs deux montants. Même endpoint que le module
 * Reçus ; la normalisation diffère — voir `normalize.ts`.
 */
export async function listFinanceExpenses(options: {
  fromDate?: Date;
  limit?: number;
} = {}): Promise<NormalizedFinanceExpense[]> {
  const limit = options.limit ?? 500;
  const collected: NormalizedFinanceExpense[] = [];
  let pageAfter: string | undefined;

  do {
    const params = new URLSearchParams({ page_size: "100" });
    if (options.fromDate) {
      params.set("from_created_at", options.fromDate.toISOString());
    }
    if (pageAfter) params.set("page_after", pageAfter);

    const page = await call<Page>(`/api/v1/spend/expenses?${params.toString()}`);

    for (const item of page.items ?? []) {
      const normalized = normalizeFinanceExpense(item);
      if (normalized) collected.push(normalized);
    }

    pageAfter = page.has_more ? page.page_after : undefined;
  } while (pageAfter && collected.length < limit);

  return collected.slice(0, limit);
}

// --- Factures ----------------------------------------------------------------

/**
 * Factures émises.
 *
 * ⚠ Chemin à confirmer au premier passage réel : la facturation est le produit
 * Airwallex le plus récent, et son API publique est moins documentée que
 * Spend. Un 404 ici remontera proprement dans `finance_sync_runs` — c'est le
 * signal qu'il faudra ajuster ce chemin, pas une panne du reste.
 */
export async function listIssuedInvoices(options: {
  limit?: number;
} = {}): Promise<NormalizedInvoice[]> {
  const limit = options.limit ?? 200;
  const collected: NormalizedInvoice[] = [];
  let pageAfter: string | undefined;

  do {
    const params = new URLSearchParams({ page_size: "100" });
    if (pageAfter) params.set("page_after", pageAfter);

    const page = await call<Page>(`/api/v1/invoices?${params.toString()}`);

    for (const item of page.items ?? []) {
      const normalized = normalizeInvoice(item);
      if (normalized) collected.push(normalized);
    }

    pageAfter = page.has_more ? page.page_after : undefined;
  } while (pageAfter && collected.length < limit);

  return collected.slice(0, limit);
}
