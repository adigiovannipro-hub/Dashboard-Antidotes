import "server-only";

import { AirwallexError, call } from "@/lib/airwallex/transport";
import {
  extractCustomerName,
  normalizeBalance,
  normalizeFinanceExpense,
  normalizeInvoice,
  type NormalizedBalance,
  type NormalizedFinanceExpense,
  type NormalizedInvoice,
} from "./normalize";

export { AirwallexError, checkConnection } from "@/lib/airwallex/transport";

// --- Clients de facturation --------------------------------------------------

/* Les deux chemins plausibles pour un identifiant `bcus_` : la documentation
   du produit facturation ne tranche pas, le premier passage réel tranchera.
   Un chemin qui répond 404 ou 400 est écarté sans bruit ; toute autre erreur
   remonte — un 401 signifierait un vrai problème, pas un mauvais chemin. */
const CUSTOMER_PATHS = [
  (id: string) => `/api/v1/customers/${id}`,
  (id: string) => `/api/v1/billing/customers/${id}`,
  (id: string) => `/api/v1/invoicing/customers/${id}`,
];

/**
 * Le nom d'un client de facturation, résolu depuis son identifiant `bcus_…`.
 * `null` quand aucun chemin ne le connaît — la facture gardera « Client
 * inconnu » plutôt qu'un nom inventé.
 */
export async function getCustomerName(customerId: string): Promise<string | null> {
  for (const buildPath of CUSTOMER_PATHS) {
    try {
      const raw = await call<Record<string, unknown>>(buildPath(customerId));
      const name = extractCustomerName(raw);
      if (name) return name;
    } catch (error) {
      if (
        error instanceof AirwallexError &&
        (error.status === 404 || error.status === 400 || error.status === 405)
      ) {
        continue;
      }
      throw error;
    }
  }
  return null;
}

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
