/**
 * La grille d'un mois pour la vue calendrier des posts.
 *
 * Tout se calcule en UTC, comme partout dans le dépôt : un mois qui commence
 * à minuit heure de Paris décalerait les colonnes deux fois par an. L'heure
 * affichée d'un post, elle, est mise en forme en `Europe/Paris` par l'écran —
 * c'est ce qu'on lit, pas ce qu'on calcule.
 *
 * Semaines du lundi au dimanche : le calendrier français.
 */

export type CalendarDay = {
  /** `AAAA-MM-JJ`, la clé d'un jour. */
  date: string;
  /** Le quantième, seul chiffre affiché dans la case. */
  day: number;
  /** Faux pour les jours des mois voisins qui complètent la grille. */
  inMonth: boolean;
};

export type CalendarMonth = {
  /** `AAAA-MM`. */
  key: string;
  label: string;
  previous: string;
  next: string;
  weeks: CalendarDay[][];
};

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/** `AAAA-MM` du mois d'un instant. */
export function monthKeyOf(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Le mois lu d'un paramètre d'URL, ou celui de `fallback` si la forme ne va pas. */
export function parseMonthKey(raw: string | undefined, fallback: Date): string {
  return raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : monthKeyOf(fallback);
}

function shiftMonth(key: string, months: number): string {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1 + months, 1));
  return monthKeyOf(date);
}

/** `AAAA-MM-JJ` d'un instant, en UTC. */
export function dayKeyOf(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function buildCalendarMonth(key: string): CalendarMonth {
  const [year, month] = key.split("-").map(Number);
  const first = new Date(Date.UTC(year!, month! - 1, 1));
  // `getUTCDay()` rend 0 pour dimanche : la grille commençant lundi, on
  // recule de 6 ce jour-là, pas de -1.
  const lead = (first.getUTCDay() + 6) % 7;
  const start = new Date(first);
  start.setUTCDate(1 - lead);

  const weeks: CalendarDay[][] = [];
  const cursor = new Date(start);
  // Six semaines couvrent tous les mois, y compris un février de 29 jours
  // commençant un dimanche ; la dernière est retirée si elle est hors mois.
  for (let week = 0; week < 6; week += 1) {
    const days: CalendarDay[] = [];
    for (let index = 0; index < 7; index += 1) {
      days.push({
        date: cursor.toISOString().slice(0, 10),
        day: cursor.getUTCDate(),
        inMonth: cursor.getUTCMonth() === month! - 1,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(days);
  }
  while (weeks.length > 4 && weeks[weeks.length - 1]!.every((day) => !day.inMonth)) weeks.pop();

  return {
    key,
    label: `${MONTHS[month! - 1]} ${year}`,
    previous: shiftMonth(key, -1),
    next: shiftMonth(key, 1),
    weeks,
  };
}

/** Range des éléments datés par jour — la clé est `AAAA-MM-JJ`. */
export function groupByDay<T>(items: readonly T[], dateOf: (item: T) => string | null): Map<string, T[]> {
  const byDay = new Map<string, T[]>();
  for (const item of items) {
    const iso = dateOf(item);
    if (!iso) continue;
    const key = dayKeyOf(iso);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(item);
    else byDay.set(key, [item]);
  }
  return byDay;
}
