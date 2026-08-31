import { describe, expect, it } from "vitest";

import {
  DEFAULT_PLANNING_VIEW,
  parsePlanningView,
  planningViewCookie,
  serializePlanningView,
  type PlanningView,
} from "./ui-preferences";

describe("planningViewCookie", () => {
  it("nomme un cookie par tableau, sans caractère hasardeux", () => {
    expect(planningViewCookie("bondet", "pe-2026")).toBe(
      "antidotes_planning_bondet_pe_2026",
    );
  });
});

describe("parsePlanningView", () => {
  const view: PlanningView = {
    sort: { column: "format", direction: "asc" },
    mode: "calendrier",
    months: ["2026-08"],
    closedLanes: ["lane-1"],
  };

  it("relit ce qu'elle a écrit", () => {
    expect(parsePlanningView(serializePlanningView(view))).toEqual(view);
  });

  it("relit un cookie d'avant la généralisation du tri comme un tri de Date", () => {
    const raw = encodeURIComponent(JSON.stringify({ sort: "desc" }));
    expect(parsePlanningView(raw).sort).toEqual({
      column: "date",
      direction: "desc",
    });
  });

  it("écarte un tri sur une colonne inconnue ou une direction invalide", () => {
    const bad = (sort: unknown) =>
      parsePlanningView(encodeURIComponent(JSON.stringify({ sort }))).sort;
    expect(bad({ column: "visual", direction: "asc" })).toBe("position");
    expect(bad({ column: "date", direction: "haut" })).toBe("position");
  });

  it("rend le tableau par défaut sans cookie", () => {
    expect(parsePlanningView(undefined)).toEqual(DEFAULT_PLANNING_VIEW);
  });

  it("ne jette jamais sur un cookie abîmé", () => {
    expect(parsePlanningView("{pas du json")).toEqual(DEFAULT_PLANNING_VIEW);
    expect(parsePlanningView("null")).toEqual(DEFAULT_PLANNING_VIEW);
  });

  it("écarte un tri inconnu et les entrées qui ne sont pas du texte", () => {
    const raw = encodeURIComponent(
      JSON.stringify({ sort: "aleatoire", months: ["2026-08", 42], closedLanes: "x" }),
    );
    expect(parsePlanningView(raw)).toEqual({
      sort: "position",
      mode: "tableau",
      months: ["2026-08"],
      closedLanes: [],
    });
  });

  it("écarte un mode d'affichage inconnu", () => {
    const raw = encodeURIComponent(JSON.stringify({ mode: "mosaique" }));
    expect(parsePlanningView(raw).mode).toBe("tableau");
  });

  it("distingue « tout replié » de « jamais touché »", () => {
    // Liste vide : un choix, tout reste fermé au retour.
    expect(parsePlanningView(serializePlanningView({ ...view, months: [] })).months).toEqual(
      [],
    );
    // Absente : le tableau rouvre son mois en cours.
    expect(parsePlanningView(encodeURIComponent(JSON.stringify({ sort: "asc" }))).months).toBeNull();
  });
});
