import { describe, expect, it } from "vitest";

import { METRIC_DEFINITIONS } from "@/lib/metrics/definitions";
import { detailTitle, hasPersona, HERO_METRIC, KPI_SETS } from "./kpi-sets";
import type { SocialReportingNetwork } from "./networks";

// Les onglets sociaux seulement : le Site Web a ses propres mesures, hors du
// catalogue publicitaire — c'est `web/data.ts` qui les porte.
const NETWORKS = Object.keys(KPI_SETS) as SocialReportingNetwork[];

describe("KPI_SETS", () => {
  it("couvre tous les réseaux du Reporting", () => {
    for (const network of NETWORKS) {
      expect(KPI_SETS[network].length).toBeGreaterThan(0);
    }
  });

  it("ne référence que des mesures définies", () => {
    for (const network of NETWORKS) {
      for (const metric of KPI_SETS[network]) {
        expect(METRIC_DEFINITIONS[metric]).toBeDefined();
      }
    }
  });

  it("ne répète pas le chiffre héros dans les tuiles", () => {
    // L'afficher deux fois affaiblirait les deux.
    for (const network of NETWORKS) {
      expect(KPI_SETS[network]).not.toContain(HERO_METRIC[network]);
    }
  });

  it("ne met aucune mesure monétaire sur l'organique", () => {
    const monetary = ["spend", "earn", "cpa", "cpm", "cpc", "cpl"];
    for (const network of ["instagram", "facebook"] as const) {
      for (const metric of KPI_SETS[network]) {
        expect(monetary).not.toContain(metric);
      }
    }
  });

  it("garde le ROAS en tête du payant", () => {
    expect(HERO_METRIC["meta-ads"]).toBe("roas");
  });

  it("met le taux d'engagement en tête de l'organique, sans répétition", () => {
    // La répétition ne dit rien d'un feed ; l'engagement dit tout.
    expect(HERO_METRIC.instagram).toBe("engagementRate");
    expect(KPI_SETS.instagram).not.toContain("frequency");
    expect(KPI_SETS.facebook).not.toContain("frequency");
    expect(KPI_SETS.instagram).toContain("videoViews");
    expect(KPI_SETS.instagram).toContain("likes");
  });

  it("compte les interactions en tête de Facebook, sans impressions", () => {
    // Fin 2025, Meta a retiré impressions et portée des publications de
    // Page : sans dénominateur, le taux d'engagement afficherait « — » à
    // perpétuité, et une tuile Impressions resterait à zéro pour toujours.
    expect(HERO_METRIC.facebook).toBe("interactions");
    expect(KPI_SETS.facebook).not.toContain("impressions");
    expect(KPI_SETS.facebook).toContain("videoViews");
  });
});

describe("hasPersona", () => {
  it("réserve les découpages d'audience au payant", () => {
    expect(hasPersona("meta-ads")).toBe(true);
    expect(hasPersona("instagram")).toBe(false);
    expect(hasPersona("facebook")).toBe(false);
  });
});

describe("detailTitle", () => {
  it("nomme le détail selon ce qu'il liste", () => {
    expect(detailTitle("meta-ads")).toBe("Performance par ad set");
    expect(detailTitle("instagram")).toBe("Performance par publication");
  });
});
