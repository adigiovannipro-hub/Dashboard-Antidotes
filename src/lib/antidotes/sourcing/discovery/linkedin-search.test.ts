import { describe, expect, it } from "vitest";

import { linkedinQuery, parseLinkedinTitle, peopleFromSearch } from "./linkedin-search";

describe("parseLinkedinTitle", () => {
  it("lit prénom, nom et poste quand la société est la nôtre", () => {
    expect(
      parseLinkedinTitle("Camille Roux - Gérante - Optique Saint-Jean | LinkedIn", "Optique Saint-Jean", "https://l/in/c"),
    ).toEqual({
      first_name: "Camille",
      last_name: "Roux",
      role: "Gérante",
      linkedin_url: "https://l/in/c",
      source: "linkedin",
    });
  });

  it("accepte la société avant le poste et les tirets longs", () => {
    expect(parseLinkedinTitle("Nora Diallo – Optique Saint Jean – Responsable marketing", "Optique Saint-Jean", null))
      .toMatchObject({ first_name: "Nora", role: "Responsable marketing" });
  });

  it("écarte un homonyme d'une autre société ou un titre sans nom complet", () => {
    expect(parseLinkedinTitle("Camille Roux - Gérante - Boulangerie Roux | LinkedIn", "Optique Saint-Jean", null)).toBeNull();
    expect(parseLinkedinTitle("Camille - Optique Saint-Jean | LinkedIn", "Optique Saint-Jean", null)).toBeNull();
  });
});

describe("peopleFromSearch", () => {
  it("dédoublonne et ignore les résultats sans titre", () => {
    const people = peopleFromSearch(
      [
        {
          organicResults: [
            { title: "Camille Roux - Gérante - Optique Saint-Jean | LinkedIn", url: "u1" },
            { title: "Camille Roux - Fondatrice - Optique Saint-Jean | LinkedIn", url: "u2" },
            { url: "u3" },
          ],
        },
      ],
      "Optique Saint-Jean",
    );
    expect(people).toHaveLength(1);
    expect(people[0]?.linkedin_url).toBe("u1");
  });
});

describe("linkedinQuery", () => {
  it("cible les profils, la société entre guillemets, la ville en plus", () => {
    expect(linkedinQuery({ company_name: "Optique Saint-Jean", city: "Lyon" })).toBe(
      'site:linkedin.com/in "Optique Saint-Jean" Lyon',
    );
  });
});
