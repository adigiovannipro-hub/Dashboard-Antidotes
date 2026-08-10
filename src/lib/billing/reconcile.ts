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
  | "issued_at"
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
 * L'écart de montant admis entre le devis et la facture réellement émise :
 * un pour cent, au plus cinq euros. Le devis est une intention saisie à la
 * main, la facture est le réel — cinquante centimes d'écart sur une
 * mensualité de deux mille euros est une coquille de saisie, pas une autre
 * prestation. Au-delà, on ne devine pas.
 */
export const MATCH_AMOUNT_TOLERANCE = 0.01;
export const MATCH_AMOUNT_TOLERANCE_CAP_CENTS = 500;

function amountsAgree(expectedCents: number, actualCents: number): boolean {
  const tolerance = Math.min(
    Math.round(expectedCents * MATCH_AMOUNT_TOLERANCE),
    MATCH_AMOUNT_TOLERANCE_CAP_CENTS,
  );
  return Math.abs(expectedCents - actualCents) <= tolerance;
}

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

/**
 * La correspondance « nom vu sur la facture » → « nom porté par le devis ».
 * Les clés sont normalisées. Une valeur `null` désigne une facture qui n'est
 * pas une prestation client — notre propre facturation — et qui ne se
 * rapproche donc de rien.
 */
export type ClientAliases = Record<string, string | null>;

/** Le nom sous lequel comparer une facture : son alias, ou elle-même. */
export function resolveClient(
  rawName: string,
  aliases: ClientAliases = {},
): string | null {
  const normalized = normalizeClientName(rawName);
  if (!(normalized in aliases)) return normalized;
  const target = aliases[normalized];
  return target === null ? null : normalizeClientName(target);
}

/** Les lignes de `billing_client_aliases` en table de correspondance. */
export function aliasesFrom(
  rows: readonly { alias: string; client_name: string | null }[] | null,
): ClientAliases {
  const aliases: ClientAliases = {};
  for (const row of rows ?? []) {
    aliases[normalizeClientName(row.alias)] = row.client_name;
  }
  return aliases;
}

export function reconcile(options: {
  installments: readonly ReconcilableInstallment[];
  invoices: readonly ReconcilableInvoice[];
  /** Raisons sociales d'Airwallex vers noms de devis — voir `resolveClient`. */
  aliases?: ClientAliases;
  now?: Date;
}): ReconcileDecision[] {
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const aliases = options.aliases ?? {};
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
     ancienne échéance. Les payées sans lien — statut posé à la main ou repris
     du board Monday — cherchent aussi le leur : la facture apporte la date de
     paiement réelle, jamais un recul de statut. */
  const openLines = options.installments
    .filter(
      (line) =>
        line.status !== "skipped" && !line.matched_invoice_id && !line.archived_at,
    )
    .sort((a, b) => a.issue_on.localeCompare(b.issue_on));

  const eligibleInvoices = options.invoices
    .filter(
      (invoice) =>
        (invoice.status === "sent" || invoice.status === "paid") &&
        invoice.issued_on !== null &&
        /* Une facture qui n'est pas une prestation client ne se rapproche de
           rien : elle n'a pas de devis, et n'en aura jamais. */
        resolveClient(invoice.client_name, aliases) !== null,
    )
    .sort((a, b) => a.issued_on!.localeCompare(b.issued_on!));

  for (const line of openLines) {
    const ttc = ttcCentsOf(line.amount_cents, line.vat_rate);
    const client = normalizeClientName(line.client_name);

    const invoice = eligibleInvoices.find((candidate) => {
      if (used.has(candidate.id)) return false;
      if (candidate.currency !== line.currency) return false;
      if (!amountsAgree(ttc, candidate.amount_cents)) return false;
      if (resolveClient(candidate.client_name, aliases) !== client) return false;
      const offset = daysFrom(line.issue_on, candidate.issued_on!);
      return offset >= -MATCH_BEFORE_DAYS && offset <= MATCH_AFTER_DAYS;
    });
    if (!invoice) continue;

    used.add(invoice.id);
    const issuedAt = `${invoice.issued_on}T00:00:00.000Z`;
    const set: ReconcileDecision["set"] = { matched_invoice_id: invoice.id };

    /* Le statut n'avance que vers l'avant, et les horodatages déjà posés ne
       se réécrivent pas — la facture ne fait que combler les absences. */
    if (invoice.status === "paid") {
      if (line.status !== "paid") set.status = "paid";
      if (!line.paid_at) set.paid_at = invoice.paid_at ?? nowIso;
    } else if (line.status === "pending") {
      set.status = "issued";
    }
    if (!line.issued_at) set.issued_at = issuedAt;

    decisions.push({ installment_id: line.id, set, reason: "matched" });
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
