import { describe, expect, it } from "vitest";

import { resolveCategory } from "./categories";
import type { FinanceCategory, FinanceCategoryRule } from "./types";

function category(id: string, name: string): FinanceCategory {
  return {
    id,
    org_id: "org",
    name,
    slug: name.toLowerCase(),
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

const CATEGORIES = [
  category("cat-transport", "Déplacements"),
  category("cat-resto", "Restauration"),
];

describe("resolveCategory", () => {
  it("applique une règle de correspondance, insensible à la casse", () => {
    const rules = [rule("Transports", "cat-transport")];
    expect(resolveCategory("TRANSPORTS", rules, CATEGORIES)?.id).toBe(
      "cat-transport",
    );
    expect(resolveCategory("  transports ", rules, CATEGORIES)?.id).toBe(
      "cat-transport",
    );
  });

  it("retombe sur l'égalité de nom quand aucune règle ne couvre", () => {
    expect(resolveCategory("Restauration", [], CATEGORIES)?.id).toBe("cat-resto");
  });

  it("fait passer la règle avant l'égalité de nom", () => {
    // Une règle envoie « Restauration » ailleurs : la volonté explicite gagne.
    const rules = [rule("Restauration", "cat-transport")];
    expect(resolveCategory("Restauration", rules, CATEGORIES)?.id).toBe(
      "cat-transport",
    );
  });

  it("rend null plutôt que d'inventer un rangement", () => {
    expect(resolveCategory("Voyage", [], CATEGORIES)).toBeNull();
    expect(resolveCategory(null, [], CATEGORIES)).toBeNull();
    expect(resolveCategory("   ", [], CATEGORIES)).toBeNull();
  });

  it("survit à une règle qui pointe une catégorie disparue", () => {
    const rules = [rule("Transports", "cat-fantome")];
    expect(resolveCategory("Transports", rules, CATEGORIES)).toBeNull();
  });
});
