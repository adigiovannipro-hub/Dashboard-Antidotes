import { describe, expect, it } from "vitest";

import {
  DEFAULT_SCORING_WEIGHTS,
  computeScore,
  computeScoreBreakdown,
  isSizeInRange,
  resolveScoringWeights,
  type ScoringContext,
} from "./scoring";

const prospect = (
  overrides: Partial<ScoringContext["prospect"]> = {},
): ScoringContext["prospect"] => ({
  ads_active: false,
  sector: null,
  size_signal: {},
  ...overrides,
});

const primary = (channel: string) => ({ is_primary: true, outreach_channel: channel });

describe("resolveScoringWeights", () => {
  it("rend les défauts sans campagne", () => {
    expect(resolveScoringWeights(null)).toEqual(DEFAULT_SCORING_WEIGHTS);
    expect(resolveScoringWeights({})).toEqual(DEFAULT_SCORING_WEIGHTS);
  });

  it("laisse la campagne surcharger un poids sans toucher aux autres", () => {
    expect(resolveScoringWeights({ scoring: { ads_active: 60 } })).toEqual({
      ...DEFAULT_SCORING_WEIGHTS,
      ads_active: 60,
    });
  });

  it("ignore une valeur qui n'est pas un nombre", () => {
    const weights = resolveScoringWeights({
      scoring: { same_sector: Number.NaN, size_in_range: "beaucoup" as never },
    });
    expect(weights).toEqual(DEFAULT_SCORING_WEIGHTS);
  });
});

describe("isSizeInRange", () => {
  it("compare sur le premier signal commun, dans la tolérance", () => {
    expect(isSizeInRange({ reviews_count: 130 }, { reviews_count: 100 }, 0.4)).toBe(true);
    expect(isSizeInRange({ reviews_count: 141 }, { reviews_count: 100 }, 0.4)).toBe(false);
    expect(isSizeInRange({ reviews_count: 59 }, { reviews_count: 100 }, 0.4)).toBe(false);
  });

  it("ne sait pas sans signal commun, et ne sait pas sans référence", () => {
    expect(isSizeInRange({ traffic: 5000 }, { reviews_count: 100 }, 0.4)).toBe(false);
    expect(isSizeInRange({ reviews_count: 100 }, null, 0.4)).toBe(false);
    expect(isSizeInRange({ reviews_count: 100 }, { reviews_count: 0 }, 0.4)).toBe(false);
  });
});

describe("computeScore", () => {
  it("vaut zéro pour un prospect nu", () => {
    expect(computeScore({ prospect: prospect(), contacts: [] })).toBe(0);
  });

  it("additionne les quatre critères avec les poids par défaut", () => {
    const score = computeScore({
      prospect: prospect({
        ads_active: true,
        sector: "Opticien",
        size_signal: { reviews_count: 120 },
      }),
      contacts: [primary("email")],
      campaign: {
        filters: {},
        reference_sector: "opticien",
        reference_size: { reviews_count: 100 },
      },
    });
    expect(score).toBe(100);
  });

  it("compte la piste LinkedIn comme un contact joignable", () => {
    const withLinkedIn = computeScore({
      prospect: prospect(),
      contacts: [primary("linkedin")],
    });
    const withNothing = computeScore({
      prospect: prospect(),
      contacts: [primary("none")],
    });
    expect(withLinkedIn).toBe(20);
    expect(withNothing).toBe(0);
  });

  it("ne regarde que le contact principal", () => {
    const score = computeScore({
      prospect: prospect(),
      contacts: [
        { is_primary: false, outreach_channel: "email" },
        { is_primary: true, outreach_channel: "none" },
      ],
    });
    expect(score).toBe(0);
  });

  it("applique les poids surchargés par la campagne", () => {
    const breakdown = computeScoreBreakdown({
      prospect: prospect({ ads_active: true, sector: "Salle d'escalade" }),
      contacts: [primary("email")],
      campaign: {
        filters: { scoring: { ads_active: 10, reachable_contact: 50, same_sector: 25 } },
        reference_sector: "Salle d'escalade",
      },
    });
    expect(breakdown).toEqual({
      ads_active: 10,
      size_in_range: 0,
      reachable_contact: 50,
      same_sector: 25,
      total: 85,
    });
  });

  it("suit la tolérance de taille de la campagne", () => {
    const context = (tolerance: number): ScoringContext => ({
      prospect: prospect({ size_signal: { employees: 25 } }),
      contacts: [],
      campaign: {
        filters: { size_tolerance: tolerance },
        reference_size: { employees: 20 },
      },
    });
    expect(computeScore(context(0.1))).toBe(0);
    expect(computeScore(context(0.4))).toBe(30);
  });

  it("compare les secteurs sans casse ni accents", () => {
    const score = computeScore({
      prospect: prospect({ sector: "Décoration d'intérieur" }),
      contacts: [],
      campaign: { reference_sector: "decoration d'INTERIEUR" },
    });
    expect(score).toBe(10);
  });

  it("borne le total à 100 quand les poids surchargés dépassent", () => {
    const score = computeScore({
      prospect: prospect({ ads_active: true }),
      contacts: [primary("email")],
      campaign: { filters: { scoring: { ads_active: 90, reachable_contact: 90 } } },
    });
    expect(score).toBe(100);
  });
});
