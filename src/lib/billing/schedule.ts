/**
 * La mécanique des échéances : du devis signé aux lignes mensuelles.
 *
 * Fonctions pures, zéro import Supabase — l'état entre en paramètres, la
 * décision sort en valeur de retour. C'est ici que vit la règle métier du
 * module, et elle tient en une phrase : **une prestation du mois N se facture
 * le lendemain de la fin du mois N**. Juin se facture le 1er juillet.
 *
 * Tout calcul est en UTC, sur des dates ISO `AAAA-MM-JJ` calées au 1er du
 * mois — même convention que `planning_months.month`.
 */

import type { FinanceInvoice } from "@/lib/finance/types";
import type { BillingInstallment, InstallmentStage } from "./types";

/** Une échéance à insérer, telle que la génération la produit. */
export type InstallmentDraft = {
  service_month: string;
  amount_cents: number;
  vat_rate: number;
  currency: string;
  issue_on: string;
};

/** `"2026-06-01"` + 2 → `"2026-08-01"`. */
export function addMonths(isoMonth: string, count: number): string {
  const [year, month] = isoMonth.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1 + count, 1));
  return date.toISOString().slice(0, 10);
}

/** Nombre de mois de prestation, bornes comprises : août → juillet = 12. */
export function monthsBetween(firstMonth: string, lastMonth: string): number {
  const [firstYear, firstMonthNum] = firstMonth.split("-").map(Number);
  const [lastYear, lastMonthNum] = lastMonth.split("-").map(Number);
  return (lastYear! - firstYear!) * 12 + (lastMonthNum! - firstMonthNum!) + 1;
}

/** Le dernier mois de prestation d'un engagement, pour afficher sa période. */
export function lastMonthOf(engagement: {
  first_month: string;
  months_count: number;
}): string {
  return addMonths(engagement.first_month, engagement.months_count - 1);
}

/**
 * Le jour où la facture d'un mois de prestation doit partir : le lendemain de
 * la fin du mois — c'est-à-dire le 1er du mois suivant.
 */
export function issueDateFor(serviceMonth: string): string {
  return addMonths(serviceMonth, 1);
}

/**
 * Le total d'un devis réparti en mensualités, au centime près : la somme des
 * parts vaut exactement le total. Le reste de la division se distribue
 * centime par centime sur les premiers mois — 100 € sur 3 mois donne
 * 33,34 + 33,33 + 33,33, jamais 33,33 × 3 qui perdrait un centime.
 */
export function splitTotal(totalCents: number, count: number): number[] {
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, index) =>
    index < remainder ? base + 1 : base,
  );
}

/**
 * Le TTC d'un montant HT stocké en centimes. Calcul en entiers — jamais
 * `× 1,2` en flottant, qui sème des centimes fantômes.
 */
export function ttcCentsOf(amountCents: number, vatRate: number): number {
  return Math.round((amountCents * (100 + vatRate)) / 100);
}

/**
 * Les échéances d'un engagement, une par mois de prestation.
 *
 * Montant et taux sont copiés sur chaque ligne et non référencés : un mois
 * révisé ou offert s'ajuste ligne à ligne sans réécrire l'histoire des
 * autres.
 */
export function installmentsFor(engagement: {
  first_month: string;
  months_count: number;
  total_amount_cents: number;
  vat_rate: number;
  currency: string;
}): InstallmentDraft[] {
  const amounts = splitTotal(
    engagement.total_amount_cents,
    engagement.months_count,
  );
  return amounts.map((amount, index) => {
    const serviceMonth = addMonths(engagement.first_month, index);
    return {
      service_month: serviceMonth,
      amount_cents: amount,
      vat_rate: engagement.vat_rate,
      currency: engagement.currency,
      issue_on: issueDateFor(serviceMonth),
    };
  });
}

/** Le 1er du mois d'aujourd'hui, en UTC. */
export function currentMonth(now: Date = new Date()): string {
  return `${now.toISOString().slice(0, 7)}-01`;
}

