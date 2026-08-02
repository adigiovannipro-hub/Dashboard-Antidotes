/**
 * Fabrique de sujets pour les tests du module.
 *
 * Les analyses de cadence, de stratégie et de santé lisent une quinzaine de
 * champs dont trois comptent à chaque fois. Sans valeurs par défaut, chaque
 * test passerait vingt lignes à décrire ce qu'il ne teste pas, et l'assertion
 * disparaîtrait dans le bruit.
 */

import type { PlanningPlatform, SubjectWithLane } from "./types";

let counter = 0;

export function makeSubject(
  overrides: Partial<SubjectWithLane> = {},
): SubjectWithLane {
  counter += 1;
  const id = overrides.id ?? `subject-${counter}`;
  const scheduledOn = overrides.scheduled_on ?? null;

  return {
    id,
    lane_id: "lane-1",
    month_id: "month-1",
    client_id: "client-1",
    monday_item_id: `monday-${id}`,
    name: `Sujet ${id}`,
    format: "post",
    format_raw: "POST",
    scheduled_on: scheduledOn,
    status: "validated",
    status_raw: "VALIDÉ",
    wording: "Un wording renseigné.",
    comments: null,
    sponsoring: null,
    objective: null,
    owner_name: "Alessandro",
    visual_urls: ["https://example.test/visual.png"],
    permalink: null,
    pending_wording: null,
    pending_since: null,
    pushed_at: null,
    monday_updated_at: null,
    synced_at: "2026-08-01T00:00:00.000Z",
    created_at: "2026-07-01T00:00:00.000Z",
    platform: "meta",
    lane_name: "META",
    // Le mois du groupe suit la date planifiée, sauf mention contraire du test.
    month_key: scheduledOn ? `${scheduledOn.slice(0, 7)}-01` : "2026-08-01",
    ...overrides,
  };
}

/** Un mois de contenus datés, un par entrée. */
export function makeMonth(
  days: {
    day: number;
    format?: SubjectWithLane["format"];
    name?: string;
    platform?: PlanningPlatform;
    status?: SubjectWithLane["status"];
  }[],
  month = "2026-08",
): SubjectWithLane[] {
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
