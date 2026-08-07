import { describe, expect, it } from "vitest";

import {
  formatDayFr,
  formatDelta,
  formatMetric,
  maskDayFr,
  NOT_AVAILABLE,
  parseDayFr,
} from "./format";

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

describe("formatDayFr", () => {
  it("retourne le jour au format français", () => {
    expect(formatDayFr("2026-08-05")).toBe("05/08/2026");
  });

  it("rend une chaîne vide sur une entrée absente ou mal formée", () => {
    expect(formatDayFr(null)).toBe("");
    expect(formatDayFr("")).toBe("");
    expect(formatDayFr("05/08/2026")).toBe("");
  });
});

describe("parseDayFr", () => {
  it("relit le format français vers l'ISO", () => {
    expect(parseDayFr("05/08/2026")).toBe("2026-08-05");
    expect(parseDayFr("  01/01/2026  ")).toBe("2026-01-01");
  });

  it("refuse une date qui n'existe pas au calendrier", () => {
    // La bonne forme ne fait pas une date : février n'a pas de 31.
    expect(parseDayFr("31/02/2026")).toBeNull();
    expect(parseDayFr("00/08/2026")).toBeNull();
    expect(parseDayFr("05/13/2026")).toBeNull();
  });

  it("refuse ce qui n'a pas la forme attendue", () => {
    expect(parseDayFr("")).toBeNull();
    expect(parseDayFr("5/8/2026")).toBeNull();
    expect(parseDayFr("2026-08-05")).toBeNull();
  });

  it("fait l'aller-retour avec formatDayFr", () => {
    // 2028 est bissextile, 2026 ne l'est pas : le 29 février n'existe que dans
    // le premier, et le contrôle calendaire l'a montré en refusant le second.
    expect(parseDayFr(formatDayFr("2028-02-29"))).toBe("2028-02-29");
    expect(parseDayFr("29/02/2026")).toBeNull();
  });
});

describe("maskDayFr", () => {
  it("pose les barres obliques au fil de la frappe", () => {
    expect(maskDayFr("0")).toBe("0");
    expect(maskDayFr("05")).toBe("05");
    expect(maskDayFr("058")).toBe("05/8");
    expect(maskDayFr("0508")).toBe("05/08");
    expect(maskDayFr("05082026")).toBe("05/08/2026");
  });

  it("écarte ce qui n'est pas un chiffre et plafonne à huit", () => {
    expect(maskDayFr("05/08/2026")).toBe("05/08/2026");
    expect(maskDayFr("05a08b2026999")).toBe("05/08/2026");
  });
});
