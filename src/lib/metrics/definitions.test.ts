import { describe, expect, it } from "vitest";

import { computeDelta, groupAndSum, sumRawMetrics } from "./aggregate";
import { computeMetric } from "./definitions";
import { EMPTY_RAW_METRICS as EMPTY, type RawMetrics } from "./types";

/**
 * Fixtures issues du rapport Looker Studio réel de Bondet, juin 2026.
 * Ces valeurs font foi : si un test casse, c'est notre calcul qui a divergé du
 * rapport que le client reçoit aujourd'hui, pas l'inverse.
 */
const JUNE_2026_TOTAL: RawMetrics = {
  spend: 2572.22,
  impressions: 557255,
  reach: 179_764,
  clicks: 11038,
  // Non lu directement sur la capture : déduit du CTR lien affiché (0,73 %).
  linkClicks: 4068,
  purchases: 8,
  purchaseValue: 837.9,
  landingPageViews: 625,
  addToCart: 47,
  initiatedCheckout: 34,
  pageViews: 0,
  jobsPageViews: 0,
  comments: 13,
  saves: 41,
  shares: 96,
  likes: 0,
  videoViews: 0,
  videoCompletions: 0,
};

describe("dictionnaire des métriques — totaux de juin 2026", () => {
  it("CPA = dépense / achats", () => {
    expect(computeMetric("cpa", JUNE_2026_TOTAL, "legacy")).toBeCloseTo(321.53, 2);
  });

  it("CPM = dépense / impressions × 1000", () => {
    expect(computeMetric("cpm", JUNE_2026_TOTAL, "legacy")).toBeCloseTo(4.62, 2);
  });

  it("ROAS = valeur des conversions / dépense", () => {
    expect(computeMetric("roas", JUNE_2026_TOTAL, "legacy")).toBeCloseTo(0.33, 2);
  });

  it("CPL = dépense / landing page views, et non un coût par lead", () => {
    expect(computeMetric("cpl", JUNE_2026_TOTAL, "legacy")).toBeCloseTo(4.12, 2);
  });

  it("CPC = dépense / tous les clics", () => {
    expect(computeMetric("cpc", JUNE_2026_TOTAL, "legacy")).toBeCloseTo(0.23, 2);
  });

  it("CTR en mode legacy utilise les clics sur lien", () => {
    expect(computeMetric("ctr", JUNE_2026_TOTAL, "legacy")).toBeCloseTo(0.0073, 4);
  });

  it("CTR en mode cohérent utilise tous les clics et se réconcilie avec le CPC", () => {
    const ctr = computeMetric("ctr", JUNE_2026_TOTAL, "consistent");
    expect(ctr).toBeCloseTo(0.0198, 4);
    // CTR × impressions doit redonner exactement le nombre de clics affiché.
    expect(ctr! * JUNE_2026_TOTAL.impressions).toBeCloseTo(JUNE_2026_TOTAL.clicks, 6);
  });

  it("la colonne « View » du tableau est bien les impressions", () => {
    expect(computeMetric("impressions", JUNE_2026_TOTAL, "legacy")).toBe(557255);
  });
});

describe("métriques non définies", () => {
  const noConversions: RawMetrics = {
    ...JUNE_2026_TOTAL,
    purchases: 0,
    purchaseValue: 0,
    landingPageViews: 0,
  };

  it("renvoie null plutôt que 0 quand le dénominateur est nul", () => {
    // Un CPA affiché à 0 € se lirait comme une acquisition gratuite. C'est
    // l'écart assumé avec Looker Studio, qui affiche 0 dans ce cas.
    expect(computeMetric("cpa", noConversions, "legacy")).toBeNull();
    expect(computeMetric("cpl", noConversions, "legacy")).toBeNull();
  });

  it("ne renvoie jamais Infinity ni NaN", () => {
    const empty: RawMetrics = sumRawMetrics([]);
    for (const id of ["cpa", "cpm", "roas", "ctr", "cpc", "cpl"] as const) {
      const value = computeMetric(id, empty, "legacy");
      expect(value === null || Number.isFinite(value)).toBe(true);
    }
  });
});

