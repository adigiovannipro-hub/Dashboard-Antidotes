import { fallbackMeetUrl } from "@/lib/booking/calendar";
import { getBooking } from "@/lib/db";
import { env } from "@/lib/env";
import { buildIcs } from "@/lib/ics";

export const dynamic = "force-dynamic";

/** L'invitation .ics d'une réservation, à ajouter à n'importe quel agenda. */
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await context.params;
  if (!/^[0-9a-f]{32}$/.test(token)) return new Response("Introuvable", { status: 404 });
  const booking = await getBooking(token);
  if (!booking) return new Response("Introuvable", { status: 404 });
  const { OWNER_EMAIL, OWNER_NAME } = env();
  const meetUrl = booking.meet_url ?? fallbackMeetUrl(booking.booking_id);
  const name = booking.prospect_name ?? booking.email;
  const fr = booking.locale === "fr";
  const ics = buildIcs({
    uid: `${booking.booking_id}@antidotes.agency`,
    start: new Date(booking.starts_at),
    end: new Date(booking.ends_at),
    summary: fr ? `Antidotes × ${name} — visio` : `Antidotes × ${name} — video call`,
    description: fr ? `Lien de visio : ${meetUrl}` : `Video link: ${meetUrl}`,
    location: meetUrl,
    url: meetUrl,
    organizer: { name: OWNER_NAME, email: OWNER_EMAIL },
    attendee: { name, email: booking.email },
    method: booking.status === "cancelled" ? "CANCEL" : "REQUEST",
    sequence: booking.status === "cancelled" ? 1 : 0,
    stamp: new Date(),
  });
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="antidotes-rdv.ics"`,
      "cache-control": "no-store",
    },
  });
}
