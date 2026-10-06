import { describe, expect, it } from "vitest";

import {
  advertisersFrom,
  ageLabel,
  audienceBreakdown,
  businessCentersFrom,
  dailyAdGroups,
  entitiesFrom,
  genderLabel,
  reportWindows,
  toDailyMetricsColumns,
  totalPages,
  uniqueAdvertisers,
} from "./mapping";
import type { TiktokReportRow } from "./types";

/* Charges utiles relevées le 1/10/2026 sur le compte d'ANMF, par le passage
   brut de Composio — écourtées, jamais réécrites. */

const BC_RESPONSE = {
  list: [
    {
      bc_info: { bc_id: "7483418190601682960", name: "ANMF", currency: "EUR" },
      user_role: "ADMIN",
    },
    { bc_info: { bc_id: "7281678409430777857", name: "I-VENT" }, user_role: "ADMIN" },
    { bc_info: {}, user_role: "ADMIN" },
  ],
  page_info: { page: 1, page_size: 50, total_number: 4, total_page: 1 },
  parent_bc: { bc_info: {} },
};

const ASSET_RESPONSE = {
  list: [
    {
      advertiser_account_type: "AUCTION",
      advertiser_role: "ADMIN",
      asset_id: "7483419182575681552",
      asset_name: "Chasseurs de Graines",
      asset_type: "ADVERTISER",
      owner_bc_name: "ANMF",
    },
  ],
  page_info: { page: 1, page_size: 50, total_number: 1, total_page: 1 },
};

const REPORT_ROWS: TiktokReportRow[] = [
  {
    metrics: {
      video_views_p100: "39",
      impressions: "17740",
      adgroup_name: "INTEREST",
      comments: "0",
      spend: "5.31",
      clicks: "84",
      video_play_actions: "14669",
      shares: "0",
      campaign_name: "SP TT - 04/06 - CAMPAGNE DARK 2026",
      campaign_id: "1867090352305313",
      reach: "12472",
      complete_payment: "0",
      value_per_complete_payment: "0.00",
      total_landing_page_view: "60",
    },
    dimensions: { stat_time_day: "2026-08-09 00:00:00", adgroup_id: "1867090352310337" },
  },
  {
    // Un groupe éteint : TikTok le rend quand même, à zéro partout.
    metrics: {
      complete_payment: "0",
      campaign_name: "Chasseurs De Graines — Run Quotidien",
      campaign_id: "1831652960713729",
      spend: "0.00",
      impressions: "0",
      clicks: "0",
      video_play_actions: "0",
      adgroup_name: "SP TT - 18/09 - BEAUTY — CAKE",
    },
    dimensions: { stat_time_day: "2026-09-26 00:00:00", adgroup_id: "1876668169548273" },
  },
];

describe("businessCentersFrom", () => {
  it("lit les Business Centers et ignore une ligne sans identifiant", () => {
    expect(businessCentersFrom(BC_RESPONSE)).toEqual([
      { id: "7483418190601682960", name: "ANMF" },
      { id: "7281678409430777857", name: "I-VENT" },
    ]);
  });

  it("rend une liste vide sur une réponse inattendue", () => {
    expect(businessCentersFrom(null)).toEqual([]);
    expect(businessCentersFrom({ list: "non" })).toEqual([]);
  });
});

describe("advertisersFrom", () => {
  it("lit le compte publicitaire et son Business Center", () => {
    expect(
      advertisersFrom(ASSET_RESPONSE, { id: "7483418190601682960", name: "ANMF" }),
    ).toEqual([
      {
        id: "7483419182575681552",
        name: "Chasseurs de Graines",
        businessCenterId: "7483418190601682960",
        businessCenterName: "ANMF",
      },
    ]);
  });

  it("écarte un actif qui n'est pas un compte publicitaire", () => {
    const data = { list: [{ asset_id: "1", asset_name: "Catalogue", asset_type: "CATALOG" }] };
    expect(advertisersFrom(data, { id: "bc", name: null })).toEqual([]);
  });
});

describe("uniqueAdvertisers", () => {
  it("garde un compte vu dans deux Business Centers une seule fois", () => {
    const a = { id: "1", name: "Compte", businessCenterId: "agence", businessCenterName: null };
    const b = { ...a, businessCenterId: "client" };
    expect(uniqueAdvertisers([a, b])).toEqual([a]);
  });
});

describe("totalPages", () => {
  it("lit page_info, et vaut 1 sans lui", () => {
    expect(totalPages({ page_info: { total_page: 3 } })).toBe(3);
    expect(totalPages({})).toBe(1);
  });
});

