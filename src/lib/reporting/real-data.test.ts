import { describe, expect, it } from "vitest";

import type {
  AdBreakdownDaily,
  AdEntity,
  AdMetricsDaily,
  SocialFollowers,
  SocialPost,
} from "@/lib/supabase/database.types";
import { previousRange } from "./period";
import {
  buildAdSetRows,
  buildBreakdown,
  metricsRowToRaw,
  monthlyFollowersSeries,
  sumPosts,
} from "./real-data";

const entity = (over: Partial<AdEntity>): AdEntity => ({
  id: "e1",
  data_source_id: "ds",
  workspace_id: "w",
  level: "adset",
  external_id: "x1",
  parent_external_id: null,
  name: "Ad set",
  status: null,
  thumbnail_url: null,
  permalink: null,
  created_at: "",
  updated_at: "",
  ...over,
});

const daily = (over: Partial<AdMetricsDaily>): AdMetricsDaily => ({
  data_source_id: "ds",
  workspace_id: "w",
  entity_id: "e1",
  date: "2026-07-01",
  spend: 0,
  impressions: 0,
  reach: 0,
  clicks: 0,
  link_clicks: 0,
  purchases: 0,
  purchase_value: 0,
  landing_page_views: 0,
  add_to_cart: 0,
  initiated_checkout: 0,
  comments: 0,
  saves: 0,
  shares: 0,
  updated_at: "",
  ...over,
});

describe("metricsRowToRaw", () => {
  it("convertit en nombres — PostgREST rend les numeric en chaînes", () => {
    const raw = metricsRowToRaw(
      daily({ spend: "12.5" as unknown as number, impressions: 100 }),
    );
    expect(raw.spend).toBe(12.5);
    expect(raw.impressions).toBe(100);
  });
});

