"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import type { Dictionary } from "@/i18n/types";
import type { Locale } from "@/i18n/locale";
import { isValidTimeZone } from "@/lib/booking/timezone";
import { API, type AvailabilityResponse, type BookingDto, type BookingRequest, type BookingResponse, type SlotDto } from "@/lib/funnel-contract";

import {
  canGoNextWeek,
  canGoPrevWeek,
  describeTimeZone,
  formatDayHeading,
  formatSlotTime,
  groupSlotsByDay,
  timeZoneChoices,
  weekBounds,
} from "./state";
import { BUTTON_GHOST, BUTTON_PRIMARY, BUTTON_SECONDARY, FIELD, LABEL } from "./styles";

type BookingDict = Dictionary["funnel"]["booking"];

type Props = {
  dict: BookingDict;
  locale: Locale;
  leadId: string;
  prefill: { firstName: string };
  /** Appelé une fois la réservation écrite, avec le fuseau dans lequel le créneau a été choisi. */
  onConfirmed: (booking: BookingDto, timeZone: string) => void;
};

type SlotsResult = { key: string; slots: SlotDto[]; failed: boolean };

function detectTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone && isValidTimeZone(zone)) return zone;
  } catch {
    // Pas de fuseau résolu : on retombe sur Paris, le fuseau de la clientèle.
  }
  return "Europe/Paris";
}

/**
 * Le choix du créneau puis le formulaire — tout se passe dans le fuseau du
 * visiteur, et c'est le serveur qui tranche : un créneau pris entre-temps
 * revient en `slot_taken`, la grille se recharge et le message le dit.
 */
