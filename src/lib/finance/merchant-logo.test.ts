import { describe, expect, it } from "vitest";

import { domainCandidates, merchantInitials, merchantKey } from "./merchant-logo";

describe("merchantInitials", () => {
  it("prend la première lettre des deux premiers mots", () => {
    expect(merchantInitials("Black Sand Brewery")).toBe("BS");
    expect(merchantInitials("Google Wallet")).toBe("GW");
    expect(merchantInitials("Jelajah Coffee Roasters")).toBe("JC");
  });

  it("prend les deux premières lettres d'un mot unique", () => {
    expect(merchantInitials("Grab")).toBe("GR");
    expect(merchantInitials("Anthropic")).toBe("AN");
    expect(merchantInitials("Vercel")).toBe("VE");
  });

  it("écarte les formes juridiques et les mots vides", () => {
    // « PT » précède la moitié des marchands indonésiens : le garder ferait
    // commencer un marchand sur deux par la même lettre.
    expect(merchantInitials("PT Unbranded Hospitality")).toBe("UH");
    expect(merchantInitials("Anchor Bed and Bread")).toBe("AB");
    expect(merchantInitials("Notion Labs Inc")).toBe("NL");
  });

  it("nettoie le libellé brut d'un relevé", () => {
    expect(
      merchantInitials("Grab* A-9MXOR7UGWAE9AV, 6281384748739, IDN"),
    ).toBe("GR");
    expect(
      merchantInitials(
        "PT UNBRANDED HOSPITALITY, Lombok Tengah, IDN, 314900 IDR payment converted to EUR",
      ),
    ).toBe("UH");
  });

  it("ne rend rien plutôt qu'une lettre inventée", () => {
    expect(merchantInitials(null)).toBe("");
    expect(merchantInitials("")).toBe("");
    expect(merchantInitials("   ")).toBe("");
    // Un libellé qui ne commence que par un code de terminal.
    expect(merchantInitials(", LOMBOK, IDN, 537075 IDR payment")).toBe("");
    expect(merchantInitials("PT")).toBe("");
  });
});

describe("merchantKey", () => {
  it("range sous une clé stable, mêmes mots que les initiales", () => {
    expect(merchantKey("Black Sand Brewery")).toBe("black-sand-brewery");
    expect(merchantKey("Grab* A-9MXOR7UGWAE9AV, 6281384748739, IDN")).toBe("grab");
    expect(merchantKey("PT Unbranded Hospitality")).toBe("unbranded-hospitality");
    expect(merchantKey(null)).toBe("");
  });
});

describe("domainCandidates", () => {
  it("propose les mots collés puis à tirets, en .com", () => {
    expect(domainCandidates("Black Sand Brewery")).toEqual([
      "blacksandbrewery.com",
      "black-sand-brewery.com",
    ]);
    // Un seul mot : les deux formes coïncident, une seule proposition.
    expect(domainCandidates("Grab")).toEqual(["grab.com"]);
    expect(domainCandidates(null)).toEqual([]);
  });
});
