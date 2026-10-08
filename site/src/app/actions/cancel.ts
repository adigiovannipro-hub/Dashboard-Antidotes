"use server";

import { deleteMeeting } from "@/lib/booking/calendar";
import { cancelBooking } from "@/lib/db";
import { processOutbox } from "@/lib/mail/outbox";

export type CancelResult = { ok: true } | { ok: false; error: "missing" | "already" | "generic" };

/** Annule une réservation par son jeton : la base, puis l'agenda, puis les courriels. */
export async function cancelBookingAction(token: string): Promise<CancelResult> {
  if (!/^[0-9a-f]{32}$/.test(token)) return { ok: false, error: "missing" };
  try {
    const cancelled = await cancelBooking(token);
    if (!cancelled) return { ok: false, error: "already" };
    if (cancelled.calendar_event_id) {
      try {
        await deleteMeeting(cancelled.calendar_event_id);
      } catch (error) {
        console.error("[annulation] agenda", error);
      }
    }
    processOutbox().catch((error) => console.error("[outbox]", error));
    return { ok: true };
  } catch (error) {
    console.error("[annulation]", error);
    return { ok: false, error: "generic" };
  }
}
