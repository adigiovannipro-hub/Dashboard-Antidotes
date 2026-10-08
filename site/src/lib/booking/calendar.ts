import "server-only";

import { composioEnabled, env } from "@/lib/env";
import { calendarBusy, calendarCreateEvent, calendarDeleteEvent, findAccount } from "@/lib/composio";
import { bookedRanges } from "@/lib/db";
import { DEFAULT_AVAILABILITY, freeSlots, type Busy, type Slot } from "./slots";

/**
 * L'agenda réel derrière le moteur de créneaux : les plages occupées de
 * Google Calendar (quand il est branché) plus les réservations du site.
 *
 * Tant que l'agenda n'est pas branché, seules les réservations du site
 * comptent — le propriétaire est prévenu dans l'écran d'administration.
 */
export async function calendarConnected(): Promise<boolean> {
  if (!composioEnabled()) return false;
  try {
    return (await findAccount("googlecalendar")) !== null;
  } catch {
    return false;
  }
}

export async function busyRanges(from: Date, to: Date): Promise<{ busy: Busy[]; calendarUsed: boolean }> {
  const ranges = await bookedRanges(from, to);
  const busy: Busy[] = ranges.map((r) => ({ start: new Date(r.starts_at), end: new Date(r.ends_at) }));
  let calendarUsed = false;
  if (await calendarConnected()) {
    try {
      const google = await calendarBusy({ calendarId: env().BOOKING_CALENDAR_ID, from, to });
      for (const range of google) busy.push({ start: new Date(range.start), end: new Date(range.end) });
      calendarUsed = true;
    } catch (error) {
      // Un agenda injoignable ne ferme pas la réservation : les créneaux du
      // site restent justes, et l'incident est journalisé.
      console.error("[agenda] lecture free/busy impossible", error);
    }
  }
  return { busy, calendarUsed };
}

export async function availableSlots(options: { from: Date; to: Date; now?: Date }): Promise<{ slots: Slot[]; calendarUsed: boolean }> {
  const now = options.now ?? new Date();
  const { busy, calendarUsed } = await busyRanges(options.from, options.to);
  const slots = freeSlots({ config: { ...DEFAULT_AVAILABILITY, timeZone: env().OWNER_TIMEZONE }, from: options.from, to: options.to, now, busy });
  return { slots, calendarUsed };
}

export type EventResult = { eventId: string | null; meetUrl: string | null; created: boolean };

export async function createMeeting(options: {
  start: Date;
  end: Date;
  summary: string;
  description: string;
  attendeeEmail: string;
  attendeeName: string;
}): Promise<EventResult> {
  if (!(await calendarConnected())) return { eventId: null, meetUrl: null, created: false };
  const event = await calendarCreateEvent({ calendarId: env().BOOKING_CALENDAR_ID, ...options });
  return { eventId: event.id, meetUrl: event.meetUrl, created: true };
}

export async function deleteMeeting(eventId: string): Promise<void> {
  if (!(await calendarConnected())) return;
  await calendarDeleteEvent({ calendarId: env().BOOKING_CALENDAR_ID, eventId });
}

/**
 * Le lien visio de repli quand l'agenda Google n'est pas encore branché : une
 * salle Jitsi nommée d'après la réservation, sans compte ni installation.
 */
export function fallbackMeetUrl(bookingId: string): string {
  return `https://meet.jit.si/antidotes-${bookingId.slice(0, 8)}`;
}
