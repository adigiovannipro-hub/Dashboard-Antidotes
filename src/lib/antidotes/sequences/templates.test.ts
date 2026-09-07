import { describe, expect, it } from "vitest";

import { greetingName, listPlaceholders, renderTemplate } from "./templates";

describe("renderTemplate", () => {
  it("remplace les variables connues", () => {
    const out = renderTemplate("Bonjour {{prenom}}, chez {{ societe }} à {{ville}}.", {
      prenom: "Camille",
      societe: "Optique Saint-Jean",
      ville: "Lyon",
    });
    expect(out.text).toBe("Bonjour Camille, chez Optique Saint-Jean à Lyon.");
    expect(out.missing).toEqual([]);
  });

  it("prend le repli quand la valeur manque, et le dit sinon", () => {
    const out = renderTemplate("Bonjour {{prenom|à vous}}, {{observation}}", { prenom: "" });
    expect(out.text).toBe("Bonjour à vous, {{observation}}");
    expect(out.missing).toEqual(["observation"]);
  });

  it("garde une variable inconnue telle quelle et la nomme", () => {
    const out = renderTemplate("{{prenom}} {{truc}}", { prenom: "Léa" });
    expect(out.text).toBe("Léa {{truc}}");
    expect(out.missing).toEqual(["truc"]);
  });

  it("ne compte chaque manque qu'une fois", () => {
    const out = renderTemplate("{{societe}} et encore {{societe}}", {});
    expect(out.missing).toEqual(["societe"]);
  });
});

describe("listPlaceholders", () => {
  it("liste les variables dans l'ordre, sans doublon, repli compris", () => {
    expect(listPlaceholders("{{prenom|là}} {{societe}} {{prenom}} {{lien_case_study}}")).toEqual([
      "prenom",
      "societe",
      "lien_case_study",
    ]);
  });
});

describe("greetingName", () => {
  it("garde le premier mot avec sa majuscule", () => {
    expect(greetingName("CAMILLE ROUX")).toBe("Camille");
    expect(greetingName("jean-marc")).toBe("Jean-Marc");
    expect(greetingName("  Léa ")).toBe("Léa");
  });

  it("rend null sans prénom", () => {
    expect(greetingName(null)).toBeNull();
    expect(greetingName("   ")).toBeNull();
  });
});
