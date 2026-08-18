import { describe, expect, it } from "vitest";

import { findWorkspaceByLabel, foldWorkspaceKey } from "./lookup";

const ESPACES = [
  { id: "1", slug: "bondet", name: "Bondet" },
  { id: "2", slug: "iway", name: "I-WAY" },
  { id: "3", slug: "catherine-osti-2", name: "Catherine Osti" },
];

describe("foldWorkspaceKey", () => {
  it("efface casse, accents et ponctuation", () => {
    expect(foldWorkspaceKey("I-WAY")).toBe("iway");
    expect(foldWorkspaceKey("Catherine Osti")).toBe("catherineosti");
    expect(foldWorkspaceKey("Échéances")).toBe("echeances");
  });
});

describe("findWorkspaceByLabel", () => {
  it("retrouve un espace dont le slug ne suit pas le nom", () => {
    // Le cas qui a coûté 28 relevés : le fichier dit « i-way », la base « iway ».
    expect(findWorkspaceByLabel("i-way", ESPACES)?.id).toBe("2");
    expect(findWorkspaceByLabel("I-WAY", ESPACES)?.id).toBe("2");
  });

  it("retrouve par le nom quand le slug porte un suffixe", () => {
    expect(findWorkspaceByLabel("Catherine Osti", ESPACES)?.id).toBe("3");
  });

  it("préfère le slug au nom", () => {
    // Deux clients peuvent porter le même nom le temps d'une duplication ;
    // jamais le même slug.
    const ambigu = [
      { id: "a", slug: "bondet-2", name: "Bondet" },
      { id: "b", slug: "bondet", name: "Bondet (copie)" },
    ];
    expect(findWorkspaceByLabel("bondet", ambigu)?.id).toBe("b");
  });

  it("ne rend rien pour un inconnu ou un libellé vide", () => {
    expect(findWorkspaceByLabel("ANMF", ESPACES)).toBeNull();
    expect(findWorkspaceByLabel("  ", ESPACES)).toBeNull();
  });
});
