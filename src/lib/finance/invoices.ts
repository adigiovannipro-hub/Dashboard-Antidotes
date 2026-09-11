/**
 * Lecture métier des factures émises : retard, indicateurs, regroupement.
 *
 * Le retard n'existe pas en base — c'est un fait qui dépend de l'heure qu'il
 * est. Il se calcule ici, à la lecture, sur la date d'échéance : une facture
 * `sent` dont l'échéance est passée est en retard, quel que soit ce
 * qu'Airwallex affichera demain.
 */

import type { FinanceInvoice } from "./types";

/** Sommes par devise : `{ EUR: 1234500, USD: 20000 }`, en centimes. */
export type CurrencyTotals = Record<string, number>;

function addTo(totals: CurrencyTotals, currency: string, cents: number) {
  const code = currency.toUpperCase();
  totals[code] = (totals[code] ?? 0) + cents;
}

/** Date locale (YYYY-MM-DD) comparée à une date calendaire, sans heure. */
function toDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isOverdue(
  invoice: Pick<FinanceInvoice, "status" | "due_on">,
  today: Date = new Date(),
): boolean {
  if (invoice.status !== "sent") return false;
  if (!invoice.due_on) return false;
  return invoice.due_on < toDateOnly(today);
}

export type InvoiceKpis = {
  /** Factures émises dans le mois en cours, payées ou non — le chiffre
      d'affaires facturé du mois, celui qu'on lit en haut d'Airwallex. */
  issued_this_month: CurrencyTotals;
  issued_this_month_count: number;
  /** Factures envoyées, impayées, dont l'échéance est dépassée. */
  overdue: CurrencyTotals;
  overdue_count: number;
};

export function invoiceKpis(
  invoices: readonly FinanceInvoice[],
  today: Date = new Date(),
): InvoiceKpis {
  const monthPrefix = toDateOnly(today).slice(0, 7);
  const issued: CurrencyTotals = {};
  const overdue: CurrencyTotals = {};
  let issuedCount = 0;
  let overdueCount = 0;

  for (const invoice of invoices) {
    /* Le mois se mesure à l'émission, pas à l'échéance : « qu'est-ce que j'ai
       facturé en août » est la question posée, et une facture émise le 6 août
       à échéance du 5 septembre appartient à août. Payée ou non, elle a été
       émise ; seuls brouillons et annulées n'existent pas encore. */
    if (
      invoice.status !== "draft" &&
      invoice.status !== "void" &&
      invoice.issued_on?.startsWith(monthPrefix)
    ) {
      addTo(issued, invoice.currency, invoice.amount_cents);
      issuedCount += 1;
    }
    if (isOverdue(invoice, today)) {
      addTo(overdue, invoice.currency, invoice.amount_cents);
      overdueCount += 1;
    }
  }

  return {
    issued_this_month: issued,
    issued_this_month_count: issuedCount,
    overdue,
    overdue_count: overdueCount,
  };
}

export type ClientInvoiceGroup = {
  client_name: string;
  invoices: FinanceInvoice[];
  /** Total des factures encore ouvertes (`draft` + `sent`) du client. */
  open_totals: CurrencyTotals;
};

/**
 * Regroupe par client, les clients au plus gros encours en premier. Les
 * factures d'un client se lisent de la plus proche échéance à la plus
 * lointaine — c'est l'ordre dans lequel on les relance.
 *
 * Une facture **annulée** ne forme jamais de groupe : le panneau annonce
 * l'encours, et un client qui n'a plus qu'une facture `void` n'en a pas.
 * `listInvoices` l'écarte déjà côté lecture ; la garde est ici en ceinture,
 * parce que la synchronisation horaire réécrit ces lignes en base et qu'un
 * appelant futur pourrait les repasser sans le savoir.
 */
export function groupInvoicesByClient(
  invoices: readonly FinanceInvoice[],
): ClientInvoiceGroup[] {
  const groups = new Map<string, ClientInvoiceGroup>();

  for (const invoice of invoices) {
    if (invoice.status === "void") continue;
    let group = groups.get(invoice.client_name);
    if (!group) {
      group = { client_name: invoice.client_name, invoices: [], open_totals: {} };
      groups.set(invoice.client_name, group);
    }
    group.invoices.push(invoice);
    if (invoice.status === "draft" || invoice.status === "sent") {
      addTo(group.open_totals, invoice.currency, invoice.amount_cents);
    }
  }

  for (const group of groups.values()) {
    group.invoices.sort((a, b) =>
      (a.due_on ?? "9999-12-31").localeCompare(b.due_on ?? "9999-12-31"),
    );
  }

  return [...groups.values()].sort(
    (a, b) => sumTotals(b.open_totals) - sumTotals(a.open_totals),
  );
}

/* Somme brute inter-devises, uniquement pour ordonner les groupes : un ordre
   de tri tolère l'approximation qu'une addition affichée ne tolérerait pas. */
function sumTotals(totals: CurrencyTotals): number {
  return Object.values(totals).reduce((sum, cents) => sum + cents, 0);
}
