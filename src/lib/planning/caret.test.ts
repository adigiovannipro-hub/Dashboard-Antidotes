import { describe, expect, it } from "vitest";

import { rawIndexFromCollapsed } from "./caret";

describe("rawIndexFromCollapsed", () => {
  it("rend le même rang sur un texte sans blancs multiples", () => {
    expect(rawIndexFromCollapsed("Bonjour le monde", 8)).toBe(8);
  });

  it("saute les blancs réduits à une espace", () => {
    const raw = "Ligne une\n\nLigne deux";
    // « Ligne une Ligne deux » : le « L » de la seconde ligne est au rang 10.
    expect(raw[rawIndexFromCollapsed(raw, 10)]).toBe("L");
    expect(rawIndexFromCollapsed(raw, 10)).toBe(11);
  });

  it("borne au bout du texte", () => {
    expect(rawIndexFromCollapsed("abc", 99)).toBe(3);
    expect(rawIndexFromCollapsed("", 4)).toBe(0);
  });
});
