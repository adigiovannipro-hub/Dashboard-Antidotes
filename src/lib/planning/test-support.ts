/**
 * Fabrique de publications pour les tests du module.
 *
 * Les analyses de cadence, de stratégie et de santé lisent une dizaine de
 * champs dont trois comptent à chaque fois. Sans valeurs par défaut, chaque
 * test passerait quinze lignes à décrire ce qu'il ne teste pas, et l'assertion
 * disparaîtrait dans le bruit.
 */

import type { PlanningPlatform, ProducibleSubject } from "./types";

let counter = 0;

export function makeSubject(
  overrides: Partial<ProducibleSubject> = {},
): ProducibleSubject {
  counter += 1;
  const id = overrides.id ?? `subject-${counter}`;
  const scheduledOn = overrides.scheduled_on ?? null;

  return {
    id,
    name: `Sujet ${id}`,
    platform: "meta",
    format: "post",
    status: "validated",
    scheduled_on: scheduledOn,
    sponsoring: null,
    wording: "Un wording renseigné.",
    visual_urls: ["https://example.test/visual.png"],
    // Le mois du groupe suit la date planifiée, sauf mention contraire du test.
    month_key: scheduledOn ? `${scheduledOn.slice(0, 7)}-01` : "2026-08-01",
    ...overrides,
  };
}

/** Un mois de publications datées, une par entrée. */
export function makeMonth(
  days: {
    day: number;
    format?: ProducibleSubject["format"];
    name?: string;
    platform?: PlanningPlatform;
    status?: ProducibleSubject["status"];
  }[],
  month = "2026-08",
): ProducibleSubject[] {
  return days.map((entry, index) =>
    makeSubject({
      id: `${month}-${index}`,
      scheduled_on: `${month}-${String(entry.day).padStart(2, "0")}`,
      format: entry.format ?? "post",
      name: entry.name ?? `Sujet ${index}`,
      platform: entry.platform ?? "meta",
      status: entry.status ?? "validated",
    }),
  );
}
