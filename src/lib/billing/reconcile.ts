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
 * Deux passes, deux raisons de bouger :
 *
 *   1. `advanced` — une échéance déjà rapprochée avance quand sa facture
 *      passe payée. Jamais l'inverse : le statut ne recule pas, même si la
 *      facture disparaît du miroir.
 *   2. `matched` — une échéance ouverte trouve sa facture. Elle passe
 *      facturée, ou payée directement si Airwallex la dit déjà réglée.
 */

import type { FinanceInvoice } from "@/lib/finance/types";
import { ttcCentsOf } from "./schedule";
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
    /** Le montant réellement facturé, quand il diffère de la prévision. */
    amount_cents?: number;
  };
  reason: "matched" | "advanced";
};

/**
 * Le hors-taxe correspondant à un montant facturé. La facture porte ce que
 * le client paie ; la mensualité stocke du HT.
 */
export function htCentsOf(billedCents: number, vatRate: number): number {
  return Math.round((billedCents * 100) / (100 + vatRate));
}

/**
 * La facture part en principe le jour d'émission prévu. La fenêtre tolère
 * une avance de quelques jours et un envoi tardif de trois semaines.
 *
 * Elle ne peut pas être plus large : à quarante-cinq jours, elle couvrait le
 * mois suivant en entier, et un devis dont les premiers mois n'ont jamais
 * été facturés voyait **toute sa série glisser d'un cran** — la facture de
 * février soldant janvier, celle de mars soldant février, jusqu'à ce que les
 * échéances de règlement affichées n'aient plus rien à voir avec la réalité.
 */
export const MATCH_BEFORE_DAYS = 10;
export const MATCH_AFTER_DAYS = 21;

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
    if (line.status === "skipped") continue;

    const invoice = invoiceById.get(line.matched_invoice_id);
    if (!invoice) continue;

    const set: ReconcileDecision["set"] = {};

    /* Le statut avance, jamais l'inverse : il ne recule pas même si la
       facture disparaît du miroir. */
    if (invoice.status === "paid" && line.status !== "paid") {
      set.status = "paid";
      set.paid_at = invoice.paid_at ?? nowIso;
    }

    /* Le montant suit la facture **même sur un lien déjà posé**. Sans cette
       reprise, seules les lignes rapprochées à ce passage-ci s'alignaient :
       les anciennes gardaient le chiffre du devis, et le même impayé
       s'affichait à 2 102,50 ici et à 2 102,00 dans Finance. L'écart reste
       borné par la tolérance — au-delà, ce n'est plus une coquille de
       saisie mais une autre prestation, et on ne réécrit pas le devis. */
    const billedHt = htCentsOf(invoice.amount_cents, line.vat_rate);
    if (
      billedHt !== line.amount_cents &&
      amountsAgree(ttcCentsOf(line.amount_cents, line.vat_rate), invoice.amount_cents)
    ) {
      set.amount_cents = billedHt;
    }

    if (Object.keys(set).length > 0) {
      decisions.push({ installment_id: line.id, set, reason: "advanced" });
    }
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
        line.status !== "skipped" && !line.matched_invoice_id,
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

    /* La plus proche du jour prévu l'emporte, et non la première venue :
       quand deux factures du même client tombent dans la fenêtre, celle qui
       colle à la date attendue est la bonne — l'autre appartient au mois
       voisin, qui viendra la chercher. */
    let invoice: ReconcilableInvoice | undefined;
    let bestOffset = Number.POSITIVE_INFINITY;
    for (const candidate of eligibleInvoices) {
      if (used.has(candidate.id)) continue;
      if (candidate.currency !== line.currency) continue;
      if (!amountsAgree(ttc, candidate.amount_cents)) continue;
      if (resolveClient(candidate.client_name, aliases) !== client) continue;
      const offset = daysFrom(line.issue_on, candidate.issued_on!);
      if (offset < -MATCH_BEFORE_DAYS || offset > MATCH_AFTER_DAYS) continue;
      if (Math.abs(offset) < bestOffset) {
        bestOffset = Math.abs(offset);
        invoice = candidate;
      }
    }
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

    /* Le montant s'aligne sur la facture : le devis disait ce qui était
       prévu, la facture dit ce qui a été demandé au client. Sans cet
       alignement, le même impayé s'affiche à 2 102,50 sur cet écran et à
       2 102,00 sur le dashboard Finance — deux chiffres pour une seule
       créance, et plus personne ne sait lequel croire. */
    const billedHt = htCentsOf(invoice.amount_cents, line.vat_rate);
    if (billedHt !== line.amount_cents) set.amount_cents = billedHt;

    decisions.push({ installment_id: line.id, set, reason: "matched" });
  }

  return decisions;
}
