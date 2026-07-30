import { describe, expect, it } from "vitest";

import { proposeCanonical } from "./canonical";

/**
 * La question canonique préremplie fait la différence entre corriger et
 * rédiger. Un champ vide, sur cent messages, c'est cent pages blanches.
 */
describe("proposition de question canonique", () => {
  it("retire la salutation avant de découper la phrase", () => {
    // Le piège : découper d'abord sur « ! » ne laisse que « Bonjour ».
    expect(
      proposeCanonical("Bonjour ! J'ai commandé samedi, ça arrive quand normalement ?"),
    ).toBe("J'ai commandé samedi, ça arrive quand normalement ?");
  });

  it("gère les salutations anglaises", () => {
    expect(proposeCanonical("Hi! Do you ship to the UK?")).toBe(
      "Do you ship to the UK ?",
    );
  });

  it("ne garde que la première phrase utile", () => {
    expect(
      proposeCanonical("Salut, vous avez ce modèle en 38 ? Merci d'avance !"),
    ).toBe("Vous avez ce modèle en 38 ?");
  });

  it("ajoute le point d'interrogation manquant", () => {
    expect(proposeCanonical("je voudrais connaitre les delais")).toBe(
      "Je voudrais connaitre les delais ?",
    );
  });

  it("n'en ajoute pas un second", () => {
    expect(proposeCanonical("Quels sont vos délais ?")).toBe("Quels sont vos délais ?");
  });

  it("renvoie une chaîne vide sur un message sans contenu", () => {
    expect(proposeCanonical("Bonjour !")).toBe("");
    expect(proposeCanonical("   ")).toBe("");
  });

  it("laisse intact un message sans salutation", () => {
    expect(proposeCanonical("Vous livrez en Belgique ?")).toBe(
      "Vous livrez en Belgique ?",
    );
  });
});
