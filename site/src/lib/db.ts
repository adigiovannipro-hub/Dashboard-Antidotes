import "server-only";

import { env } from "@/lib/env";

/**
 * Le client de la base du site : des appels de fonctions SQL par l'API REST
 * de Supabase (`/rest/v1/rpc/<fonction>`), rien d'autre.
 *
 * Aucune table n'est exposée : chaque fonction exige la clé du site
 * (`SITE_DB_KEY`), ajoutée ici en premier paramètre. Le navigateur n'appelle
 * jamais cette base — tout passe par les routes du serveur.
 */
export class DbError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "DbError";
  }
}

export type Locale = "fr" | "en";
export type Temperature = "chaud" | "tiede" | "froid";

async function rpc<T>(fn: string, params: Record<string, unknown>): Promise<T> {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, SITE_DB_KEY } = env();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ p_key: SITE_DB_KEY, ...params }),
    cache: "no-store",
  });
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    const error = (payload ?? {}) as { code?: string; message?: string };
    throw new DbError(error.message ?? `Base indisponible (${response.status})`, error.code ?? "unknown", response.status);
  }
  return payload as T;
}

export type LeadCreated = { lead_id: string; created: boolean };

export async function createLead(input: {
  email: string;
  firstName: string;
  locale: Locale;
  consentText: string;
  utm: Record<string, string>;
  userAgent: string | null;
  timezone: string | null;
}): Promise<LeadCreated> {
  const rows = await rpc<LeadCreated[]>("create_lead", {
    p_email: input.email,
    p_first_name: input.firstName,
    p_locale: input.locale,
    p_consent_text: input.consentText,
    p_utm: input.utm,
    p_user_agent: input.userAgent,
    p_timezone: input.timezone,
  });
  const row = rows[0];
  if (!row) throw new DbError("create_lead sans résultat", "empty", 500);
  return row;
}

export async function saveAnswers(input: {
  leadId: string;
  answers: Record<string, unknown>;
  score: number | null;
  temperature: Temperature | null;
  completed: boolean;
}): Promise<void> {
  await rpc<null>("save_answers", {
    p_lead_id: input.leadId,
    p_answers: input.answers,
    p_score: input.score,
    p_temperature: input.temperature,
    p_completed: input.completed,
  });
}

export type Range = { starts_at: string; ends_at: string };

export async function bookedRanges(from: Date, to: Date): Promise<Range[]> {
  return rpc<Range[]>("booked_ranges", { p_from: from.toISOString(), p_to: to.toISOString() });
}

export type Booked = { booking_id: string; cancel_token: string; email: string };

export async function bookSlot(input: {
  leadId: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  name: string;
  company: string | null;
  phone: string | null;
  notes: string | null;
  locale: Locale;
}): Promise<Booked> {
  const rows = await rpc<Booked[]>("book_slot", {
    p_lead_id: input.leadId,
    p_starts_at: input.startsAt.toISOString(),
    p_ends_at: input.endsAt.toISOString(),
    p_timezone: input.timezone,
    p_name: input.name,
    p_company: input.company,
    p_phone: input.phone,
    p_notes: input.notes,
    p_locale: input.locale,
  });
  const row = rows[0];
  if (!row) throw new DbError("book_slot sans résultat", "empty", 500);
  return row;
}

export async function setBookingCalendar(input: {
  bookingId: string;
  cancelToken: string;
  eventId: string | null;
  meetUrl: string | null;
}): Promise<void> {
  await rpc<null>("set_booking_calendar", {
    p_booking_id: input.bookingId,
    p_cancel_token: input.cancelToken,
    p_event_id: input.eventId,
    p_meet_url: input.meetUrl,
  });
}

export type BookingView = {
  booking_id: string;
  email: string;
  starts_at: string;
  ends_at: string;
  prospect_timezone: string;
  prospect_name: string | null;
  status: "confirmed" | "cancelled";
  calendar_event_id: string | null;
  meet_url: string | null;
  locale: Locale;
};

export async function getBooking(cancelToken: string): Promise<BookingView | null> {
  const rows = await rpc<BookingView[]>("get_booking", { p_cancel_token: cancelToken });
  return rows[0] ?? null;
}

export type Cancelled = {
  booking_id: string;
  email: string;
  starts_at: string;
  calendar_event_id: string | null;
  locale: Locale;
  prospect_name: string | null;
  prospect_timezone: string;
};

export async function cancelBooking(cancelToken: string): Promise<Cancelled | null> {
  const rows = await rpc<Cancelled[]>("cancel_booking", { p_cancel_token: cancelToken });
  return rows[0] ?? null;
}

export async function rateCheck(bucket: string, limit: number, windowSeconds: number): Promise<boolean> {
  return rpc<boolean>("rate_check", { p_bucket: bucket, p_limit: limit, p_window: `${windowSeconds} seconds` });
}

export async function enqueue(kind: string, payload: Record<string, unknown>): Promise<string> {
  return rpc<string>("enqueue", { p_kind: kind, p_payload: payload });
}

export type OutboxRow = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  status: "pending" | "sent" | "failed";
  attempts: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
};

export async function outboxTake(limit: number): Promise<OutboxRow[]> {
  return rpc<OutboxRow[]>("outbox_take", { p_limit: limit });
}

export async function outboxSettle(id: string, ok: boolean, error: string | null): Promise<void> {
  await rpc<null>("outbox_settle", { p_id: id, p_ok: ok, p_error: error });
}

export type UpcomingBooking = {
  booking_id: string;
  email: string;
  starts_at: string;
  ends_at: string;
  prospect_timezone: string;
  prospect_name: string | null;
  meet_url: string | null;
  locale: Locale;
  cancel_token: string;
};

export async function upcomingBookings(from: Date, to: Date): Promise<UpcomingBooking[]> {
  return rpc<UpcomingBooking[]>("upcoming_bookings", { p_from: from.toISOString(), p_to: to.toISOString() });
}

export type LeadProfile = {
  email: string;
  first_name: string | null;
  locale: Locale;
  answers: Record<string, unknown> | null;
  score: number | null;
  temperature: Temperature | null;
  completed_at: string | null;
};

export async function leadProfile(leadId: string): Promise<LeadProfile | null> {
  const rows = await rpc<LeadProfile[]>("lead_profile", { p_lead_id: leadId });
  return rows[0] ?? null;
}

export async function ping(): Promise<string> {
  return rpc<string>("site_ping", {});
}
