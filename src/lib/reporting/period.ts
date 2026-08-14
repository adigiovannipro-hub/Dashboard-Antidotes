/**
 * Le mois lu par le Reporting.
 *
 * Un rapport se lit **par mois révolu** : le 14 août, le mois qui a du sens
 * est juillet — août n'est pas fini, ses chiffres bougeront encore et un
 * client comparerait deux semaines à un mois entier.
 *
 * Tout en UTC, comme partout : un mois qui commencerait à minuit heure de
 * Paris décalerait les bornes d'agrégation d'une journée deux fois par an.
 */

/** Clé d'un mois, `YYYY-MM`. C'est elle qui voyage dans l'URL. */
export type MonthKey = string;

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

export function monthKey(date: Date): MonthKey {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Le dernier mois entièrement écoulé. En août, juillet. */
export function lastCompleteMonth(now: Date): MonthKey {
  return monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
}

/** `2026-07` → « juillet 2026 ». */
export function monthLabel(key: MonthKey): string {
  const [year, month] = key.split("-").map(Number);
  const name = MONTHS[(month ?? 1) - 1];
  return name ? `${name} ${year}` : key;
}

/** Le mois d'avant, pour la comparaison affichée sous les chiffres. */
export function previousMonth(key: MonthKey): MonthKey {
  const [year, month] = key.split("-").map(Number);
  return monthKey(new Date(Date.UTC(year ?? 1970, (month ?? 1) - 2, 1)));
}

/**
 * Les mois proposés au choix : du dernier révolu en remontant.
 *
 * Le mois en cours n'y figure pas — il n'est pas comparable, et l'afficher
 * ferait croire à une chute chaque début de mois.
 */
export function monthOptions(now: Date, count = 12): MonthKey[] {
  const options: MonthKey[] = [];
  for (let back = 1; back <= count; back += 1) {
    options.push(
      monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1))),
    );
  }
  return options;
}

/** Le mois demandé par l'URL, s'il est valide et pas dans le futur. */
export function parseMonth(raw: string | undefined, now: Date): MonthKey | null {
  if (!raw || !/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) return null;
  return raw <= monthKey(now) ? raw : null;
}

/** Les deux bornes d'un mois, incluses, au format `date` de Postgres. */
export function monthBounds(key: MonthKey): { from: string; to: string } {
  const [year, month] = key.split("-").map(Number);
  const start = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, 1));
  const end = new Date(Date.UTC(year ?? 1970, month ?? 1, 0));
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}