describe("buildAdSetRows", () => {
  const entities = [
    entity({ id: "c1", level: "campaign", external_id: "camp-1", name: "Conversions" }),
    entity({ id: "e1", external_id: "as-1", parent_external_id: "camp-1", name: "BROAD" }),
    entity({ id: "e2", external_id: "as-2", parent_external_id: "camp-1", name: "Retargeting" }),
  ];

  it("somme les jours d'un même ad set et retrouve la campagne du parent", () => {
    const rows = buildAdSetRows(entities, [
      daily({ entity_id: "e1", date: "2026-07-01", spend: 10, impressions: 100 }),
      daily({ entity_id: "e1", date: "2026-07-02", spend: 5, impressions: 50 }),
      daily({ entity_id: "e2", date: "2026-07-01", spend: 30, impressions: 20 }),
    ]);

    expect(rows).toHaveLength(2);
    // Trié par dépense décroissante.
    expect(rows[0]?.adSet).toBe("Retargeting");
    expect(rows[1]?.raw.spend).toBe(15);
    expect(rows[1]?.raw.impressions).toBe(150);
    expect(rows[0]?.campaign).toBe("Conversions");
  });

  it("ignore les lignes de campagne — le tableau est par ad set", () => {
    const rows = buildAdSetRows(entities, [
      daily({ entity_id: "c1", spend: 99 }),
      daily({ entity_id: "e1", spend: 1 }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.adSet).toBe("BROAD");
  });
});

describe("buildBreakdown", () => {
  const rows: AdBreakdownDaily[] = [
    { data_source_id: "ds", workspace_id: "w", date: "2026-07-01", type: "gender", value: "Femmes", spend: 1, impressions: 60, clicks: 1, updated_at: "" },
    { data_source_id: "ds", workspace_id: "w", date: "2026-07-02", type: "gender", value: "Femmes", spend: 1, impressions: 20, clicks: 1, updated_at: "" },
    { data_source_id: "ds", workspace_id: "w", date: "2026-07-01", type: "gender", value: "Hommes", spend: 1, impressions: 20, clicks: 1, updated_at: "" },
    { data_source_id: "ds", workspace_id: "w", date: "2026-07-01", type: "age", value: "65+", spend: 1, impressions: 10, clicks: 0, updated_at: "" },
    { data_source_id: "ds", workspace_id: "w", date: "2026-07-01", type: "age", value: "Inconnu", spend: 1, impressions: 5, clicks: 0, updated_at: "" },
    { data_source_id: "ds", workspace_id: "w", date: "2026-07-01", type: "age", value: "18-24", spend: 1, impressions: 30, clicks: 0, updated_at: "" },
  ];

  it("somme les jours et calcule la part sur le total de l'axe", () => {
    const gender = buildBreakdown(rows, "gender");
    expect(gender[0]).toMatchObject({ label: "Femmes", value: 80, share: 0.8 });
  });

  it("ordonne les âges par tranche, « Inconnu » en dernier", () => {
    const age = buildBreakdown(rows, "age");
    expect(age.map((entry) => entry.label)).toEqual(["18-24", "65+", "Inconnu"]);
    expect(age.at(-1)?.outOfScale).toBe(true);
  });

  it("rend vide sans données — l'écran le dira, pas un NaN", () => {
    expect(buildBreakdown([], "age")).toEqual([]);
  });
});

describe("monthlyFollowersSeries", () => {
  const snapshot = (date: string, count: number): SocialFollowers => ({
    data_source_id: "ds",
    workspace_id: "w",
    platform: "instagram",
    date,
    followers_count: count,
    source: "api",
    updated_at: "",
  });

  it("garde le dernier relevé de chaque mois — un niveau, pas un flux", () => {
    const series = monthlyFollowersSeries([
      snapshot("2026-06-02", 2500),
      snapshot("2026-06-28", 2700),
      snapshot("2026-07-15", 2900),
    ]);
    expect(series).toEqual([
      { label: "juin 2026", value: 2700 },
      { label: "juil. 2026", value: 2900 },
    ]);
  });
});

describe("sumPosts", () => {
  const post = (over: Partial<SocialPost>): SocialPost => ({
    id: "p",
    data_source_id: "ds",
    workspace_id: "w",
    platform: "instagram",
    external_id: "x",
    published_at: "2026-07-01T10:00:00Z",
    caption: null,
    permalink: null,
    thumbnail_url: null,
    media_kind: "image" as const,
    reach: 0,
    impressions: 0,
    likes: 0,
    comments: 0,
    saves: 0,
    shares: 0,
    updated_at: "",
    ...over,
  });

  it("somme les publications de la période", () => {
    const total = sumPosts([
      post({ reach: 100, impressions: 150, comments: 2, saves: 1, shares: 4, likes: 20 }),
      post({ reach: 50, impressions: 60, comments: 1, saves: 0, shares: 1, likes: 5 }),
    ]);
    expect(total.reach).toBe(150);
    expect(total.impressions).toBe(210);
    expect(total.shares).toBe(5);
    expect(total.likes).toBe(25);
    // Rien d'inventé sur les grandeurs publicitaires.
    expect(total.spend).toBe(0);
  });

  it("ne compte les vues vidéo que sur les reels", () => {
    // Les vues d'une image sont des impressions, pas des lectures.
    const total = sumPosts([
      post({ media_kind: "video", impressions: 400 }),
      post({ media_kind: "image", impressions: 300 }),
    ]);
    expect(total.videoViews).toBe(400);
    expect(total.impressions).toBe(700);
  });
});

describe("previousRange", () => {
  it("compare un mois civil au mois civil précédent", () => {
    expect(previousRange({ from: "2026-07-01", to: "2026-07-31" })).toEqual({
      from: "2026-06-01",
      to: "2026-06-30",
    });
  });

  it("décale une plage libre de sa propre longueur", () => {
    expect(previousRange({ from: "2026-08-08", to: "2026-08-14" })).toEqual({
      from: "2026-08-01",
      to: "2026-08-07",
    });
  });

  it("ne prend pas 30 jours quelconques pour un mois", () => {
    // Du 2 au 31 juillet n'est pas « juillet » : la comparaison glisse.
    expect(previousRange({ from: "2026-07-02", to: "2026-07-31" })).toEqual({
      from: "2026-06-02",
      to: "2026-07-01",
    });
  });
});
