import { describe, expect, it } from "vitest";

import { displayName, needsOnboarding, safeNext } from "./identity";

describe("displayName", () => {
  it("préfère le prénom et le nom", () => {
    expect(displayName({ first_name: "Candice", last_name: "HEYMAN", email: "c@x.fr" })).toBe(
      "Candice HEYMAN",
    );
  });

  it("retombe sur le nom composé, puis sur l'adresse", () => {
    expect(displayName({ full_name: "Candice H.", email: "c@x.fr" })).toBe("Candice H.");
    expect(displayName({ email: "c@x.fr" })).toBe("c@x.fr");
    expect(displayName(null)).toBe("Utilisateur");
  });
});

describe("needsOnboarding", () => {
  it("demande l'accueil tant que le prénom ou le nom manque", () => {
    expect(needsOnboarding({ first_name: "Candice", last_name: null })).toBe(true);
    expect(needsOnboarding({ first_name: " ", last_name: "HEYMAN" })).toBe(true);
  });

  it("ne le demande pas quand l'agence a déjà nommé la personne", () => {
    expect(needsOnboarding({ first_name: "Candice", last_name: "HEYMAN" })).toBe(false);
    expect(needsOnboarding(null)).toBe(false);
  });
});

describe("safeNext", () => {
  it("ne suit qu'un chemin interne", () => {
    expect(safeNext("/espace/anmf/planning")).toBe("/espace/anmf/planning");
    expect(safeNext("https://ailleurs.fr")).toBe("/");
    expect(safeNext("//ailleurs.fr")).toBe("/");
    expect(safeNext("/bienvenue")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });
});