describe("agrégation multi-périodes", () => {
  // Deux jours au CPM très différent : la moyenne des CPM quotidiens (6,67)
  // diverge nettement du CPM réel de la période (4,00).
  const dayOne: Partial<RawMetrics> = { spend: 100, impressions: 10_000 };
  const dayTwo: Partial<RawMetrics> = { spend: 300, impressions: 90_000 };

  it("recalcule les ratios depuis la somme, jamais en moyennant des ratios", () => {
    const total = sumRawMetrics([dayOne, dayTwo]);
    const cpm = computeMetric("cpm", total, "legacy");

    expect(cpm).toBeCloseTo(4.0, 6);

    const averageOfDailyCpms =
      ((100 / 10_000) * 1000 + (300 / 90_000) * 1000) / 2;
    expect(averageOfDailyCpms).toBeCloseTo(6.67, 2);
    expect(cpm).not.toBeCloseTo(averageOfDailyCpms, 1);
  });

  it("somme uniquement des grandeurs additives", () => {
    const total = sumRawMetrics([dayOne, dayTwo]);
    expect(total.spend).toBe(400);
    expect(total.impressions).toBe(100_000);
    expect(total.purchases).toBe(0);
  });

  it("regroupe par clé arbitraire", () => {
    const rows = [
      { campaign: "A", spend: 10, impressions: 100 },
      { campaign: "A", spend: 15, impressions: 200 },
      { campaign: "B", spend: 5, impressions: 50 },
    ];
    const grouped = groupAndSum(rows, (row) => row.campaign);

    expect(grouped.get("A")?.spend).toBe(25);
    expect(grouped.get("A")?.impressions).toBe(300);
    expect(grouped.get("B")?.spend).toBe(5);
  });
});

describe("variations et sens métier", () => {
  it("une hausse des impressions est positive", () => {
    const delta = computeDelta("impressions", 557255, 237500);
    expect(delta.ratio).toBeCloseTo(1.346, 3);
    expect(delta.sentiment).toBe("positive");
  });

  it("une baisse du CPM est positive malgré son signe négatif", () => {
    const delta = computeDelta("cpm", 4.62, 5.21);
    expect(delta.ratio).toBeLessThan(0);
    expect(delta.sentiment).toBe("positive");
  });

  it("une hausse du CPA est négative", () => {
    expect(computeDelta("cpa", 400, 320).sentiment).toBe("negative");
  });

  it("renvoie neutral quand la période de comparaison est vide", () => {
    expect(computeDelta("roas", 0.33, null)).toEqual({
      ratio: null,
      sentiment: "neutral",
    });
    expect(computeDelta("roas", 0.33, 0).ratio).toBeNull();
  });
});

/**
 * L'ancre LinkedIn : les chiffres relevés sur la page ANMF en août 2026,
 * par le connecteur d'un côté et par les statistiques natives de LinkedIn
 * de l'autre. Si un de ces tests casse, c'est notre définition qui a divergé
 * de celle du réseau — pas l'inverse.
 */
describe("le taux d'engagement de LinkedIn", () => {
  const ANMF_AOUT_2026: RawMetrics = {
    ...EMPTY,
    impressions: 36_903,
    reach: 22_666,
    clicks: 1_671,
    linkClicks: 1_671,
    likes: 809,
    comments: 5,
    shares: 0,
    pageViews: 316,
    jobsPageViews: 42,
  };

  it("compte les clics parmi les engagements — c'est la règle de LinkedIn", () => {
    expect(computeMetric("engagements", ANMF_AOUT_2026)).toBe(2_485);
  });

  it("retrouve le 6,8 % affiché par LinkedIn lui-même", () => {
    /* LinkedIn annonce 6,8 % sur le 2 → 31 août ; nous couvrons un jour de
       plus, d'où l'écart au centième. Le rapport aux **impressions** est ce
       qui compte : rapporté à la portée, on lirait 11 %. */
    expect(computeMetric("engagementRateWithClicks", ANMF_AOUT_2026)).toBeCloseTo(
      0.0673,
      4,
    );
  });

  it("distingue les vues de la page de celles des offres d'emploi", () => {
    expect(computeMetric("pageViews", ANMF_AOUT_2026)).toBe(316);
    expect(computeMetric("jobsPageViews", ANMF_AOUT_2026)).toBe(42);
  });
});
