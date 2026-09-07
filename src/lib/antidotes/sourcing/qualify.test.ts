import { describe, expect, it } from "vitest";

import { resolveFilters } from "./config";
import { qualifyCandidate, sizeRatio } from "./qualify";

const filters = (overrides: Parameters<typeof resolveFilters>[0] = {}) =>
  resolveFilters({ reference_size: { reviews_count: 100 }, ...overrides });

const candidate = (overrides: Partial<Parameters<typeof qualifyCandidate>[0]> = {}) => ({
  country: "FR",
  rating: 4.5,
  size_signal: { reviews_count: 110 },
  ads_active: true,
  ...overrides,
});

describe("qualifyCandidate", () => {
  it("qualifie une société qui passe les quatre critères", () => {
    const verdict = qualifyCandidate(candidate(), filters());
    expect(verdict.outcome).toBe("qualified");
    expect(verdict.reasons).toEqual([]);
    expect(verdict.size_ratio).toBeCloseTo(1.1);
  });

  it("rejette hors pays, note basse, taille hors tolérance, sans pubs — et cumule les raisons", () => {
    const verdict = qualifyCandidate(
      candidate({ country: "DE", rating: 3.2, size_signal: { reviews_count: 300 }, ads_active: false }),
      filters(),
    );
    expect(verdict.outcome).toBe("rejected");
    expect(verdict.reasons).toEqual([
      "pays hors cible",
      "note trop basse",
      "taille hors tolérance",
      "sans publicité active",
    ]);
  });

  it("envoie en revue quand les publicités n'ont pas pu être vérifiées", () => {
    const verdict = qualifyCandidate(candidate({ ads_active: null }), filters());
    expect(verdict.outcome).toBe("to_review");
    expect(verdict.reasons).toEqual(["publicités non vérifiées"]);
  });

  it("ne rejette pas ce qu'il ne sait pas : pays, note et taille inconnus passent", () => {
    const verdict = qualifyCandidate(
      candidate({ country: null, rating: null, size_signal: {} }),
      filters(),
    );
    expect(verdict.outcome).toBe("qualified");
    expect(verdict.size_ratio).toBeNull();
  });

  it("obéit aux réglages : pubs en bonus, note désactivée, tolérance large", () => {
    const verdict = qualifyCandidate(
      candidate({ rating: 2, ads_active: false, size_signal: { reviews_count: 180 } }),
      filters({ require_ads: "bonus", min_rating: 0, size_tolerance: 1 }),
    );
    expect(verdict.outcome).toBe("qualified");
  });

  it("un rejet l'emporte sur une revue", () => {
    const verdict = qualifyCandidate(candidate({ country: "BE", ads_active: null }), filters());
    expect(verdict.outcome).toBe("rejected");
    expect(verdict.reasons).toEqual(["pays hors cible"]);
  });
});

describe("sizeRatio", () => {
  it("compare sur le premier signal commun", () => {
    expect(sizeRatio({ employees: 30, traffic: 10 }, { traffic: 20 })).toBe(0.5);
    expect(sizeRatio({ employees: 30 }, { traffic: 20 })).toBeNull();
    expect(sizeRatio({ reviews_count: 10 }, null)).toBeNull();
  });
});
