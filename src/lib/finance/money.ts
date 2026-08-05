/**
 * Formatage monétaire multi-devises.
 *
 * Convention de stockage : `amount_cents = montant × 100`, quelle que soit la
 * devise — y compris celles qui, comme l'IDR, ne portent pas de décimales à
 * l'affichage. La division par 100 est un invariant de lecture, pas une
 * question de typographie ; c'est `Intl` qui décide ensuite combien de
 * décimales chaque devise mérite.
 *
 * L'euro s'affiche avec son symbole — c'est la devise de la maison. Les autres
 * gardent leur code ISO : « 158 800 IDR » se lit sans ambiguïté, « Rp » non.
 */

const LOCALE = "fr-FR";

export const NOT_AVAILABLE = "—";

const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: string): Intl.NumberFormat {
  const code = currency.toUpperCase();
  let formatter = formatters.get(code);
  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency: code,
      currencyDisplay: code === "EUR" ? "symbol" : "code",
    });
    formatters.set(code, formatter);
  }
  return formatter;
}

export function formatMoney(cents: number | null, currency: string | null): string {
  if (cents === null || !Number.isFinite(cents) || !currency) {
    return NOT_AVAILABLE;
  }
  return formatterFor(currency).format(cents / 100);
}

/**
 * Montant d'une dépense tel qu'Airwallex l'affiche : le montant local d'abord,
 * le montant réellement débité ensuite. « 158 800 IDR — financé avec 7,73 € ».
 * Quand les deux devises coïncident, la seconde partie serait une répétition.
 */
export function formatDualAmount(transaction: {
  amount_cents: number;
  currency: string;
  billing_amount_cents: number | null;
  billing_currency: string | null;
}): { primary: string; funded: string | null } {
  const primary = formatMoney(transaction.amount_cents, transaction.currency);

  const hasDistinctBilling =
    transaction.billing_amount_cents !== null &&
    transaction.billing_currency !== null &&
    transaction.billing_currency.toUpperCase() !==
      transaction.currency.toUpperCase();

  return {
    primary,
    funded: hasDistinctBilling
      ? formatMoney(transaction.billing_amount_cents, transaction.billing_currency)
      : null,
  };
}

/**
 * Montant en notation compacte pour les graduations d'axe (`1234500` →
 * « 12,3 k€ »). Volontairement sans style `currency` : « 12,35 k€ » est déjà
 * dense, `Intl` en mode devise compacte donne des résultats inégaux.
 */
export function formatMoneyCompact(cents: number, currency: string): string {
  const compact = new Intl.NumberFormat(LOCALE, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(cents / 100);
  const suffix = currency.toUpperCase() === "EUR" ? "€" : ` ${currency.toUpperCase()}`;
  return `${compact}${suffix}`;
}

/** `12345` centimes → « 123,45 » — la cellule d'un export CSV français. */
export function centsToCsvDecimal(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
