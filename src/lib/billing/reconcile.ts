/**
 * Le rapprochement des échéances avec les factures Airwallex.
 *
 * Les factures sont déjà en base — le module Finance les synchronise toutes
 * les heures. Il n'y a donc rien à demander à Airwallex : rapprocher, c'est
 * croiser deux tables locales. Fonction pure, zéro import Supabase — l'état
 * entre en paramètres, les décisions sortent en valeur de retour, et c'est
 * `src/lib/billing/sync.ts` qui les applique.
 *
 * Une facture correspond à une échéance quand tout concorde à la fois : le
 * client (normalisé — accents, casse et espaces ne comptent pas), le montant
 * TTC au centime près, la devise, et la date d'émission dans une fenêtre
 * autour du jour prévu. Au moindre doute — deux candidates, un montant
 * décalé — la ligne ne bouge pas : l'écran garde ses boutons manuels, et un
 * faux rapprochement coûterait plus cher qu'un rapprochement absent.
 *
 * Trois passes, trois raisons de bouger :
 *
 *   1. `advanced` — une échéance déjà rapprochée avance quand sa facture
 *      passe payée. Jamais l'inverse : le statut ne recule pas, même si la
 *      facture disparaît du miroir.
 *   2. `matched` — une échéance ouverte trouve sa facture. Elle passe
 *      facturée, ou payée directement si Airwallex la dit déjà réglée.
 *   3. `archived` — une payée depuis plus de soixante jours descend en bas
 *      de page, comme l'archivé de « Mon travail ».
 */

import type { FinanceInvoice } from "@/lib/finance/types";
import { ARCHIVE_AFTER_DAYS, ttcCentsOf } from "./schedule";
import type { BillingInstallment } from "./types";

/** Ce que le rapprochement doit savoir d'une échéance — le client vient de
    l'engagement, aplati par la lecture. */
export type ReconcilableInstallment = Pick<
  BillingInstallment,
  | "id"
  | "status"
  | "amount_cents"
  | "vat_rate"
  | "currency"
  | "issue_on"
  | "matched_invoice_id"
  | "archived_at"
  | "paid_at"
> & { client_name: string };

export type ReconcilableInvoice = Pick<
  FinanceInvoice,
  "id" | "client_name" | "amount_cents" | "currency" | "status" | "issued_on" | "paid_at"
>;

/** Une écriture à faire, et pourquoi. Les champs absents ne bougent pas. */
export type ReconcileDecision = {
  installment_id: string;
  set: {
    status?: "issued" | "paid";
    matched_invoice_id?: string;
    issued_at?: string;
    paid_at?: string;
    archived_at?: string;
  };
  reason: "matched" | "advanced" | "archived";
};

/* La facture part en principe le jour d'émission prévu. La fenêtre tolère
   une avance de quelques jours et un envoi tardif — au-delà, mieux vaut ne
   rien décider. */
export const MATCH_BEFORE_DAYS = 10;
export const MATCH_AFTER_DAYS = 45;

/**
 * « CHASSEURS DE GRAINES », « Chasseurs de graines » et « chasseurs  de
 * graines » sont le même client : Airwallex et la saisie manuelle n'écrivent
 * jamais pareil.
 */
export function normalizeClientName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function daysFrom(fromIso: string, toIso: string): number {
  return (
    (Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) /
    86_400_000
  );
}

export function reconcile(options: {
  installments: readonly ReconcilableInstallment[];
  invoices: readonly ReconcilableInvoice[];
  now?: Date;
}): ReconcileDecision[] {
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const decisions: ReconcileDecision[] = [];

  // --- 1. Les rapprochées avancent avec leur facture ------------------------

  const invoiceById = new Map(options.invoices.map((invoice) => [invoice.id, invoice]));

  for (const line of options.installments) {
    if (!line.matched_invoice_id) continue;
    if (line.status === "paid" || line.status === "skipped") continue;

    const invoice = invoiceById.get(line.matched_invoice_id);
    if (invoice?.status !== "paid") continue;

    decisions.push({
      installment_id: line.id,
      set: { status: "paid", paid_at: invoice.paid_at ?? nowIso },
      reason: "advanced",
    });
  }

  // --- 2. Les ouvertes cherchent leur facture -------------------------------

  const used = new Set(
    options.installments
      .map((line) => line.matched_invoice_id)
      .filter((id): id is string => id !== null),
  );

  /* Chronologique des deux côtés : deux mensualités identiques du même client
     s'apparient dans l'ordre, la plus ancienne facture soldant la plus
     ancienne échéance. */
  const openLines = options.installments
    .filter(
      (line) =>
        (line.status === "pending" || line.status === "issued") &&
        !line.matched_invoice_id &&
        !line.archived_at,
    )
    .sort((a, b) => a.issue_on.localeCompare(b.issue_on));

  const eligibleInvoices = options.invoices
    .filter(
      (invoice) =>
        (invoice.status === "sent" || invoice.status === "paid") &&
        invoice.issued_on !== null,
    )
    .sort((a, b) => a.issued_on!.localeCompare(b.issued_on!));

  for (const line of openLines) {
    const ttc = ttcCentsOf(line.amount_cents, line.vat_rate);
    const client = normalizeClientName(line.client_name);

    const invoice = eligibleInvoices.find((candidate) => {
      if (used.has(candidate.id)) return false;
      if (candidate.currency !== line.currency) return false;
      if (candidate.amount_cents !== ttc) return false;
      if (normalizeClientName(candidate.client_name) !== client) return false;
      const offset = daysFrom(line.issue_on, candidate.issued_on!);
      return offset >= -MATCH_BEFORE_DAYS && offset <= MATCH_AFTER_DAYS;
    });
    if (!invoice) continue;

    used.add(invoice.id);
    const issuedAt = `${invoice.issued_on}T00:00:00.000Z`;

    if (invoice.status === "paid") {
      decisions.push({
        installment_id: line.id,
        set: {
          matched_invoice_id: invoice.id,
          status: "paid",
          issued_at: issuedAt,
          paid_at: invoice.paid_at ?? nowIso,
        },
        reason: "matched",
      });
    } else if (line.status === "pending") {
      decisions.push({
        installment_id: line.id,
        set: { matched_invoice_id: invoice.id, status: "issued", issued_at: issuedAt },
        reason: "matched",
      });
    } else {
      // Déjà marquée facturée à la main : le lien suffit, l'histoire reste.
      decisions.push({
        installment_id: line.id,
        set: { matched_invoice_id: invoice.id },
        reason: "matched",
      });
    }
  }

  // --- 3. Les payées anciennes descendent en archivé ------------------------

  for (const line of options.installments) {
    if (line.status !== "paid" || line.archived_at || !line.paid_at) continue;
    const ageDays = (now.getTime() - Date.parse(line.paid_at)) / 86_400_000;
    if (ageDays < ARCHIVE_AFTER_DAYS) continue;

    decisions.push({
      installment_id: line.id,
      set: { archived_at: nowIso },
      reason: "archived",
    });
  }

  return decisions;
}
