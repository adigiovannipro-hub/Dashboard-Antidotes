import { describe, expect, it } from "vitest";

import { formatDelta, formatMetric, NOT_AVAILABLE } from "./format";

/**
 * `Intl` en fr-FR utilise l'espace fine insécable (U+202F) comme séparateur de
 * milliers et avant le %. On normalise pour que les assertions restent lisibles.
 */
function normalize(value: string): string {
  return value.replace(/[  ]/g, " ");
}

describe("formatage français", () => {
  it("sépare les milliers", () => {
    expect(normalize(formatMetric("impressions", 557255))).toBe("557 255");
    expect(normalize(formatMetric("clicks", 11038))).toBe("11 038");
  });

  it("utilise la virgule décimale et le symbole euro", () => {
    expect(normalize(formatMetric("cpm", 4.616))).toBe("4,62 €");
    expect(normalize(formatMetric("spend", 2572.22))).toBe("2 572,22 €");
    expect(normalize(formatMetric("cpa", 321.5275))).toBe("321,53 €");
  });

  it("formate le CTR en pourcentage avec espace avant le signe", () => {
    expect(normalize(formatMetric("ctr", 0.0073))).toBe("0,73 %");
  });

  it("formate le ROAS en ratio sans unité", () => {
    expect(normalize(formatMetric("roas", 0.3257))).toBe("0,33");
  });

  it("affiche un tiret pour une métrique non définie", () => {
    expect(formatMetric("cpa", null)).toBe(NOT_AVAILABLE);
  });
});

describe("formatage des variations", () => {
  it("affiche le signe explicitement", () => {
    expect(normalize(formatDelta(1.346))).toBe("+134,6 %");
    expect(normalize(formatDelta(-0.114))).toBe("-11,4 %");
  });

  it("affiche N/A sans période de comparaison", () => {
    expect(formatDelta(null)).toBe("N/A");
  });
});
