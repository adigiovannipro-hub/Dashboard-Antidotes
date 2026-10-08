import type { Answers, Temperature } from "@/lib/questionnaire";
import type { Locale } from "@/i18n/locale";

/**
 * Le contrat entre le tunnel côté navigateur et les routes du serveur.
 * Les deux côtés importent ces types : un champ renommé casse la compilation
 * des deux, jamais un seul.
 *
 * La note sur 10 ne figure dans aucune réponse : elle se dévoile en
 * rendez-vous, jamais à l'écran.
 */
export type LeadRequest = {
  email: string;
  firstName: string;
  locale: Locale;
  consent: true;
  timezone: string | null;
  utm: Record<string, string>;
  /** Champ piège, toujours vide pour un humain. */
  website?: string;
};
export type LeadResponse = { ok: true; leadId: string; created: boolean } | { ok: false; error: "invalid" | "rate_limited" | "generic" };

export type QuestionnaireRequest = { leadId: string; answers: Answers; completed: boolean };
export type QuestionnaireResponse =
  | { ok: true; temperature: Temperature | null }
  | { ok: false; error: "invalid" | "incomplete" | "generic"; missing?: string[] };

export type TipsRequest = { leadId: string };
export type TipsResponse = { ok: true } | { ok: false; error: "invalid" | "generic" };

export type SlotDto = { start: string; end: string };
export type AvailabilityResponse = { ok: true; slots: SlotDto[]; calendarUsed: boolean } | { ok: false; error: "invalid" | "generic" };

export type BookingRequest = {
  leadId: string;
  start: string;
  timezone: string;
  name: string;
  company: string | null;
  phone: string | null;
  notes: string | null;
  locale: Locale;
};
export type BookingDto = {
  id: string;
  start: string;
  end: string;
  meetUrl: string | null;
  cancelUrl: string;
  icsUrl: string;
  googleUrl: string;
};
export type BookingResponse =
  | { ok: true; booking: BookingDto }
  | { ok: false; error: "invalid" | "slot_taken" | "slot_unavailable" | "lead_not_found" | "generic" };

export const API = {
  lead: "/api/lead",
  questionnaire: "/api/questionnaire",
  tips: "/api/conseils",
  availability: "/api/disponibilites",
  booking: "/api/reservation",
} as const;

/** Durée d'un rendez-vous, en minutes — la même dans l'écran et sur le serveur. */
export const MEETING_MINUTES = 30;
