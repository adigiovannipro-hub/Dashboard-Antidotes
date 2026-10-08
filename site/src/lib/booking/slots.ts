import { localDateKey, wallClock, zonedToUtc } from "./timezone";

/**
 * Le moteur de créneaux — pur, testé, sans horloge cachée.
 *
 * Les disponibilités se déclarent en heure murale du propriétaire (Bali,
 * sans heure d'été) ; chaque créneau est converti en instant UTC puis
 * confronté aux plages occupées (agenda Google + réservations du site). Le
 * prospect ne voit que des instants : c'est son navigateur qui les affiche
 * dans son propre fuseau.
 */

export type Window = { weekday: number; start: string; end: string };

export type AvailabilityConfig = {
  timeZone: string;
  /** Les fenêtres d'ouverture, en heure murale du propriétaire (HH:MM). */
  windows: Window[];
  slotMinutes: number;
  stepMinutes: number;
  /** Marge laissée entre deux rendez-vous. */
  bufferMinutes: number;
  /** Délai minimal avant un créneau, en heures. */
  minNoticeHours: number;
  /** Horizon de réservation, en jours. */
  horizonDays: number;
};

/**
 * Lundi à vendredi, 15h–21h à Bali : 9h–15h à Paris à l'heure d'été, 8h–14h
 * à l'heure d'hiver — la matinée du prospect français, l'après-midi et la
 * soirée du propriétaire.
 */
export const DEFAULT_AVAILABILITY: AvailabilityConfig = {
  timeZone: "Asia/Makassar",
  windows: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: "15:00", end: "21:00" })),
  slotMinutes: 30,
  stepMinutes: 30,
  bufferMinutes: 15,
  minNoticeHours: 24,
  horizonDays: 30,
};

export type Busy = { start: Date; end: Date };
export type Slot = { start: Date; end: Date };

function parseClock(value: string): { hour: number; minute: number } {
  const [h, m] = value.split(":").map(Number);
  return { hour: h ?? 0, minute: m ?? 0 };
}

function overlaps(a: { start: Date; end: Date }, b: { start: Date; end: Date }): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Les créneaux libres entre `from` et `to`, triés.
 *
 * `now` borne le délai minimal ; les plages occupées sont comparées avec la
 * marge de part et d'autre, pour qu'un rendez-vous ne colle jamais à un autre.
 */
export function freeSlots(options: {
  config: AvailabilityConfig;
  from: Date;
  to: Date;
  now: Date;
  busy: Busy[];
}): Slot[] {
  const { config, now, busy } = options;
  const earliest = new Date(Math.max(options.from.getTime(), now.getTime() + config.minNoticeHours * 3_600_000));
  const latest = new Date(Math.min(options.to.getTime(), now.getTime() + config.horizonDays * 86_400_000));
  if (earliest >= latest) return [];

  const slots: Slot[] = [];
  const dayMs = 86_400_000;
  // On balaie un jour de plus de chaque côté : un jour civil du propriétaire
  // peut commencer la veille en UTC.
  for (let t = earliest.getTime() - dayMs; t <= latest.getTime() + dayMs; t += dayMs) {
    const wall = wallClock(new Date(t), config.timeZone);
    for (const window of config.windows) {
      if (window.weekday !== wall.weekday) continue;
      const startClock = parseClock(window.start);
      const endClock = parseClock(window.end);
      const windowStart = zonedToUtc(config.timeZone, { year: wall.year, month: wall.month, day: wall.day, ...startClock });
      const windowEnd = zonedToUtc(config.timeZone, { year: wall.year, month: wall.month, day: wall.day, ...endClock });
      for (
        let s = windowStart.getTime();
        s + config.slotMinutes * 60_000 <= windowEnd.getTime();
        s += config.stepMinutes * 60_000
      ) {
        const start = new Date(s);
        const end = new Date(s + config.slotMinutes * 60_000);
        if (start < earliest || start >= latest) continue;
        const padded = {
          start: new Date(start.getTime() - config.bufferMinutes * 60_000),
          end: new Date(end.getTime() + config.bufferMinutes * 60_000),
        };
        if (busy.some((b) => overlaps(padded, b))) continue;
        slots.push({ start, end });
      }
    }
  }
  slots.sort((a, b) => a.start.getTime() - b.start.getTime());
  // Deux fenêtres qui se chevaucheraient produiraient des doublons.
  return slots.filter((slot, index) => index === 0 || slot.start.getTime() !== slots[index - 1]!.start.getTime());
}

/** Les créneaux groupés par jour civil du prospect, dans l'ordre. */
export function groupByLocalDay(slots: Slot[], timeZone: string): { day: string; slots: Slot[] }[] {
  const groups = new Map<string, Slot[]>();
  for (const slot of slots) {
    const key = localDateKey(slot.start, timeZone);
    const list = groups.get(key) ?? [];
    list.push(slot);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([day, list]) => ({ day, slots: list }));
}

/** Un créneau proposé est-il bien l'un de ceux que le moteur rend ? */
export function isOfferedSlot(slots: Slot[], start: Date): boolean {
  return slots.some((slot) => slot.start.getTime() === start.getTime());
}
