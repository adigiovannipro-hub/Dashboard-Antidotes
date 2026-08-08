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

/* Le montant local se déplace avec l'état de la dépense : à plat une fois
   réglée, sous `card_transaction` tant qu'elle est DRAFT — établi sur le brut
   du 7 août, où seul le débit EUR vivait à la racine. Montant et devise se
   lisent du **même** bloc : panacher deux origines fabriquerait un
   « 154 400 EUR ». */
const LOCAL_AMOUNT_SOURCES: readonly [string, string][] = [
  ["transaction_amount", "transaction_currency"],
  ["card_transaction.amount", "card_transaction.currency"],
  ["line_items.0.transaction_amount", "line_items.0.transaction_currency"],
  ["amount", "currency"],
  ["total_amount", "currency"],
];

function pickLocalAmount(
  raw: Record<string, unknown>,
): { cents: number; currency: string } | null {
  for (const [amountKey, currencyKey] of LOCAL_AMOUNT_SOURCES) {
    const cents = toCents(pick(raw, [amountKey]));
    const currency = toText(pick(raw, [currencyKey]));
    if (cents !== null && currency) return { cents, currency };
  }
  return null;
}

/** `merchant` est tantôt une chaîne nue (état DRAFT), tantôt un objet à `name`. */
function merchantName(raw: Record<string, unknown>): string | null {
  const direct = toText(raw.merchant);
  if (direct) return direct;
  return toText(pick(raw, ["merchant.name", "merchant_name", "vendor"]));
}