export function Booking({ dict, locale, leadId, prefill, onConfirmed }: Props) {
  // Le composant ne se monte que dans le navigateur (l'écran serveur est
  // toujours l'intro), donc `Intl` et l'horloge sont ceux du visiteur.
  const [now] = useState(() => new Date());
  const [timeZone, setTimeZone] = useState(detectTimeZone);
  const [detected] = useState(() => timeZone);
  const [tzOpen, setTzOpen] = useState(false);
  const [weekIndex, setWeekIndex] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<SlotsResult | null>(null);
  const [selected, setSelected] = useState<SlotDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = { tz: useId(), form: useId(), status: useId() };
  const formHeadingRef = useRef<HTMLHeadingElement>(null);
  const tzSelectRef = useRef<HTMLSelectElement>(null);

  const fetchKey = `${weekIndex}:${reloadToken}`;
  const loading = result?.key !== fetchKey;

  useEffect(() => {
    let cancelled = false;
    const { from, to } = weekBounds(new Date(), weekIndex);
    const url = `${API.availability}?du=${encodeURIComponent(from.toISOString())}&au=${encodeURIComponent(to.toISOString())}`;
    fetch(url, { headers: { accept: "application/json" } })
      .then((response) => response.json() as Promise<AvailabilityResponse>)
      .then((json) => {
        if (cancelled) return;
        setResult(json.ok ? { key: fetchKey, slots: json.slots, failed: false } : { key: fetchKey, slots: [], failed: true });
      })
      .catch(() => {
        if (!cancelled) setResult({ key: fetchKey, slots: [], failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [fetchKey, weekIndex]);

  // Le formulaire prend le focus dès qu'un créneau est choisi, le sélecteur
  // de fuseau dès qu'on l'ouvre : ce qu'on vient de demander est sous les doigts.
  useEffect(() => {
    if (selected) formHeadingRef.current?.focus({ preventScroll: true });
  }, [selected]);
  useEffect(() => {
    if (tzOpen) tzSelectRef.current?.focus({ preventScroll: true });
  }, [tzOpen]);

  const days = result && !loading ? groupSlotsByDay(result.slots, timeZone) : [];
  const failed = result?.key === fetchKey && result.failed;

  function reload(): void {
    setSelected(null);
    setReloadToken((token) => token + 1);
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selected || busy) return;
    const data = new FormData(event.currentTarget);
    const read = (name: string) => String(data.get(name) ?? "").trim();
    const name = read("name");
    if (!name) return;
    const optional = (value: string) => (value ? value : null);
    const body: BookingRequest = {
      leadId,
      start: selected.start,
      timezone: timeZone,
      name,
      company: optional(read("company")),
      phone: optional(read("phone")),
      notes: optional(read("notes")),
      locale,
    };
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(API.booking, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await response.json()) as BookingResponse;
      if (json.ok) {
        onConfirmed(json.booking, timeZone);
        return;
      }
      if (json.error === "slot_taken" || json.error === "slot_unavailable") {
        setError(dict.taken);
        reload();
      } else {
        setError(dict.error);
      }
    } catch {
      setError(dict.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="type-h3 text-text" tabIndex={-1}>
          {dict.title}
        </h3>
        <p className="type-body mt-2 text-text-2">{dict.lead}</p>
      </div>

      {/* Le fuseau : affiché, et modifiable sans quitter l'écran. */}
      <div className="flex flex-col gap-2 rounded-md border border-line bg-field px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 type-small">
          <span className="text-text-2">{dict.tzLabel}</span>
          <span className="font-medium text-text">{describeTimeZone(timeZone, now)}</span>
          <button
            type="button"
            className="type-small text-accent-ink underline underline-offset-4 hover:text-accent-ink-strong"
            onClick={() => setTzOpen((open) => !open)}
            aria-controls={ids.tz}
            aria-expanded={tzOpen}
          >
            {dict.tzChange}
          </button>
        </div>
        {tzOpen ? (
          <div>
            <label htmlFor={ids.tz} className="sr-only">
              {dict.tzLabel}
            </label>
            <select
              id={ids.tz}
              ref={tzSelectRef}
              className={FIELD}
              value={timeZone}
              onChange={(event) => setTimeZone(event.target.value)}
            >
              {timeZoneChoices(detected).map((zone) => (
                <option key={zone} value={zone}>
                  {describeTimeZone(zone, now)}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <p className="type-caption text-text-3">{dict.tzOwnerNote}</p>
      </div>

      {/* La semaine : précédente / suivante, bornées à l'horizon. */}
      <div className="flex items-center justify-between gap-3">
        <button type="button" className={BUTTON_GHOST} onClick={() => setWeekIndex((i) => i - 1)} disabled={!canGoPrevWeek(weekIndex) || busy}>
          <span aria-hidden="true">←</span> {dict.prevWeek}
        </button>
        <button type="button" className={BUTTON_GHOST} onClick={() => setWeekIndex((i) => i + 1)} disabled={!canGoNextWeek(weekIndex) || busy}>
          {dict.nextWeek} <span aria-hidden="true">→</span>
        </button>
      </div>

      <div id={ids.status} role="status" aria-live="polite" className="type-small text-text-2">
        {loading ? dict.loading : failed ? dict.error : days.length === 0 ? dict.empty : null}
      </div>

      {!loading && days.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-flow-col sm:auto-cols-fr">
          {days.map((day) => {
            const first = day.slots[0];
            if (!first) return null;
            return (
              <section key={day.day} aria-label={formatDayHeading(first.start, locale, timeZone)}>
                {/* Deux lignes réservées : « Mercredi 14 octobre » passe à la ligne, et les colonnes doivent rester alignées. */}
                <h4 className="type-caption text-text-2 first-letter:uppercase sm:min-h-[2.9em]">{formatDayHeading(first.start, locale, timeZone)}</h4>
                <ul className="mt-2 flex flex-col gap-2">
                  {day.slots.map((slot) => {
                    const active = selected?.start === slot.start;
                    return (
                      <li key={slot.start}>
                        <button
                          type="button"
                          aria-pressed={active}
                          disabled={busy}
                          onClick={() => {
                            setError(null);
                            setSelected(slot);
                          }}
                          className={`w-full rounded-md border px-3 py-2 type-small font-medium tabular-nums transition duration-(--motion) ease-(--ease) ${
                            active
                              ? "border-btn bg-btn text-btn-text"
                              : "border-line bg-field text-text hover:border-line-strong hover:bg-surface"
                          }`}
                        >
                          {formatSlotTime(slot.start, locale, timeZone)}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      ) : null}

      {selected ? (
        <form onSubmit={submit} className="flex flex-col gap-4 rounded-md border border-line bg-field p-4 sm:p-5" aria-labelledby={ids.form}>
          <div>
            <h4 id={ids.form} ref={formHeadingRef} tabIndex={-1} className="type-h3 text-text">
              {dict.form.title}
            </h4>
            <p className="type-small mt-1 text-text-2">
              {formatDayHeading(selected.start, locale, timeZone)} · {formatSlotTime(selected.start, locale, timeZone)} – {formatSlotTime(selected.end, locale, timeZone)}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor={`${ids.form}-name`} className={LABEL}>
                {dict.form.name}
              </label>
              <input id={`${ids.form}-name`} name="name" required autoComplete="name" defaultValue={prefill.firstName} className={FIELD} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${ids.form}-company`} className={LABEL}>
                {dict.form.company}
              </label>
              <input id={`${ids.form}-company`} name="company" autoComplete="organization" className={FIELD} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${ids.form}-phone`} className={LABEL}>
                {dict.form.phone}
              </label>
              <input id={`${ids.form}-phone`} name="phone" type="tel" autoComplete="tel" className={FIELD} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor={`${ids.form}-notes`} className={LABEL}>
                {dict.form.notes}
              </label>
              <textarea id={`${ids.form}-notes`} name="notes" rows={3} className={`${FIELD} h-auto py-2.5`} />
            </div>
          </div>
          <div aria-live="assertive" className="type-small text-danger-ink empty:hidden">
            {error}
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            {/* Revenir à la grille : « Changer » est le seul libellé de ce sens dans le dictionnaire. */}
            <button type="button" className={BUTTON_SECONDARY} onClick={() => setSelected(null)} disabled={busy}>
              {dict.tzChange}
            </button>
            <button type="submit" className={BUTTON_PRIMARY} disabled={busy}>
              {busy ? dict.form.busy : dict.form.cta}
            </button>
          </div>
        </form>
      ) : error ? (
        <div aria-live="assertive" className="type-small text-danger-ink">
          {error}
        </div>
      ) : null}
    </div>
  );
}
