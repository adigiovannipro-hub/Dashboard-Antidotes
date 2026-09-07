import { describe, expect, it } from "vitest";

import {
  applyPipelineFilters,
  hasActiveFilters,
  parsePipelineParams,
} from "./pipeline-params";

const ID = "2d1b6f0e-8c1a-4c2e-9f1a-0b3c4d5e6f70";

describe("parsePipelineParams", () => {
  it("rend des filtres vides sans paramètre", () => {
    const params = parsePipelineParams({});
    expect(params.filters).toEqual({
      sector: null,
      country: null,
      adsActive: false,
      minScore: null,
      referenceClient: null,
      campaignId: null,
      status: null,
    });
    expect(params.prospectId).toBeNull();
    expect(hasActiveFilters(params.filters)).toBe(false);
  });

  it("lit chaque filtre depuis son paramètre français", () => {
    const params = parsePipelineParams({
      secteur: "Opticien",
      pays: "fr",
      pubs: "1",
      score: "50",
      reference: "Bondet",
      campagne: ID,
      statut: "contacted",
      prospect: ID.toUpperCase(),
    });
    expect(params.filters).toEqual({
      sector: "Opticien",
      country: "FR",
      adsActive: true,
      minScore: 50,
      referenceClient: "Bondet",
      campaignId: ID,
      status: "contacted",
    });
    expect(params.prospectId).toBe(ID);
    expect(hasActiveFilters(params.filters)).toBe(true);
  });

  it("dégrade une valeur illisible au lieu d'échouer", () => {
    const params = parsePipelineParams({
      pays: "France",
      score: "beaucoup",
      campagne: "pas-un-uuid",
      statut: "inconnu",
      prospect: "42",
      pubs: "oui",
    });
    expect(params.filters.country).toBeNull();
    expect(params.filters.minScore).toBeNull();
    expect(params.filters.campaignId).toBeNull();
    expect(params.filters.status).toBeNull();
    expect(params.filters.adsActive).toBe(false);
    expect(params.prospectId).toBeNull();
  });

  it("plafonne le score à 100 et ignore zéro", () => {
    expect(parsePipelineParams({ score: "250" }).filters.minScore).toBe(100);
    expect(parsePipelineParams({ score: "0" }).filters.minScore).toBeNull();
  });

  it("prend la première valeur d'un paramètre répété", () => {
    expect(parsePipelineParams({ secteur: ["A", "B"] }).filters.sector).toBe("A");
  });
});

describe("applyPipelineFilters", () => {
  const rows = [
    {
      id: "a",
      sector: "Opticien",
      country: "FR",
      ads_active: true,
      score: 70,
      reference_client: "Bondet",
      campaign_id: ID,
      status: "qualified" as const,
    },
    {
      id: "b",
      sector: "Escalade",
      country: "BE",
      ads_active: false,
      score: 20,
      reference_client: null,
      campaign_id: null,
      status: "to_qualify" as const,
    },
  ];

  it("garde tout sans filtre", () => {
    expect(applyPipelineFilters(rows, parsePipelineParams({}).filters)).toHaveLength(2);
  });

  it("combine les filtres en ET", () => {
    const kept = applyPipelineFilters(
      rows,
      parsePipelineParams({ pubs: "1", score: "50", pays: "FR" }).filters,
    );
    expect(kept.map((row) => row.id)).toEqual(["a"]);
  });

  it("filtre par campagne, référence et statut", () => {
    expect(
      applyPipelineFilters(rows, parsePipelineParams({ campagne: ID }).filters).map((r) => r.id),
    ).toEqual(["a"]);
    expect(
      applyPipelineFilters(rows, parsePipelineParams({ reference: "Bondet" }).filters).map(
        (r) => r.id,
      ),
    ).toEqual(["a"]);
    expect(
      applyPipelineFilters(rows, parsePipelineParams({ statut: "to_qualify" }).filters).map(
        (r) => r.id,
      ),
    ).toEqual(["b"]);
  });
});
