import { describe, expect, it } from "vitest";

import { plainText } from "./rich";

describe("plainText", () => {
  it("retire les marques du mot-clé et de l'italique sans toucher au texte", () => {
    expect(plainText("Des réseaux sociaux *qui rapportent*, _chiffres à l'appui._")).toBe("Des réseaux sociaux qui rapportent, chiffres à l'appui.");
  });
  it("laisse intact un texte sans marque", () => {
    expect(plainText("Votre rendez-vous")).toBe("Votre rendez-vous");
  });
});
