/**
 * Dates du pipeline.
 *
 * « il y a 3 j » sur une carte, une date pleine dans la timeline. Le relatif
 * se calcule en jours entiers d'écart, pas en heures arrondies : un contact
 * d'hier soir est « hier », pas « il y a 12 h » — c'est le jour qui compte
 * dans une relance, pas l'heure.
 */

const DAY_MS = 86_400_000;

/** « à l'instant », « il y a 3 h », « hier », « il y a 12 j », « il y a 3 mois ». */
export function relativeDays(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "—";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "—";

  const elapsed = now.getTime() - then.getTime();
  if (elapsed < 0) return "à l'instant";
  const hours = Math.floor(elapsed / 3_600_000);
  if (hours < 1) return "à l'instant";
  if (hours < 24) return `il y a ${hours} h`;

  const days = Math.floor(elapsed / DAY_MS);
  if (days === 1) return "hier";
  if (days < 30) return `il y a ${days} j`;
  const months = Math.floor(days / 30);
  if (months < 12) return `il y a ${months} mois`;
  const years = Math.floor(days / 365);
  return `il y a ${years} an${years > 1 ? "s" : ""}`;
}

const DATE_TIME = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

/** « 7 sept. 2026, 14:05 » — l'instant d'une interaction, à l'heure de Paris. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return DATE_TIME.format(date);
}

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Paris",
});

/** « 7 sept. 2026 ». */
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return DATE.format(date);
}

const DAY_KEY = new Intl.DateTimeFormat("fr-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Europe/Paris",
});

/**
 * Vrai quand le geste prévu tombe aujourd'hui ou avant — jour civil de
 * Paris, celui des fenêtres d'envoi. Un envoi de ce soir est « dû » dès le
 * matin : c'est la journée qu'on regarde, pas l'heure.
 */
export function isDue(iso: string | null, now: Date = new Date()): boolean {
  if (!iso) return false;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return false;
  return DAY_KEY.format(then) <= DAY_KEY.format(now);
}

const SHORT_DAY = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Paris",
});

/** « 12 sept. » — la pastille de date d'une carte, sans l'année. */
export function formatShortDay(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return SHORT_DAY.format(date);
}
