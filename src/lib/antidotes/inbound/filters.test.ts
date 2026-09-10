import { describe, expect, it } from "vitest";

import {
  applyContentFilters,
  contentFiltersToParams,
  parseContentFilters,
  parseDays,
  parseThreshold,
  type ContentRow,
} from "./filters";

const NOW = Date.parse("2026-09-09T12:00:00Z");
const day = (offset: number) => new Date(NOW + offset * 86_400_000).toISOString();

const row = (over: Partial<ContentRow> & { key?: string }): ContentRow & { key: string } => ({
  key: over.key ?? "x",
  platform: over.platform ?? "instagram",
  metrics: over.metrics ?? {},
  // `??` avalerait un `published_at: null` explicite, que ce fichier teste.
  published_at: "published_at" in over ? over.published_at! : day(-3),
  score: over.score ?? { sortKey: 1 },
});

describe("parseThreshold", () => {
  it("ne garde qu'un entier positif", () => {
    expect(parseThreshold("10000")).toBe(10000);
    expect(parseThreshold("12.7")).toBe(12);
    expect(parseThreshold("")).toBeNull();
    expect(parseThreshold(undefined)).toBeNull();
    expect(parseThreshold("-5")).toBeNull();
    expect(parseThreshold("beaucoup")).toBeNull();
  });
});

describe("parseDays", () => {
  it("rend trente jours par défaut, null pour tout l'historique", () => {
    expect(parseDays(undefined)).toBe(30);
    expect(parseDays("7")).toBe(7);
    expect(parseDays("tout")).toBeNull();
    expect(parseDays("zéro")).toBe(30);
  });
});

describe("applyContentFilters", () => {
  it("écarte un autre réseau et ce qui sort de la fenêtre", () => {
    const rows = [
      row({ key: "récent" }),
      row({ key: "vieux", published_at: day(-45) }),
      row({ key: "linkedin", platform: "linkedin" }),
    ];
    const kept = applyContentFilters(rows, parseContentFilters({ reseau: "instagram", jours: "30" }), NOW);
    expect(kept.map((r) => r.key)).toEqual(["récent"]);
  });

  it("garde tout l'historique quand la période est « tout »", () => {
    const rows = [row({ key: "récent" }), row({ key: "vieux", published_at: day(-400) })];
    expect(applyContentFilters(rows, parseContentFilters({ jours: "tout" }), NOW)).toHaveLength(2);
  });

  it("un seuil ne juge que ce que le réseau rend", () => {
    const rows = [
      row({ key: "vu", metrics: { views: 12000 } }),
      row({ key: "peu vu", metrics: { views: 800 } }),
      // LinkedIn ne rend pas de vues : le seuil ne peut pas le juger, il reste.
      row({ key: "sans vues", platform: "linkedin", metrics: { likes: 300 } }),
    ];
    const kept = applyContentFilters(rows, parseContentFilters({ vues: "5000" }), NOW);
    expect(kept.map((r) => r.key).sort()).toEqual(["sans vues", "vu"]);
  });

  it("range par la grandeur demandée", () => {
    const rows = [
      row({ key: "a", metrics: { likes: 10, views: 900 }, score: { sortKey: 5 } }),
      row({ key: "b", metrics: { likes: 90, views: 100 }, score: { sortKey: 1 } }),
    ];
    expect(applyContentFilters(rows, parseContentFilters({ tri: "likes" }), NOW).map((r) => r.key)).toEqual(["b", "a"]);
    expect(applyContentFilters(rows, parseContentFilters({ tri: "vues" }), NOW).map((r) => r.key)).toEqual(["a", "b"]);
    expect(applyContentFilters(rows, parseContentFilters({}), NOW).map((r) => r.key)).toEqual(["a", "b"]);
  });

  it("un post sans date sort de toute fenêtre, mais reste dans « tout »", () => {
    const rows = [row({ key: "sans date", published_at: null })];
    expect(applyContentFilters(rows, parseContentFilters({ jours: "30" }), NOW)).toHaveLength(0);
    expect(applyContentFilters(rows, parseContentFilters({ jours: "tout" }), NOW)).toHaveLength(1);
  });
});

describe("contentFiltersToParams", () => {
  it("n'écrit que ce qui n'est pas par défaut", () => {
    expect(contentFiltersToParams({ platform: "linkedin", days: 30, sort: "score" })).toEqual({
      reseau: "linkedin",
      jours: "30",
    });
    expect(contentFiltersToParams({ days: null, minViews: 5000, sort: "vues" })).toEqual({
      jours: "tout",
      vues: "5000",
      tri: "vues",
    });
  });
});
