import { describe, expect, it } from "vitest";

import { domainOf, emailToken, inferEmails } from "./email-pattern";

describe("domainOf", () => {
  it("lit le domaine d'un site, sans www ni chemin", () => {
    expect(domainOf("https://www.lunettes-bondet.fr/collection")).toBe("lunettes-bondet.fr");
    expect(domainOf("optique-saint-jean.fr")).toBe("optique-saint-jean.fr");
  });

  it("refuse une plateforme tierce ou une boîte gratuite", () => {
    expect(domainOf("https://www.facebook.com/optiquesaintjean")).toBeNull();
    expect(domainOf("https://optique.wixsite.com/site")).toBeNull();
    expect(domainOf("gmail.com")).toBeNull();
    expect(domainOf(null)).toBeNull();
    expect(domainOf("pas un site")).toBeNull();
  });
});

describe("emailToken", () => {
  it("retire accents, espaces et apostrophes, garde le tiret", () => {
    expect(emailToken("Jean-Pierre")).toBe("jean-pierre");
    expect(emailToken("Émilie")).toBe("emilie");
    expect(emailToken("De la Tour")).toBe("delatour");
    expect(emailToken("D'Angelo")).toBe("dangelo");
  });
});

describe("inferEmails", () => {
  it("propose les motifs dans l'ordre, sans doublon", () => {
    const emails = inferEmails({ first_name: "Camille", last_name: "Roux" }, "https://optique-saint-jean.fr");
    expect(emails.slice(0, 3)).toEqual([
      "camille.roux@optique-saint-jean.fr",
      "croux@optique-saint-jean.fr",
      "camille@optique-saint-jean.fr",
    ]);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it("ne déduit rien sans domaine de société ni nom complet", () => {
    expect(inferEmails({ first_name: "Camille", last_name: "Roux" }, "https://facebook.com/x")).toEqual([]);
    expect(inferEmails({ first_name: "Camille", last_name: null }, "https://site.fr")).toEqual([]);
  });
});
