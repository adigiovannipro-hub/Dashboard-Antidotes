import { enqueue, ping, upcomingBookings } from "@/lib/db";
import { env } from "@/lib/env";
import { json, secretMatches } from "@/lib/http/request";
import { processOutbox } from "@/lib/mail/outbox";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Le passage quotidien : garder la base éveillée (un projet Supabase gratuit
 * s'endort après une semaine sans requête), envoyer ce qui attend dans la
 * boîte d'envoi, et mettre en file les rappels de la veille.
 *
 * Répond 200 même en échec partiel — un 500 ferait rejouer par Vercel ce qui
 * a déjà réussi.
 */
export async function GET(request: Request): Promise<Response> {
  const header = request.headers.get("authorization");
  const provided = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!secretMatches(provided, env().CRON_SECRET)) return new Response("Introuvable", { status: 404 });

  const errors: string[] = [];
  const report: Record<string, unknown> = {};
  try {
    report.ping = await ping();
  } catch (error) {
    errors.push(`ping: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    // Les rendez-vous de demain : entre 20 h et 44 h devant nous, pour qu'un
    // passage quotidien n'en rate aucun et n'en rappelle aucun deux fois
    // (l'index unique sur la boîte d'envoi tient le doublon).
    const now = Date.now();
    const bookings = await upcomingBookings(new Date(now + 20 * 3_600_000), new Date(now + 44 * 3_600_000));
    let queued = 0;
    for (const booking of bookings) {
      try {
        await enqueue("booking_reminder", {
          booking_id: booking.booking_id,
          email: booking.email,
          first_name: booking.prospect_name,
          locale: booking.locale,
          cancel_token: booking.cancel_token,
        });
        queued += 1;
      } catch (error) {
        // Un rappel déjà en file lève une violation d'unicité : c'est attendu.
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes("outbox_reminder_once_idx")) errors.push(`rappel ${booking.booking_id}: ${message}`);
      }
    }
    report.reminders = { candidates: bookings.length, queued };
  } catch (error) {
    errors.push(`rappels: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    report.outbox = await processOutbox(50);
  } catch (error) {
    errors.push(`outbox: ${error instanceof Error ? error.message : String(error)}`);
  }
  return json({ ok: errors.length === 0, report, errors });
}
