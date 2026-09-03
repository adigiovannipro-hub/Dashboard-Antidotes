import { formatMoney } from "@/lib/finance/money";
import type { CurrencyTotals } from "./schedule";

/**
 * Formats d'affichage du module Échéances. Module sans directive : lisible
 * des composants serveur comme des composants client.
 */

const MONTH_SHORT = new Intl.DateTimeFormat("fr-FR", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const MONTH_LONG = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const DAY = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** « 2026-07-01 » → « juillet 2026 ». */
export function monthLabel(isoMonth: string): string {
  const date = new Date(`${isoMonth}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? isoMonth : MONTH_LONG.format(date);
}

const MONTH_ONLY = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  timeZone: "UTC",
});

/**
 * « 2026-07-01 » → « juillet ». Sans l'année, pour les phrases où elle
 * alourdit : « la facture du mois de juillet » se dit comme ça.
 */
export function monthOnlyLabel(isoMonth: string): string {
  const date = new Date(`${isoMonth}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? isoMonth : MONTH_ONLY.format(date);
}

/** « 2026-08-05 » → « 5 août 2026 ». */
export function dayLabel(isoDay: string): string {
  const date = new Date(`${isoDay}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? isoDay : DAY.format(date);
}

/**
 * La période de prestation d'un mois, comme sur le board Monday :
 * « 2026-07-01 » → « 1 – 31 juil. 2026 ».
 */
export function periodLabel(serviceMonth: string): string {
  const date = new Date(`${serviceMonth}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return serviceMonth;
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return `1 – ${lastDay} ${MONTH_SHORT.format(date)}`;
}

/**
 * Un montant en centimes vers la valeur d'un champ de saisie : virgule
 * française, sans séparateur de milliers — « 250050 » → « 2500,5 ».
 */
export function inputAmountValue(cents: number): string {
  return (cents / 100).toString().replace(".", ",");
}

/**
 * Une somme par devise, jointes par « + » : additionner des euros et des
 * dollars dans un seul nombre serait une invention.
 */
export function formatTotals(totals: CurrencyTotals): string {
  const entries = Object.entries(totals).filter(([, cents]) => cents !== 0);
  if (entries.length === 0) return formatMoney(0, "EUR");
  return entries
    .map(([currency, cents]) => formatMoney(cents, currency))
    .join(" + ");
}
