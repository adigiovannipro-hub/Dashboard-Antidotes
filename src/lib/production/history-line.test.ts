import { describe, expect, it } from "vitest";

import { captionExcerpt, historyLine, type HistorySubject } from "./history-line";

const subject = (overrides: Partial<HistorySubject> = {}): HistorySubject => ({
  date: "2026-09-15",
  platform: "META",
  format: "CARROUSEL",
  name: "JACKIE COULEURS VERRES",
  status: "published",
  visuals: 8,
  wording: "La Jackie joue toutes ses cartes.\n\nPlusieurs coloris de monture.",
  ...overrides,
});

describe("captionExcerpt", () => {
  it("met la légende sur une ligne", () => {
    expect(captionExcerpt("Une ligne.\n\nPuis une autre.")).toBe("Une ligne. Puis une autre.");
  });

  it("rend null pour une cellule vide", () => {
    expect(captionExcerpt(null)).toBeNull();
    expect(captionExcerpt("  \n ")).toBeNull();
  });

  it("coupe au mot et le dit", () => {
    expect(captionExcerpt("Des lunettes fabriquées en France", 20)).toBe("Des lunettes…");
  });
});

describe("historyLine", () => {
  it("porte le nombre de visuels et la légende", () => {
    expect(historyLine(subject())).toBe(
      "- 2026-09-15 · META · CARROUSEL · « JACKIE COULEURS VERRES » · 8 visuels\n" +
        "  Légende : « La Jackie joue toutes ses cartes. Plusieurs coloris de monture. »",
    );
  });

  it("n'annonce aucun visuel quand il n'y en a pas", () => {
    expect(historyLine(subject({ visuals: 0, wording: null }))).toBe(
      "- 2026-09-15 · META · CARROUSEL · « JACKIE COULEURS VERRES »",
    );
  });

  it("accorde au singulier", () => {
    expect(historyLine(subject({ visuals: 1, wording: null }))).toContain("· 1 visuel");
  });

  it("ne sert pas un brief pour une légende", () => {
    expect(historyLine(subject({ status: "idea", wording: "Angle : montrer l'atelier." }))).not.toContain(
      "Légende",
    );
  });

  it("dit l'absence de date", () => {
    expect(historyLine(subject({ date: null, wording: null }))).toMatch(/^- sans date ·/);
  });
});
