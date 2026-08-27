import { describe, expect, it } from "vitest";

import { slugifyCategoryName } from "./categories";

describe("slugifyCategoryName", () => {
  it("met à plat accents, casse et espaces", () => {
    expect(slugifyCategoryName("  Salaires & Charges  ")).toBe("salaires-charges");
    expect(slugifyCategoryName("Téléphonie")).toBe("telephonie");
  });

  it("fait de deux écritures du même mot un seul slug", () => {
    expect(slugifyCategoryName("Matériel")).toBe(slugifyCategoryName("materiel"));
  });

  it("rend une chaîne vide sur un nom sans substance", () => {
    expect(slugifyCategoryName(" —— ")).toBe("");
  });
});
