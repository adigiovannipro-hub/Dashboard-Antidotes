import { describe, expect, it } from "vitest";

import {
  DEFAULT_PLANNING_VIEW,
  clampFaqColumnWidth,
  faqViewCookie,
  parseFaqColumnWidths,
  parsePlanningView,
  planningViewCookie,
  serializeFaqColumnWidths,
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

describe("parseFaqColumnWidths", () => {
  it("relit les largeurs écrites par le tableau", () => {
    expect(parseFaqColumnWidths(serializeFaqColumnWidths({ answer: 420 }))).toEqual({
      answer: 420,
    });
  });

  it("rend un tableau par défaut sur un cookie absent ou illisible", () => {
    expect(parseFaqColumnWidths(undefined)).toEqual({});
    expect(parseFaqColumnWidths("pas du json")).toEqual({});
  });

  it("borne une largeur bricolée à la main", () => {
    const raw = encodeURIComponent(JSON.stringify({ answer: 99999, theme: 2, title: "large" }));
    // Une colonne à deux pixels serait invisible, une à cent mille pousserait
    // le tableau hors de l'écran ; une valeur non numérique ne compte pas.
    expect(parseFaqColumnWidths(raw)).toEqual({ answer: 900, theme: 80 });
  });
});

describe("clampFaqColumnWidth", () => {
  it("arrondit et borne au plancher commun sans plancher de colonne", () => {
    expect(clampFaqColumnWidth(420.4)).toBe(420);
    expect(clampFaqColumnWidth(2)).toBe(80);
    expect(clampFaqColumnWidth(99_999)).toBe(900);
  });

  it("respecte le plancher de la colonne quand il est plus haut", () => {
    // La Question part de `minmax(200px, …)` : une fois figée en pixels, la
    // piste ne tient plus le plancher, c'est le geste qui doit le porter.
    expect(clampFaqColumnWidth(120, 200)).toBe(200);
    expect(clampFaqColumnWidth(260, 200)).toBe(260);
  });

  it("ne descend jamais sous le plancher commun, même sur un plancher plus bas", () => {
    expect(clampFaqColumnWidth(10, 20)).toBe(80);
  });
});

describe("faqViewCookie", () => {
  it("ne garde que des caractères de nom de cookie", () => {
    expect(faqViewCookie("3f2a-11ee")).toBe("antidotes_faq_3f2a_11ee");
  });
});
