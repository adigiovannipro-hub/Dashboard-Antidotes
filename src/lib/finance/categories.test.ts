import { describe, expect, it } from "vitest";

import { resolveCategory, type CategorySource } from "./categories";
import type { FinanceCategory, FinanceCategoryRule } from "./types";

function category(id: string, name: string, slug?: string): FinanceCategory {
  return {
    id,
    org_id: "org",
    name,
    slug: slug ?? name.toLowerCase(),
    position: 0,
    created_at: "2026-08-05T00:00:00.000Z",
  };
}

function rule(matcher: string, categoryId: string): FinanceCategoryRule {
  return {
    id: `rule-${matcher}`,
    org_id: "org",
    matcher,
    category_id: categoryId,
    created_at: "2026-08-05T00:00:00.000Z",
  };
}

function source(overrides: Partial<CategorySource> = {}): CategorySource {
  return { category_raw: null, merchant: null, ...overrides };
}

const CATEGORIES = [
  category("cat-transport", "Déplacements", "transports"),
  category("cat-resto", "Restauration", "restauration"),
  category("cat-logiciels", "Logiciels & abonnements", "logiciels"),
];

describe("resolveCategory", () => {
  it("applique une règle de correspondance sur le libellé brut, insensible à la casse", () => {
    const rules = [rule("Transports", "cat-transport")];
    expect(
      resolveCategory(source({ category_raw: "TRANSPORTS" }), rules, CATEGORIES)?.id,
    ).toBe("cat-transport");
    expect(
      resolveCategory(source({ category_raw: "  transports " }), rules, CATEGORIES)?.id,
    ).toBe("cat-transport");
  });

  it("applique une règle dont le motif apparaît dans le nom du marchand", () => {
    // Le libellé carte n'est jamais propre : « SQ *LE PETIT CAFE » doit
    // matcher une règle « petit cafe » sans exiger l'égalité exacte.
    const rules = [rule("petit cafe", "cat-resto")];
    expect(
      resolveCategory(source({ merchant: "SQ *LE PETIT CAFE" }), rules, CATEGORIES)?.id,
    ).toBe("cat-resto");
  });

  it("retombe sur l'égalité de nom quand aucune règle ne couvre", () => {
    expect(
      resolveCategory(source({ category_raw: "Restauration" }), [], CATEGORIES)?.id,
    ).toBe("cat-resto");
  });

  it("fait passer la règle avant l'égalité de nom", () => {
    // Une règle envoie « Restauration » ailleurs : la volonté explicite gagne.
    const rules = [rule("Restauration", "cat-transport")];
    expect(
      resolveCategory(source({ category_raw: "Restauration" }), rules, CATEGORIES)?.id,
    ).toBe("cat-transport");
  });

  it("range un marchand connu par les correspondances embarquées", () => {
    // Grab en restauration : consigne explicite, c'est l'usage réel du compte.
    expect(
      resolveCategory(source({ merchant: "Grab" }), [], CATEGORIES)?.id,
    ).toBe("cat-resto");
    expect(
      resolveCategory(source({ merchant: "Google Play" }), [], CATEGORIES)?.id,
    ).toBe("cat-logiciels");
  });

  it("laisse une règle contredire une correspondance embarquée", () => {
    const rules = [rule("grab", "cat-transport")];
    expect(
      resolveCategory(source({ merchant: "Grab" }), rules, CATEGORIES)?.id,
    ).toBe("cat-transport");
  });

  it("rend null plutôt que d'inventer un rangement", () => {
    expect(
      resolveCategory(source({ category_raw: "Voyage" }), [], CATEGORIES),
    ).toBeNull();
    expect(resolveCategory(source(), [], CATEGORIES)).toBeNull();
    expect(
      resolveCategory(source({ merchant: "Marchand Inconnu SARL" }), [], CATEGORIES),
    ).toBeNull();
  });

  it("survit à une règle qui pointe une catégorie disparue", () => {
    const rules = [rule("Transports", "cat-fantome")];
    expect(
      resolveCategory(source({ category_raw: "Transports" }), rules, CATEGORIES),
    ).toBeNull();
  });
});
