import { describe, expect, it } from "vitest";

import type {
  AdBreakdownDaily,
  AdEntity,
  AdMetricsDaily,
  SocialFollowers,
  SocialPost,
} from "@/lib/supabase/database.types";
import { previousRange } from "./period";
import { EMPTY_RAW_METRICS } from "@/lib/metrics/types";
import {
  aggregateCustomEvents,
  buildAdSetRows,
  buildBreakdown,
  foldClientConversions,
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
  video_views: 0,
  video_completions: 0,
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

  it("fige chaque mois sur son relevé de fin de mois — la convention des rapports", () => {
    // « Juin » veut dire « où on en était au 30 juin » : c'est ce que
    // relevaient les rapports Looker, et ce que disent les relevés repris à
    // la main. Le dernier relevé du mois fait foi ; un mois révolu ne bouge
    // plus puisque le cron quotidien a couvert son dernier jour.
    const series = monthlyFollowersSeries(
      [snapshot("2026-06-01", 2500), snapshot("2026-06-28", 2700), snapshot("2026-07-15", 2900)],
      new Date("2026-08-10T00:00:00Z"),
    );
    expect(series).toEqual([
      { label: "juin 2026", value: 2700 },
      { label: "juil. 2026", value: 2900 },
    ]);
  });

  it("s'arrête au dernier mois fermé — jamais le mois en cours", () => {
    // Le 2 septembre, le relevé du 1er (clôture du 31 août) est sous août ;
    // un relevé daté du 1er septembre ne s'affiche que quand septembre est
    // fini. Vu chez tous les clients le 2 septembre 2026.
    const series = monthlyFollowersSeries(
      [snapshot("2026-07-31", 1000), snapshot("2026-08-31", 991), snapshot("2026-09-01", 991)],
      new Date("2026-09-02T05:00:00Z"),
    );
    expect(series.map((point) => point.label)).toEqual(["juil. 2026", "août 2026"]);
    expect(series.at(-1)).toEqual({ label: "août 2026", value: 991 });
  });

  it("ne montre que les douze derniers mois, l'historique restant en base", () => {
    // Quinze mois de relevés : janvier 2025 → mars 2026.
    const rows = Array.from({ length: 15 }, (_, index) => {
      const year = index < 12 ? 2025 : 2026;
      const month = String((index % 12) + 1).padStart(2, "0");
      return snapshot(`${year}-${month}-28`, 100 + index);
    });
    const series = monthlyFollowersSeries(rows, new Date("2026-04-10T00:00:00Z"));
    expect(series).toHaveLength(12);
    expect(series[0]).toEqual({ label: "avr. 2025", value: 103 });
    expect(series.at(-1)).toEqual({ label: "mars 2026", value: 114 });
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
    video_views: 0,
    likes: 0,
    comments: 0,
    saves: 0,
    shares: 0,
    clicks: 0,
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

  it("somme les vues vidéo mesurées, sans les déduire des impressions", () => {
    // Facebook compte les lectures à part : les déduire du type de média
    // donnerait un chiffre inventé sur les deux réseaux.
    const total = sumPosts([
      post({ media_kind: "video", impressions: 400, video_views: 250 }),
      post({ media_kind: "image", impressions: 300, video_views: 0 }),
    ]);
    expect(total.videoViews).toBe(250);
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

describe("aggregateCustomEvents", () => {
  it("regroupe par nom et somme les comptes", () => {
    const totals = aggregateCustomEvents(
      [
        { event_name: "Validation Shop Lyon", count: 2, value: 0 },
        { event_name: "Validation Shop Lyon", count: 3, value: 0 },
        { event_name: "Validation Resa Lyon", count: 1, value: 0 },
      ],
      500,
    );

    expect(totals.map((t) => [t.name, t.count])).toEqual([
      ["Validation Shop Lyon", 5],
      ["Validation Resa Lyon", 1],
    ]);
  });

  it("recalcule le coût par événement depuis la dépense de la période", () => {
    // Jamais une moyenne de coûts journaliers : une moyenne de moyennes est
    // fausse, et c'est le piège classique de ce genre d'outil.
    const totals = aggregateCustomEvents(
      [{ event_name: "Validation Shop Lyon", count: 4, value: 0 }],
      199.72,
    );
    expect(totals[0]!.costPer).toBeCloseTo(49.93, 2);
  });

  it("rend un montant nul plutôt que zéro euro", () => {
    /* Une validation de boutique ne porte pas de montant. « 0,00 € » se
       lirait comme un chiffre d'affaires nul, ce qui est un autre propos. */
    const totals = aggregateCustomEvents(
      [{ event_name: "Validation Shop Lyon", count: 2, value: 0 }],
      100,
    );
    expect(totals[0]!.value).toBeNull();
  });

  it("garde le montant quand l'événement en porte un", () => {
    const totals = aggregateCustomEvents(
      [{ event_name: "Devis", count: 2, value: 150.5 }],
      100,
    );
    expect(totals[0]!.value).toBe(150.5);
  });

  it("trie par nombre décroissant, puis par nom", () => {
    const totals = aggregateCustomEvents(
      [
        { event_name: "Zèbre", count: 2, value: 0 },
        { event_name: "Alpha", count: 2, value: 0 },
        { event_name: "Beaucoup", count: 9, value: 0 },
      ],
      10,
    );
    expect(totals.map((t) => t.name)).toEqual(["Beaucoup", "Alpha", "Zèbre"]);
  });

  it("ne rend pas de coût sans événement", () => {
    const totals = aggregateCustomEvents(
      [{ event_name: "Jamais", count: 0, value: 0 }],
      100,
    );
    expect(totals[0]!.costPer).toBeNull();
  });

  it("ignore un nom vide et une liste vide", () => {
    expect(aggregateCustomEvents([{ event_name: "  ", count: 5, value: 0 }], 10)).toEqual([]);
    expect(aggregateCustomEvents([], 10)).toEqual([]);
  });
});

describe("foldClientConversions", () => {
  const base = {
    ...EMPTY_RAW_METRICS,
    spend: 200,
    purchases: 0,
    purchaseValue: 0,
    addToCart: 0,
  };
  const events = [
    { name: "Validation Shop Lyon", count: 4, value: null, costPer: 50 },
    { name: "Validation Shop Paris", count: 2, value: null, costPer: 100 },
    { name: "Validation Resa Lyon", count: 1, value: null, costPer: 200 },
    { name: "Validation Resa Paris", count: 3, value: null, costPer: 66 },
  ];
  const aucun = { purchase: [], addToCart: [] };

  it("ne touche à rien sans réglage", () => {
    // Le défaut : un événement personnalisé n'est pas une vente.
    expect(foldClientConversions(base, events, aucun)).toEqual(base);
  });

  it("verse dans les achats les événements désignés, et eux seuls", () => {
    const out = foldClientConversions(base, events, {
      purchase: ["Validation Shop Lyon", "Validation Shop Paris"],
      addToCart: [],
    });
    expect(out.purchases).toBe(6);
    expect(out.addToCart).toBe(0);
  });

  it("sépare les deux rôles — le cas réel d'I-WAY", () => {
    /* « Validation Shop » est la vente, « Validation Resa » la mise au
       panier. Les confondre doublerait les achats. */
    const out = foldClientConversions(base, events, {
      purchase: ["Validation Shop Lyon", "Validation Shop Paris"],
      addToCart: ["Validation Resa Lyon", "Validation Resa Paris"],
    });
    expect(out.purchases).toBe(6);
    expect(out.addToCart).toBe(4);
  });

  it("ignore casse et accents du réglage", () => {
    const out = foldClientConversions(base, events, {
      purchase: ["validation shop lyon"],
      addToCart: [],
    });
    expect(out.purchases).toBe(4);
  });

  it("n'invente aucun chiffre d'affaires", () => {
    /* Un événement sans montant rend le CPA juste et laisse le ROAS à zéro.
       Inventer un panier moyen ferait apparaître un chiffre d'affaires que
       personne n'a encaissé. */
    const out = foldClientConversions(base, events, {
      purchase: ["Validation Shop Lyon"],
      addToCart: [],
    });
    expect(out.purchaseValue).toBe(0);
  });

  it("ajoute le montant quand l'événement en porte un", () => {
    const out = foldClientConversions(
      base,
      [{ name: "Devis", count: 2, value: 300, costPer: 100 }],
      { purchase: ["Devis"], addToCart: [] },
    );
    expect(out.purchases).toBe(2);
    expect(out.purchaseValue).toBe(300);
  });

  it("s'ajoute aux mesures existantes, sans les remplacer", () => {
    const avec = { ...base, purchases: 3, purchaseValue: 90, addToCart: 5 };
    const out = foldClientConversions(avec, events, {
      purchase: ["Validation Shop Lyon"],
      addToCart: ["Validation Resa Lyon"],
    });
    expect(out.purchases).toBe(7);
    expect(out.purchaseValue).toBe(90);
    expect(out.addToCart).toBe(6);
  });

  it("ignore un nom réglé qui ne correspond à aucun événement", () => {
    expect(
      foldClientConversions(base, events, { purchase: ["Inexistant"], addToCart: [] }),
    ).toEqual(base);
  });

  it("un événement présent dans les deux listes ne compte qu'une fois — l'achat gagne", () => {
    /* Le cas que la revue adversariale a trouvé : une variante d'accent du
       même nom dans chaque liste (« Résa » posé à la main, « Resa » relevé).
       Compter des deux côtés gonflerait tuiles, entonnoir et tableau. */
    const out = foldClientConversions(base, events, {
      purchase: ["Validation Résa Lyon"],
      addToCart: ["Validation Resa Lyon"],
    });
    expect(out.purchases).toBe(1);
    expect(out.addToCart).toBe(0);
  });
});
