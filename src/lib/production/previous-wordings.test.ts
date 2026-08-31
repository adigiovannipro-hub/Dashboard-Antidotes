import { describe, expect, it } from "vitest";

import {
  pickPreviousWordings,
  renderPreviousWordings,
  stripCreaSections,
  type PreviousWordingEntry,
} from "./previous-wordings";

const entry = (text: string, publishedOn: string | null = null): PreviousWordingEntry => ({
  text,
  publishedOn,
});

describe("stripCreaSections", () => {
  it("retire les sections de créa que l'ancienne génération empilait", () => {
    const stacked =
      "La caption publiable.\n\n---\nContenu de la créa : deux montures posées.\n\n---\nSlide 1 : Titre";
    expect(stripCreaSections(stacked)).toBe("La caption publiable.");
  });

  it("laisse intact un wording sans section empilée", () => {
    expect(stripCreaSections("Caption simple.\nSur deux lignes.")).toBe(
      "Caption simple.\nSur deux lignes.",
    );
  });
});

describe("pickPreviousWordings", () => {
  it("met l'historique d'abord, puis le board du plus récent au plus ancien", () => {
    const picked = pickPreviousWordings(
      [entry("Depuis l'historique.", "2026-08-20")],
      [entry("Board juin.", "2026-06-10"), entry("Board juillet.", "2026-07-12")],
    );
    expect(picked.map((candidate) => candidate.text)).toEqual([
      "Depuis l'historique.",
      "Board juillet.",
      "Board juin.",
    ]);
  });

  it("dédoublonne la même caption présente aux deux endroits, espaces et casse pliés", () => {
    const picked = pickPreviousWordings(
      [entry("La même  caption.")],
      [entry("la même caption."), entry("Une autre.")],
    );
    expect(picked).toHaveLength(2);
  });

  it("écarte les textes vides et respecte la limite", () => {
    const board = Array.from({ length: 12 }, (_, index) =>
      entry(`Caption ${index}.`, `2026-07-${String(index + 1).padStart(2, "0")}`),
    );
    const picked = pickPreviousWordings([entry("   ")], board, 5);
    expect(picked).toHaveLength(5);
    expect(picked[0]!.text).toBe("Caption 11.");
  });
});

describe("renderPreviousWordings", () => {
  it("rend une liste numérotée et datée", () => {
    const rendered = renderPreviousWordings([
      entry("Première caption.", "2026-07-12"),
      entry("Deuxième."),
    ]);
    expect(rendered).toContain("--- Wording 1 (2026-07-12) ---\nPremière caption.");
    expect(rendered).toContain("--- Wording 2 ---\nDeuxième.");
  });

  it("borne un wording interminable", () => {
    const rendered = renderPreviousWordings([entry("x".repeat(900))]);
    expect(rendered.length).toBeLessThan(800);
    expect(rendered.endsWith("…")).toBe(true);
  });

  it("ne rend rien sans précédent — le prompt affichera « Non renseigné »", () => {
    expect(renderPreviousWordings([])).toBe("");
  });
});
