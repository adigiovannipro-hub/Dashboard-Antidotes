import { describe, expect, it } from "vitest";

import { buildExpenseBreakdown, type BreakdownRow } from "./breakdown";
import type { FinanceCategory, FinanceCategoryRule } from "./types";

const category = (over: Partial<FinanceCategory>): FinanceCategory => ({
  id: "00000000-0000-4000-8000-000000000001",
  org_id: "org",
  name: "Restauration",
  slug: "restauration",
  position: 0,
  created_at: "2026-08-01T00:00:00Z",
  ...over,
});

const row = (over: Partial<BreakdownRow>): BreakdownRow => ({
  billing_amount_cents: 1000,
  billing_currency: "EUR",
  category_id: null,
  category_raw: null,
  merchant: null,
  merchant_raw: null,
  ...over,
});

const RESTO = category({ id: "00000000-0000-4000-8000-00000000000a", name: "Restauration", slug: "restauration" });
const LOGICIELS = category({ id: "00000000-0000-4000-8000-00000000000b", name: "Logiciels & abonnements", slug: "logiciels" });
const CATEGORIES = [RESTO, LOGICIELS];

describe("buildExpenseBreakdown", () => {
  it("additionne par catégorie et trie de la plus grosse à la plus petite", () => {
    const breakdown = buildExpenseBreakdown(
      [
        row({ category_id: RESTO.id, billing_amount_cents: 300 }),
        row({ category_id: LOGICIELS.id, billing_amount_cents: 600 }),
        row({ category_id: RESTO.id, billing_amount_cents: 200 }),
      ],
      [],
      CATEGORIES,
    );

    expect(breakdown.total_cents).toBe(1100);
    expect(breakdown.entries).toEqual([
      { label: "Logiciels & abonnements", cents: 600, share: 600 / 1100 },
      { label: "Restauration", cents: 500, share: 500 / 1100 },
    ]);
  });

  it("le rangement manuel prime sur la règle du marchand", () => {
    const rule: FinanceCategoryRule = {
      id: "r1",
      org_id: "org",
      matcher: "grab",
      category_id: LOGICIELS.id,
      created_at: "2026-08-01T00:00:00Z",
    };
    const breakdown = buildExpenseBreakdown(
      [row({ category_id: RESTO.id, merchant: "Grab" })],
      [rule],
      CATEGORIES,
    );
    expect(breakdown.entries[0]?.label).toBe("Restauration");
  });

  it("range par la règle du marchand ce qui n'a pas de rangement manuel", () => {
    const rule: FinanceCategoryRule = {
      id: "r1",
      org_id: "org",
      matcher: "alan",
      category_id: LOGICIELS.id,
      created_at: "2026-08-01T00:00:00Z",
    };
    const breakdown = buildExpenseBreakdown(
      [row({ merchant: "ALAN SA" })],
      [rule],
      CATEGORIES,
    );
    expect(breakdown.entries[0]?.label).toBe("Logiciels & abonnements");
  });

  it("avoue « Sans catégorie » plutôt que d'inventer un rangement", () => {
    const breakdown = buildExpenseBreakdown(
      [row({ merchant: "Mystère SARL" })],
      [],
      CATEGORIES,
    );
    expect(breakdown.entries[0]?.label).toBe("Sans catégorie");
  });

  it("ignore les débits non EUR — jamais de conversion, comme la carte Dépensé", () => {
    const breakdown = buildExpenseBreakdown(
      [
        row({ category_id: RESTO.id, billing_amount_cents: 400 }),
        row({ category_id: RESTO.id, billing_currency: "USD", billing_amount_cents: 900 }),
      ],
      [],
      CATEGORIES,
    );
    expect(breakdown.total_cents).toBe(400);
  });

  it("rend un total nul et aucune part sur une période vide", () => {
    expect(buildExpenseBreakdown([], [], CATEGORIES)).toEqual({
      total_cents: 0,
      entries: [],
    });
  });
});
