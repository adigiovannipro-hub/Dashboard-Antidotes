/**
 * Dates du module « Mon travail ».
 *
 * Le « jour » du module est le jour civil de **Paris** : une tâche à faire
 * mardi doit basculer en retard à minuit heure de Paris, pas à minuit UTC —
 * entre minuit et deux heures du matin, l'écran raconterait la veille. La
 * conversion de fuseau est un formatage `Intl` avec `timeZone` explicite,
 * conformément à la règle du dépôt ; une fois le jour obtenu, tout le calcul
 * se fait en UTC sur des `YYYY-MM-DD`.
 */

const PARIS_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Le jour civil de Paris à l'instant donné, `YYYY-MM-DD`. */
export function todayInParis(now: Date = new Date()): string {
  // `en-CA` est la seule locale dont le format court est déjà ISO.
  return PARIS_DAY.format(now);
}

export function addDays(day: string, count: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

/** `2026-08-05` → `2026-08`. */
export function monthKeyOf(day: string): string {
  return day.slice(0, 7);
}

export function lastDayOfMonth(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  // Jour zéro du mois suivant = dernier jour du mois demandé.
  return new Date(Date.UTC(year!, month!, 0)).getUTCDate();
}

const DAY_LABEL = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** « Mardi 5 août » — capitalisé pour servir de titre de groupe. */
export function dayLabel(day: string): string {
  const label = DAY_LABEL.format(new Date(`${day}T00:00:00Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Le titre d'un jour d'« À venir » : « Demain », puis les jours nommés. */
export function upcomingDayLabel(day: string, today: string): string {
  return day === addDays(today, 1) ? "Demain" : dayLabel(day);
}

const SHORT_DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** « 5 août » — la date d'origine d'une tâche en retard. */
export function shortDate(day: string): string {
  return SHORT_DATE.format(new Date(`${day}T00:00:00Z`));
}
