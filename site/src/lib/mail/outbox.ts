import "server-only";

import { composioEnabled, env } from "@/lib/env";
import { sendMail } from "@/lib/composio";
import { getBooking, leadProfile, outboxSettle, outboxTake, type OutboxRow } from "@/lib/db";
import { localePath, SITE_URL } from "@/i18n/locale";
import type { Locale } from "@/i18n/locale";
import type { Answers, Temperature } from "@/lib/questionnaire";
import { fallbackMeetUrl } from "@/lib/booking/calendar";
import { googleCalendarUrl } from "./format";
import {
  bookingCancelled,
  bookingConfirmation,
  bookingReminder,
  coldTips,
  leadWelcome,
  ownerBooking,
  ownerCancelled,
  ownerLeadCreated,
  ownerQuestionnaire,
  type BookingMailInput,
  type Rendered,
} from "./templates";

/**
 * La boîte d'envoi : chaque événement du tunnel y dépose une ligne, et ce
 * passage la transforme en courriels. Il tourne juste après chaque requête
 * (dans `after()`) et chaque nuit par le cron, qui rattrape ce qu'une panne
 * de Composio aurait laissé.
 *
 * Sans `COMPOSIO_API_KEY`, rien ne part : les lignes restent `pending` et
 * partiront dès que la clé sera posée — aucun lead n'est perdu.
 */
type Outgoing = { to: string; mail: Rendered };

