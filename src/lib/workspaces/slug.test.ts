import { describe, expect, it } from "vitest";

import { slugify, uniqueSlug } from "./slug";

describe("slugify", () => {
  it("met à plat les accents, la casse et la ponctuation", () => {
    expect(slugify("Chasseurs de Graines")).toBe("chasseurs-de-graines");
    expect(slugify("Bondet — Été 2026 !")).toBe("bondet-ete-2026");
  });

  it("ne laisse jamais de tiret en tête ni en queue", () => {
    expect(slugify("  ...Bondet...  ")).toBe("bondet");
  });

  it("rend une chaîne vide quand il ne reste rien à garder", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("uniqueSlug", () => {
  it("garde la base quand elle est libre", () => {
    expect(uniqueSlug("Bondet", new Set())).toBe("bondet");
  });

  it("numérote à partir de deux quand la base est prise", () => {
    expect(uniqueSlug("Bondet", new Set(["bondet"]))).toBe("bondet-2");
    expect(uniqueSlug("Bondet", new Set(["bondet", "bondet-2"]))).toBe("bondet-3");
  });

  it("retombe sur « espace » plutôt que de rendre une URL vide", () => {
    expect(uniqueSlug("!!!", new Set())).toBe("espace");
  });
});
