import { describe, expect, it } from "vitest";

import {
  isInWindow,
  nextWindowStart,
  parisDay,
  parisDayStart,
  parisParts,
  parisTime,
  stepDueAt,
} from "./schedule";

describe("parisTime", () => {
  it("pose 9 h de Paris en été et en hiver", () => {
    expect(parisTime(2026, 7, 15, 9).toISOString()).toBe("2026-07-15T07:00:00.000Z");
    expect(parisTime(2026, 1, 15, 9).toISOString()).toBe("2026-01-15T08:00:00.000Z");
  });

  it("reste juste le jour du changement d'heure", () => {
    // Le 29 mars 2026 à 3 h, Paris passe à l'heure d'été : 9 h = 7 h UTC.
    expect(parisTime(2026, 3, 29, 9).toISOString()).toBe("2026-03-29T07:00:00.000Z");
    // Le 25 octobre 2026, retour à l'heure d'hiver : 9 h = 8 h UTC.
    expect(parisTime(2026, 10, 25, 9).toISOString()).toBe("2026-10-25T08:00:00.000Z");
  });
});

describe("isInWindow", () => {
  it("accepte un mardi 10 h de Paris, refuse 18 h et le dimanche", () => {
    expect(isInWindow(new Date("2026-09-08T08:00:00Z"))).toBe(true); // mardi 10 h
    expect(isInWindow(new Date("2026-09-08T16:00:00Z"))).toBe(false); // mardi 18 h
    expect(isInWindow(new Date("2026-09-06T10:00:00Z"))).toBe(false); // dimanche
  });
});

describe("nextWindowStart", () => {
  it("rend l'instant lui-même s'il est dans la fenêtre", () => {
    const at = new Date("2026-09-08T08:30:00Z");
    expect(nextWindowStart(at)).toBe(at);
  });

  it("attend l'ouverture du jour quand il est trop tôt", () => {
    expect(nextWindowStart(new Date("2026-09-08T04:00:00Z"))?.toISOString()).toBe(
      "2026-09-08T07:00:00.000Z",
    );
  });

  it("reporte au lundi 9 h depuis un vendredi soir", () => {
    expect(nextWindowStart(new Date("2026-09-11T17:30:00Z"))?.toISOString()).toBe(
      "2026-09-14T07:00:00.000Z",
    );
  });

  it("rend null sur une fenêtre vide", () => {
    expect(nextWindowStart(new Date(), { days: [], start_hour: 9, end_hour: 18 })).toBeNull();
    expect(nextWindowStart(new Date(), { days: [1], start_hour: 18, end_hour: 9 })).toBeNull();
  });
});

describe("stepDueAt", () => {
  it("compte J+4 en jours calendaires puis ramène dans la fenêtre", () => {
    // Inscription mardi 8 septembre 10 h Paris : J+4 = samedi → lundi 14, 9 h.
    const enrolled = new Date("2026-09-08T08:00:00Z");
    expect(stepDueAt(enrolled, 4)?.toISOString()).toBe("2026-09-14T07:00:00.000Z");
    expect(stepDueAt(enrolled, 0)?.toISOString()).toBe("2026-09-08T08:00:00.000Z");
  });
});

describe("parisDay", () => {
  it("date un instant du jour de Paris, pas d'UTC", () => {
    expect(parisDay(new Date("2026-09-08T22:30:00Z"))).toBe("2026-09-09");
    expect(parisDayStart(new Date("2026-09-08T22:30:00Z")).toISOString()).toBe(
      "2026-09-08T22:00:00.000Z",
    );
    expect(parisParts(new Date("2026-09-08T22:30:00Z")).weekday).toBe(3);
  });
});
