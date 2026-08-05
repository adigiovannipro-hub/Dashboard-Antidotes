/**
 * Export CSV du tableau des dépenses.
 *
 * Conventions françaises, parce que le fichier s'ouvrira dans un Excel
 * français : séparateur `;`, décimales à virgule, BOM UTF-8 pour que les
 * accents survivent au double-clic, fins de ligne CRLF.
 */

import { centsToCsvDecimal } from "./money";
import { transactionStatusLabel, type FinanceTransaction } from "./types";

const BOM = "\uFEFF";
const SEPARATOR = ";";
const EOL = "\r\n";

const HEADER = [
  "Date",
  "Marchand",
  "Montant",
  "Devise",
  "Montant débité",
  "Devise débitée",
  "Catégorie",
  "Statut",
  "Justificatif",
  "Source",
];

/** `2026-08-05T06:32:00Z` → « 05/08/2026 » — ce qu'Excel fr sait trier. */
function csvDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

function escapeCell(value: string): string {
  if (
    value.includes(SEPARATOR) ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export function buildExpensesCsv(
  transactions: readonly (FinanceTransaction & { category_name: string | null })[],
): string {
  const lines = [HEADER.join(SEPARATOR)];

  for (const transaction of transactions) {
    const cells = [
      csvDate(transaction.occurred_at),
      transaction.merchant ?? transaction.merchant_raw ?? "",
      centsToCsvDecimal(transaction.amount_cents),
      transaction.currency.toUpperCase(),
      transaction.billing_amount_cents === null
        ? ""
        : centsToCsvDecimal(transaction.billing_amount_cents),
      transaction.billing_currency?.toUpperCase() ?? "",
      transaction.category_name ?? transaction.category_raw ?? "",
      transactionStatusLabel(transaction.status).label,
      transaction.has_receipt ? "oui" : "non",
      transaction.source,
    ];
    lines.push(cells.map(escapeCell).join(SEPARATOR));
  }

  return BOM + lines.join(EOL) + EOL;
}
