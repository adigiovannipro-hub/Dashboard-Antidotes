import { describe, expect, it } from "vitest";

import { findEmail, patternFinder } from "./cascade";
import { pickDropcontactEmail, statusFromQualification } from "./dropcontact";
import { statusFromHunter } from "./hunter";
import type { EmailFinder, EmailInput } from "../providers";

const input: EmailInput = {
  first_name: "Camille",
  last_name: "Roux",
  website: "https://optique-saint-jean.fr",
  company_name: "Optique Saint-Jean",
};

const finder = (result: Awaited<ReturnType<EmailFinder>> | Error): EmailFinder => async () => {
  if (result instanceof Error) throw result;
  return result;
};

const waterfall = (...providers: ("dropcontact" | "hunter" | "pattern")[]) =>
  providers.map((provider) => ({ provider, enabled: true }));

describe("findEmail", () => {
  it("s'arrête au premier fournisseur qui rend une adresse valide", async () => {
    let hunterCalled = false;
    const result = await findEmail(input, {
      waterfall: waterfall("dropcontact", "hunter"),
      finders: {
        dropcontact: finder({ email: "camille.roux@optique-saint-jean.fr", status: "valid", provider: "dropcontact" }),
        hunter: async () => {
          hunterCalled = true;
          return null;
        },
      },
      verifier: null,
    });
    expect(result?.provider).toBe("dropcontact");
    expect(hunterCalled).toBe(false);
  });

  it("garde le meilleur résultat incertain quand rien n'est valide, et journalise les échecs", async () => {
    const errors: string[] = [];
    const result = await findEmail(input, {
      waterfall: waterfall("dropcontact", "hunter", "pattern"),
      finders: {
        dropcontact: finder(new Error("quota")),
        hunter: finder({ email: "c.roux@optique-saint-jean.fr", status: "risky", provider: "hunter" }),
      },
      verifier: null,
      onError: (provider) => errors.push(provider),
    });
    expect(result).toEqual({ email: "c.roux@optique-saint-jean.fr", status: "risky", provider: "hunter" });
    expect(errors).toEqual(["dropcontact"]);
  });

  it("respecte l'ordre et l'activation de la campagne", async () => {
    const order: string[] = [];
    await findEmail(input, {
      waterfall: [
        { provider: "hunter", enabled: true },
        { provider: "dropcontact", enabled: false },
      ],
      finders: {
        hunter: async () => {
          order.push("hunter");
          return null;
        },
        dropcontact: async () => {
          order.push("dropcontact");
          return null;
        },
      },
      verifier: null,
    });
    expect(order).toEqual(["hunter"]);
  });
});

describe("patternFinder", () => {
  it("sans vérificateur, une déduction est incertaine — jamais valide", async () => {
    const result = await patternFinder(input, null);
    expect(result).toEqual({ email: "camille.roux@optique-saint-jean.fr", status: "risky", provider: "pattern" });
  });

  it("avec vérificateur, s'arrête à la première adresse valide, trois essais au plus", async () => {
    const tried: string[] = [];
    const result = await patternFinder(input, async (email) => {
      tried.push(email);
      return email.startsWith("camille@") ? "valid" : "invalid";
    });
    expect(result?.email).toBe("camille@optique-saint-jean.fr");
    expect(tried).toHaveLength(3);
  });

  it("ne déduit rien sans domaine de société", async () => {
    expect(await patternFinder({ ...input, website: "https://facebook.com/x" }, null)).toBeNull();
  });
});

describe("statuts des fournisseurs", () => {
  it("traduit les qualifications Dropcontact", () => {
    expect(statusFromQualification("nominative@pro")).toBe("valid");
    expect(statusFromQualification("catch_all@pro")).toBe("risky");
    expect(statusFromQualification("nominative@perso")).toBe("risky");
    expect(statusFromQualification(undefined)).toBe("unknown");
    expect(
      pickDropcontactEmail({
        email: [
          { email: "Contact@x.fr", qualification: "catch_all@pro" },
          { email: "c.roux@x.fr", qualification: "nominative@pro" },
        ],
      }),
    ).toEqual({ email: "c.roux@x.fr", status: "valid" });
  });

  it("traduit les statuts Hunter, score compris", () => {
    expect(statusFromHunter("valid")).toBe("valid");
    expect(statusFromHunter("accept_all")).toBe("risky");
    expect(statusFromHunter("invalid")).toBe("invalid");
    expect(statusFromHunter(null, 85)).toBe("risky");
    expect(statusFromHunter(null, 20)).toBe("unknown");
  });
});