export function normalizeFinanceExpense(
  raw: Record<string, unknown>,
): NormalizedFinanceExpense | null {
  const externalId = toText(pick(raw, ["id", "expense_id", "transaction_id"]));

  // Le montant local d'abord — c'est lui que le commerçant a facturé. À
  // défaut, le débité fait office des deux : une ligne à un seul montant
  // reste une ligne.
  const local = pickLocalAmount(raw);
  const billingAmount = toCents(pick(raw, ["billing_amount"]));
  const billingCurrency = toText(pick(raw, ["billing_currency"]));

  const amount = local?.cents ?? billingAmount;
  const currency = local?.currency ?? billingCurrency;
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
    merchant: merchantName(raw),
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

// --- Grand livre -------------------------------------------------------------

/** Un mouvement du wallet, signé — positif quand l'argent rentre. */
export type NormalizedLedgerEntry = {
  external_id: string;
  occurred_at: string;
  amount_cents: number;
  fee_cents: number | null;
  net_cents: number | null;
  currency: string;
  transaction_type: string | null;
  source_type: string | null;
  description: string | null;
  status: string | null;
  raw: Record<string, unknown>;
};

export function normalizeLedgerEntry(
  raw: Record<string, unknown>,
): NormalizedLedgerEntry | null {
  const externalId = toText(pick(raw, ["id", "transaction_id"]));
  const amount = toCents(pick(raw, ["amount"]));
  const currency = toText(pick(raw, ["currency"]));
  const occurredAt = toIso(pick(raw, ["created_at", "posted_at", "settled_at"]));
  if (!externalId || amount === null || !currency || !occurredAt) return null;

  return {
    external_id: externalId,
    occurred_at: occurredAt,
    amount_cents: amount,
    fee_cents: toCents(pick(raw, ["fee"])),
    net_cents: toCents(pick(raw, ["net"])),
    currency: currency.toUpperCase().slice(0, 3),
    transaction_type: toText(pick(raw, ["transaction_type", "type"])),
    source_type: toText(pick(raw, ["source_type"])),
    description: toText(pick(raw, ["description"])),
    status: toText(pick(raw, ["status"])),
    raw,
  };
}

/**
 * Une sortie du grand livre vue comme une dépense du tableau.
 *
 * Un virement émis par RIB quitte le wallet exactement comme une course
 * payée à la carte : il a sa place dans les dépenses. Deux exclusions, et
 * elles sont structurantes :
 *
 *   • les mouvements `ISSUING_*` sont le reflet comptable des dépenses
 *     **carte**, déjà présentes par l'API Spend — les reprendre créerait un
 *     doublon pour chaque achat ;
 *   • les entrées (montant positif) ne sont pas des dépenses.
 *
 * L'identifiant est préfixé `ledger:` : le grand livre et les dépenses carte
 * sont deux ressources Airwallex distinctes, rien ne garantit que leurs
 * identifiants ne se croisent jamais.
 */
export type NormalizedLedgerExpense = {
  external_id: string;
  occurred_at: string;
  merchant: string;
  merchant_raw: string | null;
  amount_cents: number;
  currency: string;
  category_raw: string | null;
  status: string | null;
};

/** Le libellé français d'un mouvement, quand Airwallex n'en donne pas. */
const LEDGER_TYPE_LABELS: Record<string, string> = {
  payout: "Virement émis",
  fee: "Frais Airwallex",
  conversion: "Conversion de devise",
  refund: "Remboursement",
};

export function ledgerOutflowToExpense(entry: {
  external_id: string;
  occurred_at: string;
  amount_cents: number;
  currency: string;
  transaction_type: string | null;
  description: string | null;
  status: string | null;
}): NormalizedLedgerExpense | null {
  if (entry.amount_cents >= 0) return null;

  const type = entry.transaction_type?.trim() ?? "";
  if (type.toUpperCase().startsWith("ISSUING")) return null;

  const label = LEDGER_TYPE_LABELS[type.toLowerCase()];
  const description = toText(entry.description);

  return {
    external_id: `ledger:${entry.external_id}`,
    occurred_at: entry.occurred_at,
    // Le libellé français d'abord : c'est lui qui est stable et catégorisable,
    // là où la description varie d'un virement à l'autre.
    merchant: label ?? description ?? type ?? "Mouvement du compte",
    merchant_raw: description,
    amount_cents: -entry.amount_cents,
    currency: entry.currency,
    category_raw: type === "" ? null : type,
    status: entry.status,
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
 * L'écran Airwallex sépare **deux champs** : le statut du document
 * (« Finalisé ») et le statut de paiement (« Payé » / « Non payé »). Le
 * paiement tranche en premier : une facture finalisée et payée est `paid`,
 * finalisée et impayée est `sent` — c'est elle qu'on attend, elle qui peut
 * être en retard. Le statut seul ne suffisait pas : tout arrivait en
 * `FINALIZED`, inconnu du mapping, donc classé `draft` — et l'écran comptait
 * zéro partout.
 *
 * Un couple inconnu devient `draft` — le seul état qui ne pèse dans aucun
 * indicateur. Classer l'inconnu en `sent` gonflerait les attendus avec des
 * factures dont on ignore tout.
 */
export function mapInvoiceStatus(
  rawStatus: string | null,
  paymentStatus: string | null = null,
): FinanceInvoiceStatus {
  const status = rawStatus?.toUpperCase();

  if (status === "VOID" || status === "VOIDED" || status === "CANCELLED") {
    return "void";
  }

  switch (paymentStatus?.toUpperCase()) {
    case "PAID":
    case "SETTLED":
      return "paid";
    case "UNPAID":
    case "PARTIALLY_PAID":
    case "PARTIALLYPAID":
      // Impayée, mais émise ? Seulement si le document est bien finalisé.
      if (status === "DRAFT") return "draft";
      return "sent";
  }

  switch (status) {
    case "DRAFT":
      return "draft";
    case "FINALIZED":
    case "FINALISED":
    case "SENT":
    case "OPEN":
    case "UNPAID":
    case "OVERDUE":
    case "PARTIALLY_PAID":
      return "sent";
    case "PAID":
    case "SETTLED":
      return "paid";
    default:
      return "draft";
  }
}

/**
 * Le nom d'un client de facturation, quelle que soit sa forme : une personne
 * porte prénom + nom, une société une raison sociale. L'API ne renvoie pas la
 * même chose pour les deux.
 */
export function extractCustomerName(raw: Record<string, unknown>): string | null {
  const business = toText(
    pick(raw, ["business_name", "company_name", "legal_name", "name"]),
  );
  if (business) return business;

  const first = toText(pick(raw, ["first_name", "given_name"]));
  const last = toText(pick(raw, ["last_name", "family_name"]));
  if (first || last) return [first, last].filter(Boolean).join(" ");

  return toText(pick(raw, ["email"]));
}

export function normalizeInvoice(
  raw: Record<string, unknown>,
): NormalizedInvoice | null {
  const externalId = toText(pick(raw, ["id", "invoice_id"]));
  const amount = toCents(pick(raw, ["total_amount", "amount", "amount_due"]));
  const currency = toText(pick(raw, ["currency"]));
  if (!externalId || amount === null || !currency) return null;

  const rawStatus = toText(pick(raw, ["status", "invoice_status"]));
  const paymentStatus = toText(pick(raw, ["payment_status", "paymentStatus"]));

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
    /* `billing_customer_id` est ce que l'API renvoie réellement (préfixe
       `bcus_`) — établi sur les 30 premières factures synchronisées. Les
       autres orthographes restent en repli. */
    client_external_id: toText(
      pick(raw, ["billing_customer_id", "customer.id", "customer_id", "contact.id"]),
    ),
    amount_cents: amount,
    currency: currency.toUpperCase().slice(0, 3),
    status: mapInvoiceStatus(rawStatus, paymentStatus),
    /* Les deux champs bruts, joints : « FINALIZED/UNPAID » se relit d'un coup
       d'œil dans un diagnostic, là où « FINALIZED » seul cachait la moitié de
       l'information. */
    raw_status: paymentStatus ? `${rawStatus ?? "?"}/${paymentStatus}` : rawStatus,
    issued_on: toDateOnly(pick(raw, ["issue_date", "issued_at", "created_at"])),
    due_on: toDateOnly(pick(raw, ["due_date", "due_at"])),
    paid_at: toIso(pick(raw, ["paid_at", "settled_at"])),
    raw,
  };
}
