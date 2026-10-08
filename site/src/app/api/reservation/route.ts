import { after } from "next/server";
import { z } from "zod";

import { availableSlots, createMeeting, fallbackMeetUrl } from "@/lib/booking/calendar";
import { isOfferedSlot } from "@/lib/booking/slots";
import { isValidTimeZone } from "@/lib/booking/timezone";
import { bookSlot, DbError, setBookingCalendar } from "@/lib/db";
import { env } from "@/lib/env";
import { allow, json, readJson } from "@/lib/http/request";
import { googleCalendarUrl, whenWithZone } from "@/lib/mail/format";
import { processOutbox } from "@/lib/mail/outbox";
import { localePath, SITE_URL } from "@/i18n/locale";
import { MEETING_MINUTES, type BookingResponse } from "@/lib/funnel-contract";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const schema = z.object({
  leadId: z.uuid(),
  start: z.string().datetime({ offset: true }),
  timezone: z.string().min(1).max(64).refine(isValidTimeZone, "fuseau inconnu"),
  name: z.string().trim().min(1).max(120),
  company: z.string().trim().max(120).nullable(),
  phone: z.string().trim().max(40).nullable(),
  notes: z.string().trim().max(1000).nullable(),
  locale: z.enum(["fr", "en"]),
});

export async function POST(request: Request): Promise<Response> {
  if (!(await allow(request, "reservation", 8, 3600))) return json<BookingResponse>({ ok: false, error: "generic" }, 429);
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return json<BookingResponse>({ ok: false, error: "invalid" }, 400);
  const input = parsed.data;
  const start = new Date(input.start);
  const end = new Date(start.getTime() + MEETING_MINUTES * 60_000);

  // Le créneau doit être l'un de ceux que le moteur propose — ni un horaire
  // libre inventé, ni un créneau devenu occupé dans l'agenda entre-temps.
  const { slots } = await availableSlots({ from: new Date(start.getTime() - 3_600_000), to: new Date(end.getTime() + 3_600_000) });
  if (!isOfferedSlot(slots, start)) return json<BookingResponse>({ ok: false, error: "slot_unavailable" }, 409);

  let booked;
  try {
    booked = await bookSlot({
      leadId: input.leadId,
      startsAt: start,
      endsAt: end,
      timezone: input.timezone,
      name: input.name,
      company: input.company || null,
      phone: input.phone || null,
      notes: input.notes || null,
      locale: input.locale,
    });
  } catch (error) {
    if (error instanceof DbError && error.code === "23505") return json<BookingResponse>({ ok: false, error: "slot_taken" }, 409);
    if (error instanceof DbError && error.code === "P0002") return json<BookingResponse>({ ok: false, error: "lead_not_found" }, 404);
    if (error instanceof DbError && error.code === "P0001") return json<BookingResponse>({ ok: false, error: "slot_unavailable" }, 409);
    console.error("[reservation]", error);
    return json<BookingResponse>({ ok: false, error: "generic" }, 500);
  }

  // L'événement dans l'agenda, avec le lien Google Meet ; à défaut d'agenda
  // branché, une salle de visio de repli. L'échec de l'agenda ne défait pas
  // la réservation : elle est en base, le courriel partira avec le repli.
  const { OWNER_NAME, OWNER_TIMEZONE } = env();
  let meetUrl: string | null = null;
  let eventId: string | null = null;
  try {
    const meeting = await createMeeting({
      start,
      end,
      summary: input.locale === "fr" ? `Antidotes × ${input.name} — visio` : `Antidotes × ${input.name} — video call`,
      description:
        input.locale === "fr"
          ? `Rendez-vous pris sur antidotes.agency.\nPour ${input.name} : ${whenWithZone(start, input.timezone, "fr")}.\nPour ${OWNER_NAME} : ${whenWithZone(start, OWNER_TIMEZONE, "fr")}.${input.notes ? `\n\nSujet : ${input.notes}` : ""}`
          : `Booked on antidotes.agency.\nFor ${input.name}: ${whenWithZone(start, input.timezone, "en")}.\nFor ${OWNER_NAME}: ${whenWithZone(start, OWNER_TIMEZONE, "en")}.${input.notes ? `\n\nTopic: ${input.notes}` : ""}`,
      attendeeEmail: booked.email,
      attendeeName: input.name,
    });
    eventId = meeting.eventId;
    meetUrl = meeting.meetUrl;
  } catch (error) {
    console.error("[reservation] agenda", error);
  }
  if (!meetUrl) meetUrl = fallbackMeetUrl(booked.booking_id);
  try {
    await setBookingCalendar({ bookingId: booked.booking_id, cancelToken: booked.cancel_token, eventId, meetUrl });
  } catch (error) {
    console.error("[reservation] set_booking_calendar", error);
  }
  after(() => processOutbox().catch((error) => console.error("[outbox]", error)));

  const cancelUrl = `${SITE_URL}${localePath(input.locale, input.locale === "fr" ? `/rdv/${booked.cancel_token}` : `/booking/${booked.cancel_token}`)}`;
  const icsUrl = `${SITE_URL}/api/reservation/${booked.cancel_token}/ics`;
  const googleUrl = googleCalendarUrl({
    start,
    end,
    title: input.locale === "fr" ? `Antidotes × ${input.name} — visio` : `Antidotes × ${input.name} — video call`,
    details: meetUrl,
    location: meetUrl,
  });
  return json<BookingResponse>({
    ok: true,
    booking: { id: booked.booking_id, start: start.toISOString(), end: end.toISOString(), meetUrl, cancelUrl, icsUrl, googleUrl },
  });
}
