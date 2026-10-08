/**
 * Calculs de fuseau sans bibliothèque : `Intl` suffit, et c'est la seule
 * source qui connaisse les règles d'heure d'été de chaque zone, côté serveur
 * comme côté navigateur.
 */

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let dtf = dtfCache.get(timeZone);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    dtfCache.set(timeZone, dtf);
  }
  return dtf;
}

export type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = dimanche … 6 = samedi, comme `Date#getUTCDay`. */
  weekday: number;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** L'heure murale d'un instant dans un fuseau. */
export function wallClock(instant: Date, timeZone: string): WallClock {
  const parts = formatter(timeZone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: WEEKDAYS.indexOf(get("weekday")),
  };
}

/** Décalage (ms) entre l'heure murale du fuseau et UTC, à cet instant. */
export function offsetMs(instant: Date, timeZone: string): number {
  const w = wallClock(instant, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * L'instant UTC d'une heure murale dans un fuseau.
 *
 * Deux itérations suffisent : la première estime le décalage, la seconde le
 * corrige autour d'un changement d'heure. Une heure murale inexistante (le
 * trou du passage à l'heure d'été) est décalée en avant, comme le font les
 * agendas.
 */
export function zonedToUtc(
  timeZone: string,
  wall: { year: number; month: number; day: number; hour: number; minute: number },
): Date {
  const naive = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, 0);
  let guess = new Date(naive - offsetMs(new Date(naive), timeZone));
  guess = new Date(naive - offsetMs(guess, timeZone));
  return guess;
}

/** Le fuseau est-il un identifiant IANA connu du moteur ? */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/** La date civile (AAAA-MM-JJ) d'un instant dans un fuseau. */
export function localDateKey(instant: Date, timeZone: string): string {
  const w = wallClock(instant, timeZone);
  return `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
}
