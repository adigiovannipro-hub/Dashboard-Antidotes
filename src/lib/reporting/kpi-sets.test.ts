import { describe, expect, it } from "vitest";

import { METRIC_DEFINITIONS } from "@/lib/metrics/definitions";
import { detailTitle, hasPersona, HERO_METRIC, isUnmeasuredZero, KPI_SETS } from "./kpi-sets";
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

  it("compte les interactions en tête de Facebook, et porte la grille d'Instagram", () => {
    // Fin 2025, Meta a retiré impressions et portée des publications de
    // Page : sans dénominateur, le taux d'engagement afficherait « — » à
    // perpétuité — les interactions restent le héros. Les tuiles, elles,
    // suivent la grille d'Instagram à la demande du client ; ce que Meta ne
    // mesure pas s'écrit « — » (isUnmeasuredZero), jamais un zéro.
    expect(HERO_METRIC.facebook).toBe("interactions");
    expect(KPI_SETS.facebook).toEqual(KPI_SETS.instagram);
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

describe("isUnmeasuredZero", () => {
  it("écrit « — » à la place d'un zéro que Facebook ne mesure pas", () => {
    expect(isUnmeasuredZero("facebook", "impressions", 0)).toBe(true);
    expect(isUnmeasuredZero("facebook", "saves", 0)).toBe(true);
  });

  it("laisse passer une valeur mesurée, et les zéros des autres réseaux", () => {
    // Le jour où Meta rend les impressions de Page, la tuile vit sans code.
    expect(isUnmeasuredZero("facebook", "impressions", 1200)).toBe(false);
    expect(isUnmeasuredZero("facebook", "likes", 0)).toBe(false);
    expect(isUnmeasuredZero("instagram", "impressions", 0)).toBe(false);
  });
});