describe("reportWindows", () => {
  it("découpe en tranches de trente jours, bornes comprises, sans trou ni recouvrement", () => {
    expect(reportWindows("2026-08-01", "2026-09-30")).toEqual([
      { from: "2026-08-01", to: "2026-08-30" },
      { from: "2026-08-31", to: "2026-09-29" },
      { from: "2026-09-30", to: "2026-09-30" },
    ]);
  });

  it("rend une seule tranche pour une période courte", () => {
    expect(reportWindows("2026-09-01", "2026-09-05")).toEqual([
      { from: "2026-09-01", to: "2026-09-05" },
    ]);
  });

  it("rend une liste vide pour une période à l'envers", () => {
    expect(reportWindows("2026-09-05", "2026-09-01")).toEqual([]);
  });
});

describe("dailyAdGroups", () => {
  it("traduit une ligne et écarte le groupe éteint", () => {
    const rows = dailyAdGroups(REPORT_ROWS);
    expect(rows).toEqual([
      {
        adgroupId: "1867090352310337",
        adgroupName: "INTEREST",
        campaignId: "1867090352305313",
        campaignName: "SP TT - 04/06 - CAMPAGNE DARK 2026",
        date: "2026-08-09",
        spend: 5.31,
        impressions: 17740,
        reach: 12472,
        clicks: 84,
        comments: 0,
        shares: 0,
        videoViews: 14669,
        videoCompletions: 39,
        landingPageViews: 60,
        purchases: 0,
        purchaseValue: 0,
      },
    ]);
  });

  it("lit « - » comme une absence et déduit la valeur des achats", () => {
    const [row] = dailyAdGroups([
      {
        metrics: {
          spend: "10.00",
          impressions: "100",
          complete_payment: "2",
          value_per_complete_payment: "24.95",
          total_landing_page_view: "-",
        },
        dimensions: { stat_time_day: "2026-08-01 00:00:00", adgroup_id: "42" },
      },
    ]);
    expect(row?.purchaseValue).toBe(49.9);
    expect(row?.landingPageViews).toBe(0);
    expect(row?.adgroupName).toBe("42");
  });
});

describe("toDailyMetricsColumns", () => {
  it("met les clics de destination dans clicks et link_clicks", () => {
    const [row] = dailyAdGroups(REPORT_ROWS);
    const columns = toDailyMetricsColumns(row!);
    expect(columns.clicks).toBe(84);
    expect(columns.link_clicks).toBe(84);
    expect(columns.video_views).toBe(14669);
    expect(columns.video_completions).toBe(39);
    expect(columns.saves).toBe(0);
  });
});

describe("entitiesFrom", () => {
  it("range la campagne au-dessus de son groupe d'annonces", () => {
    expect(entitiesFrom(dailyAdGroups(REPORT_ROWS))).toEqual([
      {
        level: "campaign",
        externalId: "1867090352305313",
        parentExternalId: null,
        name: "SP TT - 04/06 - CAMPAGNE DARK 2026",
      },
      {
        level: "adset",
        externalId: "1867090352310337",
        parentExternalId: "1867090352305313",
        name: "INTEREST",
      },
    ]);
  });
});

describe("ageLabel", () => {
  it("rend la tranche dans la forme de Meta", () => {
    expect(ageLabel("AGE_18_24")).toBe("18-24");
    expect(ageLabel("AGE_13_17")).toBe("13-17");
    expect(ageLabel("AGE_55_100")).toBe("55+");
    expect(ageLabel("NONE")).toBe("Inconnu");
  });
});

describe("genderLabel", () => {
  it("rend le libellé de Meta", () => {
    expect(genderLabel("FEMALE")).toBe("Femmes");
    expect(genderLabel("MALE")).toBe("Hommes");
    expect(genderLabel("NONE")).toBe("Inconnu");
  });
});

describe("audienceBreakdown", () => {
  it("somme par jour et par libellé, et écarte une case vide", () => {
    const rows: TiktokReportRow[] = [
      {
        dimensions: { gender: "NONE", stat_time_day: "2026-08-01 00:00:00" },
        metrics: { impressions: "184", clicks: "1", spend: "0.08" },
      },
      {
        dimensions: { gender: "FEMALE", stat_time_day: "2026-08-01 00:00:00" },
        metrics: { impressions: "46009", clicks: "246", spend: "15.85" },
      },
      {
        dimensions: { gender: "UNKNOWN", stat_time_day: "2026-08-01 00:00:00" },
        metrics: { impressions: "16", clicks: "0", spend: "0.00" },
      },
      {
        dimensions: { gender: "MALE", stat_time_day: "2026-08-02 00:00:00" },
        metrics: { impressions: "0", clicks: "0", spend: "0.00" },
      },
    ];
    expect(audienceBreakdown(rows, "gender")).toEqual([
      { date: "2026-08-01", value: "Inconnu", spend: 0.08, impressions: 200, clicks: 1 },
      { date: "2026-08-01", value: "Femmes", spend: 15.85, impressions: 46009, clicks: 246 },
    ]);
  });
});
