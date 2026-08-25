import { describe, expect, it } from "vitest";

import {
  breakdownRows,
  dailyRows,
  gaDay,
  gaMonth,
  monthWindow,
  monthsCovering,
  monthlyRows,
  pageRows,
  webSyncWindow,
} from "./mapping";
import type { GaRunReportResponse } from "./types";

const report = (
  rows: { dims: string[]; metrics: (number | string)[] }[],
): GaRunReportResponse => ({
  rows: rows.map((row) => ({
    dimensionValues: row.dims.map((value) => ({ value })),
    metricValues: row.metrics.map((value) => ({ value: String(value) })),
  })),
  rowCount: rows.length,
});

describe("gaDay", () => {
  it("convertit la date compacte de GA en ISO", () => {
    expect(gaDay("20260718")).toBe("2026-07-18");
  });

  it("refuse ce qui n'a pas la forme attendue", () => {
    expect(gaDay("2026-07-18")).toBeNull();
    expect(gaDay("(other)")).toBeNull();
  });
});

describe("gaMonth", () => {
  it("cale le mois au 1ᵉʳ, convention de la maison", () => {
    expect(gaMonth("202607")).toBe("2026-07-01");
  });

  it("refuse ce qui n'a pas la forme attendue", () => {
    expect(gaMonth("2026")).toBeNull();
  });
});

describe("dailyRows", () => {
  it("stocke la durée cumulée, jamais la moyenne", () => {
    // 30,43 s de moyenne sur 700 sessions → 21 301 s cumulées : c'est la
    // seule forme qui se somme sans donner à un jour creux le poids d'un
    // jour plein.
    const rows = dailyRows(
      report([{ dims: ["20260718"], metrics: [616, 700, 82, 801, "30.43"] }]),
    );

    expect(rows).toEqual([
      {
        date: "2026-07-18",
        total_users: 616,
        sessions: 700,
        engaged_sessions: 82,
        page_views: 801,
        session_seconds: 21301,
      },
    ]);
  });

  it("ignore une ligne dont la date ne se lit pas, sans faire tomber le reste", () => {
    const rows = dailyRows(
      report([
        { dims: ["(other)"], metrics: [1, 1, 1, 1, 1] },
        { dims: ["20260719"], metrics: [2, 2, 2, 2, 2] },
      ]),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.date).toBe("2026-07-19");
  });

  it("traite une métrique absente comme zéro, jamais comme NaN", () => {
    const rows = dailyRows(report([{ dims: ["20260720"], metrics: [5] }]));

    expect(rows[0]?.sessions).toBe(0);
    expect(rows[0]?.session_seconds).toBe(0);
  });
});

describe("monthlyRows", () => {
  it("lit les uniques dédoublonnés du mois", () => {
    const rows = monthlyRows(report([{ dims: ["202607"], metrics: [16433, 15863] }]));

    expect(rows).toEqual([
      { month: "2026-07-01", total_users: 16433, new_users: 15863 },
    ]);
  });
});

describe("breakdownRows", () => {
  it("garde la valeur telle que GA la rend, « (not set) » compris", () => {
    const rows = breakdownRows(
      report([
        { dims: ["202607", "tiktok"], metrics: [9000, 11353] },
        { dims: ["202607", "(not set)"], metrics: [3024, 3100] },
      ]),
      "source",
    );

    expect(rows).toEqual([
      { month: "2026-07-01", type: "source", value: "tiktok", users: 9000, sessions: 11353 },
      { month: "2026-07-01", type: "source", value: "(not set)", users: 3024, sessions: 3100 },
    ]);
  });

  it("écarte une valeur vide — une clé primaire ne se remplit pas de vide", () => {
    const rows = breakdownRows(
      report([{ dims: ["202607", ""], metrics: [1, 1] }]),
      "city",
    );

    expect(rows).toEqual([]);
  });
});

describe("pageRows", () => {
  it("associe chaque métrique à sa colonne, durée cumulée comprise", () => {
    const rows = pageRows(
      report([
        { dims: ["202607", "/accue/la-meunerie/"], metrics: [854, 772, 672, "90.46"] },
      ]),
    );

    expect(rows).toEqual([
      {
        month: "2026-07-01",
        path: "/accue/la-meunerie/",
        views: 854,
        sessions: 772,
        engaged_sessions: 672,
        session_seconds: 69835.12,
      },
    ]);
  });
});

describe("monthsCovering", () => {
  it("liste les mois civils touchés par la fenêtre, bornes comprises", () => {
    expect(monthsCovering("2026-05-20", "2026-07-03")).toEqual([
      "2026-05-01",
      "2026-06-01",
      "2026-07-01",
    ]);
  });

  it("rend le seul mois d'une fenêtre qui n'en sort pas", () => {
    expect(monthsCovering("2026-07-02", "2026-07-28")).toEqual(["2026-07-01"]);
  });
});

describe("monthWindow", () => {
  it("rend les bornes incluses du mois, février bissextile compris", () => {
    expect(monthWindow("2024-02-01")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(monthWindow("2026-07-01")).toEqual({ from: "2026-07-01", to: "2026-07-31" });
  });
});

describe("webSyncWindow", () => {
  const now = new Date("2026-08-25T05:00:00Z");

  it("couvre huit jours glissants en régime de croisière", () => {
    expect(
      webSyncWindow({ lastSyncAt: "2026-08-24T05:00:00Z", backfillFrom: "2024-02-01", now }),
    ).toEqual({ since: "2026-08-17", until: "2026-08-25" });
  });

  it("rattrape toute l'histoire au premier passage", () => {
    expect(
      webSyncWindow({ lastSyncAt: null, backfillFrom: "2024-02-01", now }),
    ).toEqual({ since: "2024-02-01", until: "2026-08-25" });
  });

  it("laisse l'écran étendre la fenêtre, jamais la raccourcir", () => {
    expect(
      webSyncWindow({
        lastSyncAt: "2026-08-24T05:00:00Z",
        backfillFrom: "2024-02-01",
        now,
        atLeastSince: "2025-07-01",
      }),
    ).toEqual({ since: "2025-07-01", until: "2026-08-25" });

    expect(
      webSyncWindow({
        lastSyncAt: "2026-08-24T05:00:00Z",
        backfillFrom: "2024-02-01",
        now,
        atLeastSince: "2026-08-24",
      }).since,
    ).toBe("2026-08-17");
  });
});
