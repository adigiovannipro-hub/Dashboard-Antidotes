/**
 * Normalisation des réponses Airwallex vers les lignes du module Finance.
 *
 * Pur et sans réseau : la partie testable de la synchronisation. Les noms de
 * champs de l'API ne sont pas figés par un contrat stable — chaque lecture
 * accepte plusieurs orthographes plausibles et la réponse brute est conservée
 * en base, pour retraiter sans resynchroniser.
 *
 * La règle qui distingue ce normaliseur de celui des Reçus : ici les **deux**
 * montants d'une dépense sont conservés — le local (« 158 800 IDR ») et le
 * débité (« 7,73 EUR »). Le tableau Airwallex les affiche côte à côte, le
 * nôtre aussi.
 */

import type { FinanceInvoiceStatus } from "./types";

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

/** Décimal → centimes. L'arrondi n'est pas une précaution : `24.5 × 100`
    donne 2449,999… en flottant. */
function toCents(value: unknown): number | null {
  if (typeof value === "number") return Math.round(value * 100);
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
  }
  return null;
}

function toIso(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toDateOnly(value: unknown): string | null {
  const iso = toIso(value);
  return iso ? iso.slice(0, 10) : null;
}

function toText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

// --- Soldes ------------------------------------------------------------------

export type NormalizedBalance = {
  currency: string;
  available_cents: number;
  pending_cents: number;
  reserved_cents: number;
};

export function normalizeBalance(
  raw: Record<string, unknown>,
): NormalizedBalance | null {
  const currency = toText(pick(raw, ["currency"]));
  const available = toCents(pick(raw, ["available_amount", "available"]));
  if (!currency || available === null) return null;

  return {
    currency: currency.toUpperCase().slice(0, 3),
    available_cents: available,
    pending_cents: toCents(pick(raw, ["pending_amount", "pending"])) ?? 0,
    reserved_cents: toCents(pick(raw, ["reserved_amount", "reserved"])) ?? 0,
  };
}

// --- Dépenses ----------------------------------------------------------------

export type NormalizedFinanceExpense = {
  external_id: string;
  occurred_at: string;
  posted_at: string | null;
  merchant: string | null;
  merchant_raw: string | null;
  amount_cents: number;
  currency: string;
  billing_amount_cents: number | null;
  billing_currency: string | null;
  category_raw: string | null;
  status: string | null;
  has_receipt: boolean;
  card_last_four: string | null;
  cardholder_name: string | null;
  raw: Record<string, unknown>;
};

export function normalizeFinanceExpense(
  raw: Record<string, unknown>,
): NormalizedFinanceExpense | null {
  const externalId = toText(pick(raw, ["id", "expense_id", "transaction_id"]));

  // Le montant local d'abord — c'est lui que le commerçant a facturé. À
  // défaut, le débité fait office des deux : une ligne à un seul montant
  // reste une ligne.
  const localAmount = toCents(pick(raw, ["transaction_amount", "amount", "total_amount"]));
  const localCurrency = toText(pick(raw, ["transaction_currency", "currency"]));
  const billingAmount = toCents(pick(raw, ["billing_amount"]));
  const billingCurrency = toText(pick(raw, ["billing_currency"]));

  const amount = localAmount ?? billingAmount;
  const currency = localCurrency ?? billingCurrency;
  const occurredAt = toIso(
    pick(raw, ["transaction_time", "transaction_date", "created_at"]),
  );

  // Sans identifiant, montant, devise ou date, la ligne n'est bonne à rien :
  // ni à afficher, ni à rapprocher. Mieux vaut la laisser tomber bruyamment.
  if (!externalId || amount === null || !currency || !occurredAt) return null;

  const attachments = pick(raw, ["attachments", "receipts"]);
  const attachmentCount = Array.isArray(attachments)
    ? attachments.length
    : ((pick(raw, ["attachment_count", "receipt_count"]) as number | undefined) ?? 0);

  return {
    external_id: externalId,
    occurred_at: occurredAt,
    posted_at: toIso(pick(raw, ["posted_at", "posted_time", "updated_at"])),
    merchant: toText(pick(raw, ["merchant.name", "merchant_name", "vendor"])),
    merchant_raw: toText(
      pick(raw, ["merchant.description", "description", "merchant_raw", "narrative"]),
    ),
    amount_cents: amount,
    currency: currency.toUpperCase().slice(0, 3),
    billing_amount_cents: billingAmount,
    billing_currency: billingCurrency
      ? billingCurrency.toUpperCase().slice(0, 3)
      : null,
    category_raw: toText(
      pick(raw, ["category", "expense_category", "category_name"]),
    ),
    status: toText(pick(raw, ["status", "expense_status"])),
    has_receipt: attachmentCount > 0,
    card_last_four: toText(
      pick(raw, ["card.last_four", "card_last_four", "last_four"]),
    ),
    cardholder_name: toText(
      pick(raw, ["employee.name", "cardholder_name", "employee_name"]),
    ),
    raw,
  };
}

// --- Factures ----------------------------------------------------------------

export type NormalizedInvoice = {
  external_id: string;
  client_name: string;
  client_external_id: string | null;
  amount_cents: number;
  currency: string;
  status: FinanceInvoiceStatus;
  raw_status: string | null;
  issued_on: string | null;
  due_on: string | null;
  paid_at: string | null;
  raw: Record<string, unknown>;
};

/**
 * Ramène le vocabulaire d'Airwallex sur nos quatre états. `overdue` n'existe
 * pas ici : le retard se calcule à la lecture, sur l'échéance.
 *
 * Un statut inconnu devient `draft` — le seul état qui ne pèse dans aucun
 * indicateur. Classer l'inconnu en `sent` gonflerait « attendu ce mois » avec
 * des factures dont on ignore tout.
 */
export function mapInvoiceStatus(rawStatus: string | null): FinanceInvoiceStatus {
  switch (rawStatus?.toUpperCase()) {
    case "DRAFT":
      return "draft";
    case "SENT":
    case "OPEN":
    case "UNPAID":
    case "OVERDUE":
    case "PARTIALLY_PAID":
      return "sent";
    case "PAID":
    case "SETTLED":
      return "paid";
    case "VOID":
    case "VOIDED":
    case "CANCELLED":
      return "void";
    default:
      return "draft";
  }
}

export function normalizeInvoice(
  raw: Record<string, unknown>,
): NormalizedInvoice | null {
  const externalId = toText(pick(raw, ["id", "invoice_id"]));
  const amount = toCents(pick(raw, ["total_amount", "amount", "amount_due"]));
  const currency = toText(pick(raw, ["currency"]));
  if (!externalId || amount === null || !currency) return null;

  const rawStatus = toText(pick(raw, ["status", "invoice_status"]));

  return {
    external_id: externalId,
    client_name:
      toText(
        pick(raw, [
          "customer.name",
          "customer_name",
          "contact.name",
          "counterparty.name",
          "recipient_name",
        ]),
      ) ?? "Client inconnu",
    client_external_id: toText(pick(raw, ["customer.id", "customer_id", "contact.id"])),
    amount_cents: amount,
    currency: currency.toUpperCase().slice(0, 3),
    status: mapInvoiceStatus(rawStatus),
    raw_status: rawStatus,
    issued_on: toDateOnly(pick(raw, ["issue_date", "issued_at", "created_at"])),
    due_on: toDateOnly(pick(raw, ["due_date", "due_at"])),
    paid_at: toIso(pick(raw, ["paid_at", "settled_at"])),
    raw,
  };
}
