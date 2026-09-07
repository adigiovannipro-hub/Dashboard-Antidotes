import { describe, expect, it } from "vitest";

import {
  createLegalRegistryFinder,
  employeesFromBracket,
  pickRegistryResult,
  registryPeople,
  type RegistryResult,
} from "./legal-registry";

const fiche: RegistryResult = {
  siren: "123456789",
  nom_complet: "OPTIQUE SAINT JEAN",
  nom_raison_sociale: "OPTIQUE SAINT JEAN",
  tranche_effectif_salarie: "12",
  siege: { code_postal: "69005", libelle_commune: "LYON" },
  dirigeants: [
    { nom: "ROUX", prenoms: "Camille, Marie", qualite: "Gérant", type_dirigeant: "personne physique" },
    { nom: "HOLDING SJ", qualite: "Associé", type_dirigeant: "personne morale" },
  ],
};

describe("pickRegistryResult", () => {
  it("prend la fiche au bon code postal parmi les homonymes", () => {
    const elsewhere = { ...fiche, siren: "999", siege: { code_postal: "75001", libelle_commune: "PARIS" } };
    expect(
      pickRegistryResult([elsewhere, fiche], { company_name: "Optique Saint-Jean", postal_code: "69005", city: "Lyon" })
        ?.siren,
    ).toBe("123456789");
  });

  it("refuse une fiche ailleurs quand on connaît la ville, accepte sans repère", () => {
    expect(
      pickRegistryResult([fiche], { company_name: "Optique Saint-Jean", postal_code: null, city: "Paris" }),
    ).toBeNull();
    expect(
      pickRegistryResult([fiche], { company_name: "Optique Saint-Jean", postal_code: null, city: null })?.siren,
    ).toBe("123456789");
  });

  it("ignore une fiche dont le nom ne ressemble pas", () => {
    expect(
      pickRegistryResult([{ ...fiche, nom_complet: "BOULANGERIE DUPONT", nom_raison_sociale: null }], {
        company_name: "Optique Saint-Jean",
        postal_code: null,
        city: null,
      }),
    ).toBeNull();
  });
});

describe("registryPeople", () => {
  it("ne garde que les personnes physiques, prénom et nom mis en forme", () => {
    expect(registryPeople(fiche)).toEqual([
      { first_name: "Camille", last_name: "Roux", role: "Gérant", source: "legal_registry" },
    ]);
  });
});

describe("employeesFromBracket", () => {
  it("ramène une tranche INSEE à un effectif", () => {
    expect(employeesFromBracket("12")).toBe(35);
    expect(employeesFromBracket("NN")).toBeNull();
    expect(employeesFromBracket(null)).toBeNull();
  });
});

describe("createLegalRegistryFinder", () => {
  it("interroge l'API avec le nom et le code postal, et rend dirigeants et effectif", async () => {
    let requested = "";
    const fetcher = (async (url: string | URL | Request) => {
      requested = String(url);
      return new Response(JSON.stringify({ results: [fiche] }), { status: 200 });
    }) as typeof fetch;

    const find = createLegalRegistryFinder({ fetcher });
    const result = await find({
      company_name: "Optique Saint-Jean",
      website: null,
      city: "Lyon",
      postal_code: "69005",
      country: "FR",
    });

    expect(requested).toContain("recherche-entreprises.api.gouv.fr/search?q=Optique+Saint-Jean");
    expect(requested).toContain("code_postal=69005");
    expect(result.people).toHaveLength(1);
    expect(result.employees).toBe(35);
    expect(result.siren).toBe("123456789");
  });
});
