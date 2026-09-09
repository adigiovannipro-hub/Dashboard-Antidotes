import { describe, expect, it } from "vitest";

import { COUNTRIES, countryName, isKnownCountry } from "./countries";

describe("COUNTRIES", () => {
  it("ouvre sur la France et les francophones, puis le reste par ordre alphabétique", () => {
    const codes = COUNTRIES.map((country) => country.code);
    expect(codes[0]).toBe("FR");
    expect(codes.slice(0, 5)).toEqual(["FR", "BE", "CH", "LU", "MC"]);

    const others = COUNTRIES.slice(11).map((country) => country.name);
    expect(others).toEqual([...others].sort((a, b) => a.localeCompare(b, "fr")));
    expect(others[0]).toBe("Allemagne");
  });

  it("porte vingt pays, chacun sous un code alpha-2 unique", () => {
    expect(COUNTRIES).toHaveLength(20);
    const codes = new Set(COUNTRIES.map((country) => country.code));
    expect(codes.size).toBe(20);
    for (const code of codes) expect(code).toMatch(/^[A-Z]{2}$/);
  });
});

describe("countryName", () => {
  it("rend le nom français d'un code, quelle que soit la casse", () => {
    expect(countryName("FR")).toBe("France");
    expect(countryName(" be ")).toBe("Belgique");
    expect(countryName("CI")).toBe("Côte d'Ivoire");
  });

  it("rend le code tel quel quand la liste ne le connaît pas — rien n'est perdu", () => {
    expect(countryName("jp")).toBe("JP");
    expect(isKnownCountry("JP")).toBe(false);
    expect(isKnownCountry("fr")).toBe(true);
  });
});
