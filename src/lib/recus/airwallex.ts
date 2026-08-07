import "server-only";

import { call } from "@/lib/airwallex/transport";

export { AirwallexError, checkConnection } from "@/lib/airwallex/transport";

/**
 * Endpoints Airwallex du module Reçus — lecture seule.
 *
 * Le module n'écrit rien ici, et ce n'est pas un choix de conception : l'API
 * publique Spend expose `List card expenses`, `Get card expense` et un marqueur
 * de synchronisation, mais **aucun endpoint de dépôt de pièce jointe**. Le seul
 * chemin d'écriture est le transfert de mail vers leur boîte de reçus, traité
 * dans `forward.ts`.
 *
 * L'authentification et le cache de jeton vivent dans
 * `src/lib/airwallex/transport.ts`, partagés avec le module Finance.
 *
 * Les noms de champs de la réponse ne sont pas figés par un contrat public
 * stable. `normalizeExpense` accepte donc plusieurs orthographes plausibles et
 * conserve la réponse brute : le jour où un champ change de nom, on retraite
 * l'historique sans avoir à resynchroniser douze mois.
 */

// --- Normalisation -----------------------------------------------------------

export type NormalizedExpense = {
  external_id: string;
  merchant: string | null;
  /** Montant **local** — celui que le commerçant a facturé, celui que portent
      les reçus. Une course Grab est en IDR ici, jamais en EUR. */
  amount_cents: number;
  currency: string;
  /** Ce qui a réellement quitté le wallet — null tant qu'Airwallex n'a pas
      fixé le débit. */
  billing_amount_cents: number | null;
  billing_currency: string | null;
  transaction_date: string | null;
  posted_at: string | null;
  card_last_four: string | null;
  cardholder_name: string | null;
  category: string | null;
  expense_status: string | null;
  attachment_count: number;
  raw: Record<string, unknown>;
};

function pick(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const parts = key.split(".");
    let value: unknown = source;
    for (const part of parts) {
      if (value && typeof value === "object" && part in (value as object)) {
        value = (value as Record<string, unknown>)[part];
      } else {
        value = undefined;
        break;
      }
    }
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

/**
 * Convertit un montant décimal en centimes.
 *
 * Airwallex renvoie des montants décimaux (`24.5`). Multiplier un flottant par
 * cent donne 2449,9999… : l'arrondi n'est pas une précaution, il est nécessaire.
 */
function toCents(value: unknown): number | null {
  if (typeof value === "number") return Math.round(value * 100);
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
  }
  return null;
}

function toDateOnly(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function normalizeExpense(
  raw: Record<string, unknown>,
): NormalizedExpense | null {
  const externalId = pick(raw, ["id", "expense_id", "transaction_id"]);

  /* Le montant **local d'abord** — c'est lui que portent les reçus. L'ancien
     ordre piochait `billing_amount` en premier : une course Grab entrait à
     « 7,56 EUR » quand son e-reçu disait « 154 400 IDR », et le rapprochement
     ne pouvait jamais aboutir. Le débité reste conservé, à côté. */
  const localAmount = toCents(
    pick(raw, ["transaction_amount", "amount", "total_amount"]),
  );
  const localCurrency = pick(raw, ["transaction_currency", "currency"]);
  const billingAmount = toCents(pick(raw, ["billing_amount"]));
  const billingCurrency = pick(raw, ["billing_currency"]);

  const amount = localAmount ?? billingAmount;
  const currency =
    typeof localCurrency === "string"
      ? localCurrency
      : typeof billingCurrency === "string"
        ? billingCurrency
        : null;

  // Sans identifiant, montant ou devise, la ligne n'est bonne à rien : ni à
  // rapprocher, ni à afficher. Mieux vaut la laisser tomber bruyamment.
  if (typeof externalId !== "string" || amount === null || currency === null) {
    return null;
  }

  const attachments = pick(raw, ["attachments", "receipts"]);

  return {
    external_id: externalId,
    merchant:
      (pick(raw, [
        "merchant.name",
        "merchant_name",
        "description",
        "vendor",
      ]) as string | undefined) ?? null,
    amount_cents: amount,
    currency: currency.toUpperCase().slice(0, 3),
    billing_amount_cents: billingAmount,
    billing_currency:
      typeof billingCurrency === "string"
        ? billingCurrency.toUpperCase().slice(0, 3)
        : null,
    transaction_date: toDateOnly(
      pick(raw, ["transaction_date", "transaction_time", "created_at"]),
    ),
    posted_at:
      (pick(raw, ["posted_at", "posted_time", "updated_at"]) as string | undefined) ??
      null,
    card_last_four:
      (pick(raw, ["card.last_four", "card_last_four", "last_four"]) as
        | string
        | undefined) ?? null,
    cardholder_name:
      (pick(raw, ["employee.name", "cardholder_name", "employee_name"]) as
        | string
        | undefined) ?? null,
    category:
      (pick(raw, ["category", "expense_category", "category_name"]) as
        | string
        | undefined) ?? null,
    expense_status:
      (pick(raw, ["status", "expense_status"]) as string | undefined) ?? null,
    attachment_count: Array.isArray(attachments) ? attachments.length : 0,
    raw,
  };
}

// --- Endpoints ---------------------------------------------------------------

type ExpensePage = {
  items?: Record<string, unknown>[];
  page_after?: string;
  has_more?: boolean;
};

/**
 * Dépenses carte, de la plus récente à la plus ancienne.
 *
 * `limit` borne le nombre de pages : une resynchronisation complète ne doit pas
 * pouvoir tourner indéfiniment dans un cron dont le temps d'exécution est
 * plafonné par l'hébergeur.
 */
export async function listExpenses(options: {
  fromDate?: Date;
  limit?: number;
} = {}): Promise<NormalizedExpense[]> {
  const limit = options.limit ?? 500;
  const collected: NormalizedExpense[] = [];
  let pageAfter: string | undefined;

  do {
    const params = new URLSearchParams({ page_size: "100" });
    if (options.fromDate) {
      params.set("from_created_at", options.fromDate.toISOString());
    }
    if (pageAfter) params.set("page_after", pageAfter);

    const page = await call<ExpensePage>(
      `/api/v1/spend/expenses?${params.toString()}`,
    );

    for (const item of page.items ?? []) {
      const normalized = normalizeExpense(item);
      if (normalized) collected.push(normalized);
    }

    pageAfter = page.has_more ? page.page_after : undefined;
  } while (pageAfter && collected.length < limit);

  return collected.slice(0, limit);
}

export async function getExpense(
  externalId: string,
): Promise<NormalizedExpense | null> {
  const raw = await call<Record<string, unknown>>(
    `/api/v1/spend/expenses/${encodeURIComponent(externalId)}`,
  );
  return normalizeExpense(raw);
}
