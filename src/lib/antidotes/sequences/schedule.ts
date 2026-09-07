/**
 * Le calendrier d'une séquence : quand une étape part, et quand elle ne part
 * pas.
 *
 * Tout se calcule en UTC, comme partout dans le dépôt, mais la **fenêtre**
 * d'envoi se pense en heure de Paris — « du lundi au vendredi, de 9 h à 18 h »
 * est une phrase de Paris, pas d'UTC. `Intl` fait la traduction, sans
 * bibliothèque : on lit les composantes locales d'un instant, on en déduit le
 * décalage, et on refait le chemin inverse pour poser « demain 9 h ».
 *
 * Un email de prospection qui arrive un dimanche à 3 h du matin dit
 * « automate » avant même d'être lu.
 */

export type SendWindow = {
  /** Jours ISO : 1 = lundi … 7 = dimanche. */
  days: number[];
  /** Heure de Paris, incluse. */
  start_hour: number;
  /** Heure de Paris, exclue : 18 = on n'envoie plus à partir de 18 h. */
  end_hour: number;
};

export const DEFAULT_SEND_WINDOW: SendWindow = { days: [1, 2, 3, 4, 5], start_hour: 9, end_hour: 18 };

export const PARIS = "Europe/Paris";

type LocalParts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

const FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: PARIS,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
});

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** Les composantes d'un instant, lues en heure de Paris. */
export function parisParts(at: Date): LocalParts {
  const parts: Record<string, string> = {};
  for (const part of FORMATTER.formatToParts(at)) parts[part.type] = part.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAYS[parts.weekday!] ?? 0,
  };
}

/** Le décalage Paris − UTC, en minutes, à cet instant (60 en hiver, 120 en été). */
function parisOffsetMinutes(at: Date): number {
  const local = parisParts(at);
  const asUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/**
 * L'instant UTC d'une heure de Paris donnée. Deux passes : le décalage se lit
 * à l'instant visé, qu'on ne connaît qu'après une première estimation — c'est
 * ce qui rend juste un « 9 h » posé le jour d'un changement d'heure.
 */
export function parisTime(year: number, month: number, day: number, hour: number, minute = 0): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const first = new Date(naive - parisOffsetMinutes(new Date(naive)) * 60_000);
  return new Date(naive - parisOffsetMinutes(first) * 60_000);
}

export function isInWindow(at: Date, window: SendWindow = DEFAULT_SEND_WINDOW): boolean {
  const local = parisParts(at);
  return (
    window.days.includes(local.weekday) &&
    local.hour >= window.start_hour &&
    local.hour < window.end_hour
  );
}

/**
 * Le premier instant de la fenêtre à partir de `after` — `after` lui-même
 * s'il y est déjà. Une fenêtre sans jour rend `null` : rien ne partira, et
 * c'est ce que l'écran doit dire.
 */
export function nextWindowStart(after: Date, window: SendWindow = DEFAULT_SEND_WINDOW): Date | null {
  if (window.days.length === 0 || window.start_hour >= window.end_hour) return null;
  if (isInWindow(after, window)) return after;

  const local = parisParts(after);
  // Aujourd'hui, avant l'ouverture : on attend l'ouverture du jour même.
  if (window.days.includes(local.weekday) && local.hour < window.start_hour) {
    return parisTime(local.year, local.month, local.day, window.start_hour);
  }
  // Sinon, le prochain jour ouvert, à l'ouverture — huit essais suffisent.
  for (let offset = 1; offset <= 8; offset += 1) {
    const candidate = new Date(after.getTime() + offset * 86_400_000);
    const parts = parisParts(candidate);
    if (window.days.includes(parts.weekday)) {
      return parisTime(parts.year, parts.month, parts.day, window.start_hour);
    }
  }
  return null;
}

/**
 * Quand l'étape `delayDays` doit partir : le jour de l'inscription plus le
 * délai, ramené dans la fenêtre. « J+4 » se compte en jours calendaires,
 * comme le cahier des charges l'écrit ; la fenêtre décale ensuite au jour
 * ouvré suivant si J+4 tombe un week-end.
 */
export function stepDueAt(
  enrolledAt: Date,
  delayDays: number,
  window: SendWindow = DEFAULT_SEND_WINDOW,
): Date | null {
  const target = new Date(enrolledAt.getTime() + Math.max(0, delayDays) * 86_400_000);
  return nextWindowStart(target, window);
}

/** Le jour de Paris d'un instant, `AAAA-MM-JJ` — la clé du plafond quotidien. */
export function parisDay(at: Date): string {
  const local = parisParts(at);
  return `${local.year}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
}

/** Le début (UTC) du jour de Paris qui contient `at`. */
export function parisDayStart(at: Date): Date {
  const local = parisParts(at);
  return parisTime(local.year, local.month, local.day, 0);
}
