import { describe, expect, it } from "vitest";

import {
  actionValue,
  aggregateBreakdown,
  breakdownLabel,
  syncWindow,
  toDailyMetricsColumns,
  toNumber,
  toRawMetrics,
} from "./mapping";

describe("toNumber", () => {
  it("convertit les chaînes que Meta renvoie", () => {
    expect(toNumber("2572.22")).toBe(2572.22);
    expect(toNumber("557255")).toBe(557255);
  });

  it("rend 0 plutôt que NaN sur une valeur absente ou illisible", () => {
    // Un NaN qui remonte se propage à toute la somme du mois.
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber("")).toBe(0);
    expect(toNumber("n/a")).toBe(0);
  });
});

describe("actionValue", () => {
  const actions = [
    { action_type: "landing_page_view", value: "625" },
    { action_type: "offsite_conversion.fb_pixel_purchase", value: "8" },
  ];

  it("trouve une action nommée exactement", () => {
    expect(actionValue(actions, "landing_page_view")).toBe(625);
  });

  it("reconnaît une action préfixée par sa source", () => {
    // Sans le suffixe, les achats d'un compte à pixel tombaient à zéro.
    expect(actionValue(actions, "purchase")).toBe(8);
  });

  it("rend 0 pour une action absente — absente vaut zéro, pas inconnu", () => {
    expect(actionValue(actions, "add_to_cart")).toBe(0);
    expect(actionValue(undefined, "purchase")).toBe(0);
  });
});

describe("toRawMetrics", () => {
  it("traduit une ligne complète", () => {
    const raw = toRawMetrics({
      spend: "2572.22",
      impressions: "557255",
      reach: "179764",
      clicks: "11038",
      inline_link_clicks: "4068",
      actions: [
        { action_type: "purchase", value: "8" },
        { action_type: "landing_page_view", value: "625" },
        { action_type: "add_to_cart", value: "47" },
        { action_type: "initiate_checkout", value: "34" },
      ],
      action_values: [{ action_type: "purchase", value: "837.9" }],
    });

    expect(raw.spend).toBe(2572.22);
    expect(raw.impressions).toBe(557255);
    expect(raw.reach).toBe(179764);
    expect(raw.purchases).toBe(8);
    expect(raw.purchaseValue).toBe(837.9);
    expect(raw.addToCart).toBe(47);
    expect(raw.initiatedCheckout).toBe(34);
  });

  it("rend un modèle complet même sur une ligne vide", () => {
    // Une campagne sans dépense du jour renvoie une ligne quasi vide : elle
    // doit valoir zéro partout, pas laisser des champs indéfinis derrière.
    const raw = toRawMetrics({});
    expect(Object.values(raw).every((value) => value === 0)).toBe(true);
  });
});

describe("breakdownLabel", () => {
  it("traduit le genre", () => {
    expect(breakdownLabel("female")).toBe("Femmes");
    expect(breakdownLabel("male")).toBe("Hommes");
  });

  it("nomme la part non attribuée au lieu de la masquer", () => {
    // La cacher fausserait les pourcentages du Persona.
    expect(breakdownLabel("unknown")).toBe("Inconnu");
    expect(breakdownLabel(undefined)).toBe("Inconnu");
  });

  it("laisse passer une tranche d'âge ou une région telle quelle", () => {
    expect(breakdownLabel("25-34")).toBe("25-34");
    expect(breakdownLabel("Île-de-France")).toBe("Île-de-France");
  });
});

describe("toDailyMetricsColumns", () => {
  it("traduit vers les colonnes snake_case de la table journalière", () => {
    const columns = toDailyMetricsColumns({
      date_start: "2026-08-01",
      spend: "12.5",
      impressions: "1000",
      reach: "800",
      inline_link_clicks: "40",
      actions: [{ action_type: "add_to_cart", value: "3" }],
    });

    expect(columns.date).toBe("2026-08-01");
    expect(columns.spend).toBe(12.5);
    expect(columns.link_clicks).toBe(40);
    expect(columns.add_to_cart).toBe(3);
    expect(columns.reach).toBe(800);
  });
});

describe("aggregateBreakdown", () => {
  const cells = [
    { date_start: "2026-08-01", age: "25-34", gender: "female", impressions: "100", clicks: "8", spend: "1" },
    { date_start: "2026-08-01", age: "25-34", gender: "male", impressions: "60", clicks: "2", spend: "1" },
    { date_start: "2026-08-01", age: "18-24", gender: "female", impressions: "40", clicks: "1", spend: "1" },
    { date_start: "2026-08-02", age: "25-34", gender: "female", impressions: "50", clicks: "3", spend: "1" },
  ];

  it("somme les cellules âge × genre le long d'un seul axe", () => {
    const byAge = aggregateBreakdown(cells, "age");
    const target = byAge.find((cell) => cell.date === "2026-08-01" && cell.value === "25-34");
    // 100 (femmes) + 60 (hommes) : le genre disparaît dans la somme.
    expect(target?.impressions).toBe(160);
    expect(target?.clicks).toBe(10);
  });

  it("garde les jours séparés — la clé primaire porte la date", () => {
    const byAge = aggregateBreakdown(cells, "age");
    expect(byAge.filter((cell) => cell.value === "25-34")).toHaveLength(2);
  });

  it("traduit les valeurs au passage", () => {
    const byGender = aggregateBreakdown(cells, "gender");
    expect(byGender.map((cell) => cell.value)).toContain("Femmes");
  });

  it("ignore une ligne sans date plutôt que de fabriquer une clé vide", () => {
    expect(aggregateBreakdown([{ age: "25-34", impressions: "10" }], "age")).toHaveLength(0);
  });
});

describe("syncWindow", () => {
  const now = new Date("2026-08-17T10:00:00Z");

  it("remonte 90 jours au premier passage", () => {
    const window = syncWindow({ lastSyncAt: null, now });
    expect(window).toEqual({ since: "2026-05-19", until: "2026-08-17" });
  });

  it("remonte 35 jours ensuite — Meta réécrit les conversions sur 28 jours", () => {
    const window = syncWindow({ lastSyncAt: "2026-08-16T04:00:00Z", now });
    expect(window).toEqual({ since: "2026-07-13", until: "2026-08-17" });
  });

  it("s'étend en arrière quand l'écran demande une plage plus ancienne", () => {
    const window = syncWindow({
      lastSyncAt: "2026-08-16T04:00:00Z",
      now,
      atLeastSince: "2026-03-01",
    });
    expect(window.since).toBe("2026-03-01");
    // Une plage récente ne raccourcit jamais la fenêtre de rattrapage.
    const recent = syncWindow({
      lastSyncAt: "2026-08-16T04:00:00Z",
      now,
      atLeastSince: "2026-08-10",
    });
    expect(recent.since).toBe("2026-07-13");
  });
});

describe("actionValue — priorité entre variantes", () => {
  it("préfère le type exact à sa variante préfixée", () => {
    // Un compte qui expose les deux compterait deux fois si l'ordre variait
    // d'un jour à l'autre.
    const both = [
      { action_type: "offsite_conversion.fb_pixel_purchase", value: "12" },
      { action_type: "purchase", value: "8" },
    ];
    expect(actionValue(both, "purchase")).toBe(8);
  });

  it("ne confond pas deux actions dont l'une contient le nom de l'autre", () => {
    const actions = [{ action_type: "initiate_checkout", value: "34" }];
    expect(actionValue(actions, "checkout")).toBe(0);
    expect(actionValue(actions, "initiate_checkout")).toBe(34);
  });
});
