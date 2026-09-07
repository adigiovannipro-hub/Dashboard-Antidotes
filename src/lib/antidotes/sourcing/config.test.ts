import { describe, expect, it } from "vitest";

import {
  DEFAULT_DISCOVERY_SOURCES,
  DEFAULT_ENRICHMENT_WATERFALL,
  DEFAULT_JOB_KEYWORDS,
  campaignReadiness,
  resolveCampaignConfig,
  resolveFilters,
  resolveTargeting,
} from "./config";

const campaign = (overrides: Partial<Parameters<typeof resolveCampaignConfig>[0]> = {}) => ({
  engine: "maps" as const,
  reference_client: "Bondet",
  source_params: {},
  filters: {},
  targeting: {},
  ...overrides,
});

describe("resolveCampaignConfig", () => {
  it("complète une campagne vide avec les défauts du cahier des charges", () => {
    const config = resolveCampaignConfig(campaign());
    expect(config.filters).toMatchObject({
      size_tolerance: 0.4,
      require_ads: true,
      countries: ["FR"],
      min_rating: 4,
    });
    expect(config.targeting.marketing_threshold).toBe(20);
    expect(config.targeting.verification_ttl_days).toBe(180);
    expect(config.targeting.job_keywords).toEqual(DEFAULT_JOB_KEYWORDS);
    expect(config.targeting.discovery_sources).toEqual(DEFAULT_DISCOVERY_SOURCES);
    expect(config.targeting.enrichment_waterfall).toEqual(DEFAULT_ENRICHMENT_WATERFALL);
    expect(config.source.radius_km).toBe(10);
  });

  it("garde ce que la campagne règle, nettoyé", () => {
    const config = resolveCampaignConfig(
      campaign({
        source_params: { keywords: [" opticien ", "", "lunetier"], cities: ["Lyon"], radius_km: 25 },
        filters: { countries: ["fr", "be"], min_rating: 3.5, require_ads: "bonus" },
        targeting: { job_keywords: ["CEO"], marketing_threshold: 50 },
      }),
    );
    expect(config.source.keywords).toEqual(["opticien", "lunetier"]);
    expect(config.filters.countries).toEqual(["FR", "BE"]);
    expect(config.filters.min_rating).toBe(3.5);
    expect(config.filters.require_ads).toBe("bonus");
    expect(config.targeting.job_keywords).toEqual(["CEO"]);
    expect(config.targeting.marketing_threshold).toBe(50);
  });
});

describe("resolveTargeting", () => {
  it("respecte l'ordre de la campagne et complète ce qu'elle ne connaît pas", () => {
    const targeting = resolveTargeting({
      enrichment_waterfall: [
        { provider: "hunter", enabled: true },
        { provider: "dropcontact", enabled: false },
      ],
      discovery_sources: [{ source: "website", enabled: true }],
    });
    expect(targeting.enrichment_waterfall).toEqual([
      { provider: "hunter", enabled: true },
      { provider: "dropcontact", enabled: false },
      { provider: "pattern", enabled: true },
    ]);
    expect(targeting.discovery_sources.map((entry) => entry.source)).toEqual([
      "website",
      "linkedin",
      "legal_registry",
    ]);
  });

  it("ignore un fournisseur inconnu ou répété", () => {
    const targeting = resolveTargeting({
      enrichment_waterfall: [
        { provider: "hunter", enabled: false },
        { provider: "hunter", enabled: true },
        { provider: "magie" as never, enabled: true },
      ],
    });
    expect(targeting.enrichment_waterfall[0]).toEqual({ provider: "hunter", enabled: false });
    expect(targeting.enrichment_waterfall).toHaveLength(3);
  });
});

describe("resolveFilters", () => {
  it("lit les poids du score et la référence de taille", () => {
    const filters = resolveFilters({
      scoring: { ads_active: 50 },
      reference_size: { reviews_count: 120 },
      reference_sector: " Opticien ",
    });
    expect(filters.scoring.ads_active).toBe(50);
    expect(filters.scoring.size_in_range).toBe(30);
    expect(filters.reference_size).toEqual({ reviews_count: 120 });
    expect(filters.reference_sector).toBe("Opticien");
  });
});

describe("campaignReadiness", () => {
  it("nomme ce qui manque à une campagne Maps", () => {
    expect(campaignReadiness(resolveCampaignConfig(campaign()))).toEqual([
      "au moins un mot-clé métier",
      "au moins une ville",
    ]);
    expect(
      campaignReadiness(
        resolveCampaignConfig(
          campaign({ source_params: { keywords: ["opticien"], cities: ["Lyon"] } }),
        ),
      ),
    ).toEqual([]);
  });

  it("demande une catégorie à une campagne e-commerce", () => {
    expect(campaignReadiness(resolveCampaignConfig(campaign({ engine: "ecommerce" })))).toEqual([
      "une catégorie de boutiques",
    ]);
  });
});