function asLocale(value: unknown): Locale {
  return value === "en" ? "en" : "fr";
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function bookingLinks(options: { cancelToken: string; locale: Locale; start: Date; end: Date; meetUrl: string | null; firstName: string }) {
  const cancelUrl = `${SITE_URL}${localePath(options.locale, options.locale === "fr" ? `/rdv/${options.cancelToken}` : `/booking/${options.cancelToken}`)}`;
  const icsUrl = `${SITE_URL}/api/reservation/${options.cancelToken}/ics`;
  const title = options.locale === "fr" ? `Antidotes × ${options.firstName} — visio` : `Antidotes × ${options.firstName} — video call`;
  const googleUrl = googleCalendarUrl({
    start: options.start,
    end: options.end,
    title,
    details: options.meetUrl ?? "",
    location: options.meetUrl ?? undefined,
  });
  return { cancelUrl, icsUrl, googleUrl };
}

export async function buildMails(row: OutboxRow): Promise<Outgoing[]> {
  const { OWNER_EMAIL, OWNER_TIMEZONE } = env();
  const p = row.payload;
  const locale = asLocale(p.locale);
  const email = str(p.email);
  if (!email) return [];
  const firstName = str(p.first_name) ?? (locale === "fr" ? "bonjour" : "hello");
  const continueUrl = `${SITE_URL}${localePath(locale)}?note=1#note`;

  switch (row.kind) {
    case "lead_created":
      return [
        { to: email, mail: leadWelcome(locale, { firstName, continueUrl }) },
        { to: OWNER_EMAIL, mail: ownerLeadCreated({ email, firstName, locale, utm: (p.utm as Record<string, string>) ?? {}, timezone: str(p.timezone) }) },
      ];
    case "questionnaire_completed":
      return [
        {
          to: OWNER_EMAIL,
          mail: ownerQuestionnaire({
            email,
            firstName,
            answers: (p.answers as Answers) ?? {},
            score: typeof p.score === "number" ? p.score : p.score ? Number(p.score) : null,
            temperature: (p.temperature as Temperature | null) ?? null,
          }),
        },
      ];
    case "cold_tips":
      return [{ to: email, mail: coldTips(locale, { firstName, continueUrl }) }];
    case "booking_created": {
      const cancelToken = str(p.cancel_token);
      if (!cancelToken) return [];
      // On relit la réservation : le lien de visio est posé après la mise en
      // file, une fois l'événement créé dans l'agenda.
      const booking = await getBooking(cancelToken);
      if (!booking || booking.status !== "confirmed") return [];
      const start = new Date(booking.starts_at);
      const end = new Date(booking.ends_at);
      const name = str(p.name) ?? booking.prospect_name ?? firstName;
      const meetUrl = booking.meet_url ?? fallbackMeetUrl(booking.booking_id);
      const links = bookingLinks({ cancelToken, locale, start, end, meetUrl, firstName: name });
      const input: BookingMailInput = {
        firstName: name,
        start,
        end,
        prospectTimeZone: booking.prospect_timezone,
        ownerTimeZone: OWNER_TIMEZONE,
        meetUrl,
        ...links,
      };
      return [
        { to: email, mail: bookingConfirmation(locale, input) },
        {
          to: OWNER_EMAIL,
          mail: ownerBooking({
            email,
            name,
            company: str(p.company),
            phone: str(p.phone),
            notes: str(p.notes),
            start,
            prospectTimeZone: booking.prospect_timezone,
            ownerTimeZone: OWNER_TIMEZONE,
            meetUrl,
            calendarCreated: Boolean(booking.calendar_event_id),
            answers: (p.answers as Answers | null) ?? null,
            score: typeof p.score === "number" ? p.score : p.score ? Number(p.score) : null,
            temperature: (p.temperature as Temperature | null) ?? null,
            cancelUrl: links.cancelUrl,
          }),
        },
      ];
    }
    case "booking_reminder": {
      const cancelToken = str(p.cancel_token);
      if (!cancelToken) return [];
      const booking = await getBooking(cancelToken);
      if (!booking || booking.status !== "confirmed") return [];
      const start = new Date(booking.starts_at);
      const end = new Date(booking.ends_at);
      const name = booking.prospect_name ?? firstName;
      const meetUrl = booking.meet_url ?? fallbackMeetUrl(booking.booking_id);
      const links = bookingLinks({ cancelToken, locale: booking.locale, start, end, meetUrl, firstName: name });
      return [
        {
          to: email,
          mail: bookingReminder(booking.locale, { firstName: name, start, end, prospectTimeZone: booking.prospect_timezone, ownerTimeZone: OWNER_TIMEZONE, meetUrl, ...links }),
        },
      ];
    }
    case "booking_cancelled": {
      const start = new Date(String(p.starts_at));
      const name = str(p.name);
      return [
        { to: email, mail: bookingCancelled(locale, { firstName: name ?? firstName, start, prospectTimeZone: str(p.timezone) ?? "UTC", continueUrl }) },
        { to: OWNER_EMAIL, mail: ownerCancelled({ email, name, start, ownerTimeZone: OWNER_TIMEZONE }) },
      ];
    }
    default:
      return [];
  }
}

export type OutboxReport = { taken: number; sent: number; failed: number; skipped: boolean; errors: string[] };

/** Envoie ce qui attend. Idempotent : une ligne partie ne repart pas. */
export async function processOutbox(limit = 20): Promise<OutboxReport> {
  const report: OutboxReport = { taken: 0, sent: 0, failed: 0, skipped: !composioEnabled(), errors: [] };
  if (report.skipped) return report;
  const rows = await outboxTake(limit);
  report.taken = rows.length;
  for (const row of rows) {
    try {
      const mails = await buildMails(row);
      for (const outgoing of mails) {
        await sendMail({ to: outgoing.to, subject: outgoing.mail.subject, html: outgoing.mail.html, text: outgoing.mail.text });
      }
      await outboxSettle(row.id, true, null);
      report.sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      report.failed += 1;
      report.errors.push(`${row.kind}: ${message}`);
      await outboxSettle(row.id, false, message.slice(0, 500));
    }
  }
  return report;
}

/** Le profil d'un lead, pour les routes qui ont besoin de son prénom. */
export async function leadFirstName(leadId: string): Promise<string | null> {
  const profile = await leadProfile(leadId);
  return profile?.first_name ?? null;
}
