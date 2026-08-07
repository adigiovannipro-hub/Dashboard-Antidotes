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

import type { BillingInstallment } from "./types";

/** Une échéance à insérer, telle que la génération la produit. */
export type InstallmentDraft = {
  service_month: string;
  amount_cents: number;
  currency: string;
  issue_on: string;
};

/** `"2026-06-01"` + 2 → `"2026-08-01"`. */
export function addMonths(isoMonth: string, count: number): string {
  const [year, month] = isoMonth.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1 + count, 1));
  return date.toISOString().slice(0, 10);
}

/**
 * Le jour où la facture d'un mois de prestation doit partir : le lendemain de
 * la fin du mois — c'est-à-dire le 1er du mois suivant.
 */
export function issueDateFor(serviceMonth: string): string {
  return addMonths(serviceMonth, 1);
}

/**
 * Les échéances d'un engagement, une par mois de prestation.
 *
 * Le montant est copié sur chaque ligne et non référencé : un mois révisé ou
 * offert s'ajuste ligne à ligne sans réécrire l'histoire des autres.
 */
export function installmentsFor(engagement: {
  first_month: string;
  months_count: number;
  monthly_amount_cents: number;
  currency: string;
}): InstallmentDraft[] {
  return Array.from({ length: engagement.months_count }, (_, index) => {
    const serviceMonth = addMonths(engagement.first_month, index);
    return {
      service_month: serviceMonth,
      amount_cents: engagement.monthly_amount_cents,
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
 * Une échéance dont le jour d'émission est arrivé — ou dépassé — et qui n'est
 * toujours pas émise. C'est la ligne que l'écran doit mettre devant les yeux.
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

/**
 * La bande de mesures de l'écran, dérivée d'un seul passage sur les lignes.
 *
 *   • `due` — à émettre maintenant : le jour est arrivé, la facture non.
 *   • `late` — le sous-ensemble de `due` dont le jour est dépassé.
 *   • `thisMonth` — tout ce qui s'émet dans le mois calendaire en cours,
 *     émis ou non : c'est le chiffre d'affaires du mois en train de se
 *     facturer.
 */
export function scheduleKpis(
  installments: readonly Pick<
    BillingInstallment,
    "status" | "issue_on" | "amount_cents" | "currency"
  >[],
  now: Date = new Date(),
): {
  due: { count: number; totals: CurrencyTotals };
  late: { count: number; totals: CurrencyTotals };
  thisMonth: { count: number; totals: CurrencyTotals };
} {
  const monthStart = currentMonth(now);
  const nextMonthStart = addMonths(monthStart, 1);

  const due = installments.filter((installment) => isDue(installment, now));
  const late = installments.filter((installment) => isLate(installment, now));
  const thisMonth = installments.filter(
    (installment) =>
      installment.status !== "skipped" &&
      installment.issue_on >= monthStart &&
      installment.issue_on < nextMonthStart,
  );

  return {
    due: { count: due.length, totals: totalsOf(due) },
    late: { count: late.length, totals: totalsOf(late) },
    thisMonth: { count: thisMonth.length, totals: totalsOf(thisMonth) },
  };
}
