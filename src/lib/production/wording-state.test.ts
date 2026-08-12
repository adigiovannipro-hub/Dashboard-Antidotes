import { describe, expect, it } from "vitest";

import { needsContent } from "./wording-state";

describe("needsContent", () => {
  it("réclame un contenu pour un sujet vide", () => {
    expect(needsContent({ status: "idea", hasWording: false })).toBe(true);
    expect(needsContent({ status: "to_validate", hasWording: false })).toBe(true);
  });

  it("réécrit par-dessus un brief, aux statuts qui en portent un", () => {
    // Deux phrases de cadrage dans la cellule ne sont pas un livrable :
    // c'est la consigne, et le texte final la remplace.
    expect(needsContent({ status: "idea", hasWording: true })).toBe(true);
    expect(needsContent({ status: "wording_todo", hasWording: true })).toBe(true);
  });

  it("ne touche jamais à un texte validé ou programmé", () => {
    expect(needsContent({ status: "to_validate", hasWording: true })).toBe(false);
    expect(needsContent({ status: "validated", hasWording: true })).toBe(false);
    expect(needsContent({ status: "scheduled", hasWording: true })).toBe(false);
  });

  it("laisse un post publié tranquille, même sans texte en base", () => {
    expect(needsContent({ status: "published", hasWording: false })).toBe(false);
  });
});
