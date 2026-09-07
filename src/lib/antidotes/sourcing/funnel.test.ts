import { describe, expect, it } from "vitest";

import { buildFunnel, rejectedTotal, rejectionBreakdown } from "./funnel";

describe("buildFunnel", () => {
  it("calcule le taux de passage marche par marche", () => {
    const funnel = buildFunnel({
      sourced: 200,
      qualified: 50,
      to_review: 10,
      contact_found: 30,
      email_valid: 12,
    });
    expect(funnel.map((step) => step.value)).toEqual([200, 60, 30, 12]);
    expect(funnel[0]?.rate).toBeNull();
    expect(funnel[1]?.rate).toBeCloseTo(0.3);
    expect(funnel[2]?.rate).toBeCloseTo(0.5);
    expect(funnel[3]?.rate).toBeCloseTo(0.4);
  });

  it("ne divise pas par zéro et tolère un passage vide", () => {
    const funnel = buildFunnel(null);
    expect(funnel.map((step) => step.value)).toEqual([0, 0, 0, 0]);
    expect(funnel.every((step) => step.rate === null)).toBe(true);
  });
});

describe("rejets", () => {
  it("additionne et classe les raisons", () => {
    const stats = { rejected: { "sans publicité active": 90, "note trop basse": 12, "pays hors cible": 40 } };
    expect(rejectedTotal(stats)).toBe(142);
    expect(rejectionBreakdown(stats).map((entry) => entry.reason)).toEqual([
      "sans publicité active",
      "pays hors cible",
      "note trop basse",
    ]);
  });
});
