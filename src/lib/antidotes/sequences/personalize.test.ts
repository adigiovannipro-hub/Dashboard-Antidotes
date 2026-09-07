import { describe, expect, it } from "vitest";

import { parseObservation } from "./personalize";

describe("parseObservation", () => {
  it("ne garde qu'une phrase, sans guillemets", () => {
    expect(parseObservation("« Vos vitrines changent chaque saison. » Et autre chose.")).toBe(
      "Vos vitrines changent chaque saison.",
    );
  });

  it("rend null sur AUCUNE, le vide ou une phrase trop longue", () => {
    expect(parseObservation("AUCUNE")).toBeNull();
    expect(parseObservation("  aucune.  ")).toBeNull();
    expect(parseObservation("")).toBeNull();
    expect(parseObservation("x".repeat(300))).toBeNull();
  });
});
