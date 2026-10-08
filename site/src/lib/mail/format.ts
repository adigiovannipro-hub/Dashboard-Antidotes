import type { Locale } from "@/i18n/locale";
import { offsetMs } from "@/lib/booking/timezone";

/** « mardi 14 octobre 2026, 10:00 » dans le fuseau donné. */
export function formatWhen(date: Date, timeZone: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** « UTC+2 » / « UTC-5 » / « UTC+5:30 » pour un instant dans un fuseau. */
export function utcOffsetLabel(date: Date, timeZone: string): string {
  const minutes = Math.round(offsetMs(date, timeZone) / 60_000);
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
}

/** Le nom lisible d'un fuseau (« Paris », « New York »), sans la région. */
export function timeZoneCity(timeZone: string): string {
  const city = timeZone.split("/").pop() ?? timeZone;
  return city.replace(/_/g, " ");
}

export function whenWithZone(date: Date, timeZone: string, locale: Locale): string {
  return `${formatWhen(date, timeZone, locale)} (${timeZoneCity(timeZone)}, ${utcOffsetLabel(date, timeZone)})`;
}

export function googleCalendarUrl(options: { start: Date; end: Date; title: string; details: string; location?: string }): string {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: options.title,
    dates: `${stamp(options.start)}/${stamp(options.end)}`,
    details: options.details,
    ...(options.location ? { location: options.location } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