/** Aujourd'hui, en UTC, `AAAA-MM-JJ`. */
export function today(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * L'étape affichée d'une échéance — le groupe de l'écran. La bascule
 * « devis confirmé → à facturer » n'est pas un traitement planifié : elle se
 * produit d'elle-même au passage du 1er du mois, parce qu'elle est dérivée
 * de la date et non stockée.
 */
export function stageOf(
  installment: Pick<BillingInstallment, "status" | "issue_on">,
  now: Date = new Date(),
): InstallmentStage {
  if (installment.status === "skipped") return "skipped";
  if (installment.status === "paid") return "paid";
  if (installment.status === "issued") return "invoiced";
  return installment.issue_on <= today(now) ? "to_invoice" : "confirmed";
}

/**
 * L'étape d'une facture Airwallex qui ne correspond à aucun devis — elle
 * s'affiche quand même : l'écran reflète la facturation réelle, pas
 * seulement ce qui a été planifié. `null` : brouillons et annulées n'ont pas
 * de place sur le board.
 *
 * Une payée reste payée, sans horizon : ce qui est encaissé est encaissé, et
 * un second classement par-dessus n'apprend rien de plus.
 */
export function stageOfInvoice(
  invoice: Pick<FinanceInvoice, "status" | "paid_at">,
): Extract<InstallmentStage, "invoiced" | "paid"> | null {
  if (invoice.status === "sent") return "invoiced";
  if (invoice.status === "paid") return "paid";
  return null;
}

/**
 * Une échéance dont le jour d'émission est arrivé — ou dépassé — et qui n'est
 * toujours pas facturée. C'est la ligne que l'écran doit mettre devant les
 * yeux.
 */
export function isDue(
  installment: Pick<BillingInstallment, "status" | "issue_on">,
  now: Date = new Date(),
): boolean {
  return installment.status === "pending" && installment.issue_on <= today(now);
}

/**
 * En retard : le jour d'émission est **passé** — pas seulement arrivé. Une
 * facture à émettre aujourd'hui est due, pas en retard.
 */
export function isLate(
  installment: Pick<BillingInstallment, "status" | "issue_on">,
  now: Date = new Date(),
): boolean {
  return installment.status === "pending" && installment.issue_on < today(now);
}

/**
 * Le client a dépassé le délai de règlement : la facture est partie, son
 * échéance est passée, l'argent n'est pas là. L'échéance vient de la facture
 * rapprochée — une mensualité seule n'en a pas, et sans elle il n'y a rien à
 * affirmer.
 */
export function isPaymentOverdue(
  installment: Pick<BillingInstallment, "status" | "invoice_due_on">,
  now: Date = new Date(),
): boolean {
  if (installment.status !== "issued") return false;
  const due = installment.invoice_due_on;
  return due !== null && due !== undefined && due < today(now);
}

/** Une somme par devise — jamais additionnées entre elles. */
export type CurrencyTotals = Record<string, number>;

export function totalsOf(
  installments: readonly Pick<BillingInstallment, "amount_cents" | "currency">[],
): CurrencyTotals {
  const totals: CurrencyTotals = {};
  for (const installment of installments) {
    totals[installment.currency] =
      (totals[installment.currency] ?? 0) + installment.amount_cents;
  }
  return totals;
}

/** Fusion de deux sommes par devise — mensualités et factures hors devis
    s'additionnent dans les pieds de groupe et les cartes du haut. */
export function addTotals(a: CurrencyTotals, b: CurrencyTotals): CurrencyTotals {
  const merged: CurrencyTotals = { ...a };
  for (const [currency, cents] of Object.entries(b)) {
    merged[currency] = (merged[currency] ?? 0) + cents;
  }
  return merged;
}

/** Les mêmes sommes, en TTC — pour la seconde colonne des pieds de groupe. */
export function ttcTotalsOf(
  installments: readonly Pick<
    BillingInstallment,
    "amount_cents" | "currency" | "vat_rate"
  >[],
): CurrencyTotals {
  const totals: CurrencyTotals = {};
  for (const installment of installments) {
    totals[installment.currency] =
      (totals[installment.currency] ?? 0) +
      ttcCentsOf(installment.amount_cents, installment.vat_rate);
  }
  return totals;
}

/** Un mois du prévisionnel : ce que les devis signés feront facturer. */
export type ForecastPoint = {
  /** Mois d'émission, `AAAA-MM`. */
  month: string;
  amount_cents: number;
  count: number;
};

/**
 * Le prévisionnel de facturation, mois d'émission par mois d'émission, à
 * partir du mois courant. Il ne lit que les mensualités des devis — jamais
 * les factures libres d'Airwallex : c'est la promesse signée qu'on trace,
 * pas le réalisé. Un mois sans mensualité vaut zéro, pas « inconnu ».
 *
 * EUR seul : le module crée tous les devis en euros, et additionner des
 * devises dans une même courbe serait une invention.
 */
export function billingForecast(
  installments: readonly Pick<
    BillingInstallment,
    "status" | "issue_on" | "amount_cents" | "currency"
  >[],
  options: { months: number; now?: Date },
): ForecastPoint[] {
  const start = currentMonth(options.now ?? new Date());

  const points = Array.from({ length: options.months }, (_, index) => ({
    month: addMonths(start, index).slice(0, 7),
    amount_cents: 0,
    count: 0,
  }));
  const byMonth = new Map(points.map((point) => [point.month, point]));

  for (const line of installments) {
    if (line.status === "skipped") continue;
    if (line.currency !== "EUR") continue;
    const point = byMonth.get(line.issue_on.slice(0, 7));
    if (!point) continue;
    point.amount_cents += line.amount_cents;
    point.count += 1;
  }

  return points;
}

/**
 * La mensualité **réellement** émise dans le mois calendaire donné.
 *
 * Seule une date d'émission compte — celle que le rapprochement copie de la
 * facture, ou que le bouton « Facturée » pose. Une mensualité sans date ne
 * compte pas, même marquée facturée : son `issue_on` dit quand elle *devait*
 * partir, pas quand elle est partie, et confondre les deux gonfle le chiffre
 * du mois avec des factures émises ailleurs — ou déjà comptées par la
 * facture Airwallex correspondante.
 */
export function wasIssuedInMonth(
  line: Pick<BillingInstallment, "status" | "issued_at">,
  isoMonth: string,
): boolean {
  if (line.status !== "issued" && line.status !== "paid") return false;
  return line.issued_at?.slice(0, 7) === isoMonth;
}

/**
 * La mensualité moyenne des mois à venir — le « récurrent » honnête : un mois
 * où deux devis se chevauchent pèse plus lourd qu'un mois de fin de contrat,
 * et la moyenne le dit. Les mois vides ne comptent pas : un trou de
 * facturation n'est pas un loyer à zéro.
 */
export function forecastAverage(points: readonly ForecastPoint[]): number {
  const active = points.filter((point) => point.count > 0);
  if (active.length === 0) return 0;
  const total = active.reduce((sum, point) => sum + point.amount_cents, 0);
  return Math.round(total / active.length);
}

/**
 * La bande de mesures de l'écran, dérivée d'un seul passage sur les lignes.
 *
 *   • `toInvoice` — à facturer maintenant : le mois de prestation est fini,
 *     la facture n'est pas partie.
 *   • `late` — le sous-ensemble de `toInvoice` dont le jour est dépassé.
 *
 * Tous les montants sont HT — le pilotage se fait en HT, le TTC vit dans les
 * pieds de groupe.
 */
export function scheduleKpis(
  installments: readonly Pick<
    BillingInstallment,
    "status" | "issue_on" | "amount_cents" | "currency"
  >[],
  now: Date = new Date(),
): {
  toInvoice: { count: number; totals: CurrencyTotals };
  late: { count: number; totals: CurrencyTotals };
} {
  const toInvoice = installments.filter((line) => isDue(line, now));
  const late = installments.filter((line) => isLate(line, now));

  return {
    toInvoice: { count: toInvoice.length, totals: totalsOf(toInvoice) },
    late: { count: late.length, totals: totalsOf(late) },
  };
}
