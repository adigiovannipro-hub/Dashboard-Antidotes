import { describe, expect, it } from "vitest";

import {
  FRESH_WINDOW_MINUTES,
  STALE_AFTER_MINUTES,
  decideSync,
  formatSyncAge,
  isStale,
  minutesSince,
  type SyncSnapshot,
} from "./sync-state";

const NOW = new Date("2026-08-18T09:14:00.000Z");

const snapshot = (overrides: Partial<SyncSnapshot> = {}): SyncSnapshot => ({
  lastRunAt: null,
  lastRunStatus: null,
  lastAttemptAt: null,
  running: false,
  unavailable: null,
  ...overrides,
});

/** Décalage d'un instant par rapport à `NOW`, en minutes. */
const minutesAgo = (minutes: number): string =>
  new Date(NOW.getTime() - minutes * 60_000).toISOString();

describe("decideSync", () => {
  it("lance la synchronisation quand rien n'a jamais tourné", () => {
    expect(decideSync({ now: NOW, snapshot: snapshot(), forced: false })).toEqual({
      action: "dispatch",
    });
  });

  it("lance la synchronisation quand la dernière exécution est ancienne", () => {
    const state = snapshot({ lastAttemptAt: minutesAgo(360) });
    expect(decideSync({ now: NOW, snapshot: state, forced: false })).toEqual({
      action: "dispatch",
    });
  });

  it("ne relance rien dans la fenêtre de fraîcheur", () => {
    const state = snapshot({ lastAttemptAt: minutesAgo(FRESH_WINDOW_MINUTES - 1) });
    expect(decideSync({ now: NOW, snapshot: state, forced: false })).toEqual({
      action: "skip",
      reason: "fraiche",
    });
  });

  it("relance dès la fenêtre atteinte, bord compris", () => {
    const state = snapshot({ lastAttemptAt: minutesAgo(FRESH_WINDOW_MINUTES) });
    expect(decideSync({ now: NOW, snapshot: state, forced: false })).toEqual({
      action: "dispatch",
    });
  });

  it("le bouton passe outre la fraîcheur", () => {
    const state = snapshot({ lastAttemptAt: minutesAgo(1) });
    expect(decideSync({ now: NOW, snapshot: state, forced: true })).toEqual({
      action: "dispatch",
    });
  });

  it("le bouton ne double jamais une exécution en cours", () => {
    const state = snapshot({ running: true, lastAttemptAt: minutesAgo(1) });
    expect(decideSync({ now: NOW, snapshot: state, forced: true })).toEqual({
      action: "wait",
      reason: "en-cours",
    });
  });

  it("l'indisponibilité prime sur tout le reste", () => {
    const state = snapshot({ running: true, unavailable: "GITHUB_SYNC_TOKEN absent." });
    expect(decideSync({ now: NOW, snapshot: state, forced: true })).toEqual({
      action: "skip",
      reason: "indisponible",
    });
  });
});

describe("minutesSince", () => {
  it("compte les minutes écoulées", () => {
    expect(minutesSince(minutesAgo(137), NOW)).toBe(137);
  });

  it("rend null plutôt que zéro sur un instant absent", () => {
    expect(minutesSince(null, NOW)).toBeNull();
  });

  it("rend null sur une date illisible", () => {
    expect(minutesSince("pas une date", NOW)).toBeNull();
  });

  it("ne rend jamais de durée négative", () => {
    expect(minutesSince(new Date(NOW.getTime() + 60_000).toISOString(), NOW)).toBe(0);
  });
});

describe("formatSyncAge", () => {
  it("dit l'absence de synchronisation plutôt que de la deviner", () => {
    expect(formatSyncAge(null)).toBe("jamais synchronisé");
  });

  it("arrondit la minute en cours à « à l'instant »", () => {
    expect(formatSyncAge(0)).toBe("à l'instant");
  });

  it("compte en minutes sous l'heure", () => {
    expect(formatSyncAge(43)).toBe("il y a 43 min");
  });

  it("compte en heures au-delà", () => {
    expect(formatSyncAge(140)).toBe("il y a 2 h");
  });

  it("compte en jours au-delà de vingt-quatre heures", () => {
    expect(formatSyncAge(60 * 50)).toBe("il y a 2 j");
  });
});

describe("isStale", () => {
  it("tient l'absence de synchronisation pour une donnée périmée", () => {
    expect(isStale(null)).toBe(true);
  });

  it("laisse passer une synchronisation récente", () => {
    expect(isStale(20)).toBe(false);
  });

  it("ne s'alarme pas de l'écart normal entre deux passages du fond de tâche", () => {
    // Deux passages par jour, rapprochés par le retard de GitHub : vingt-trois
    // heures sans passage, c'est la règle.
    expect(isStale(23 * 60)).toBe(false);
  });

  it("signale un retard dès le seuil atteint, bord compris", () => {
    expect(isStale(STALE_AFTER_MINUTES - 1)).toBe(false);
    expect(isStale(STALE_AFTER_MINUTES)).toBe(true);
  });

  it("signale une journée entière sans passage", () => {
    expect(isStale(27 * 60)).toBe(true);
  });
});
