import { describe, expect, it } from "vitest";

import type {
  WebBreakdownMonthly,
  WebMetricsDaily,
  WebPageMonthly,
} from "@/lib/supabase/database.types";
import {
  alignedDailySeries,
  averageSessionSeconds,
  bounceRate,
  foldBreakdown,
  foldPages,
  fullMonthsOf,
  sourcesByMonth,
  sumWebDaily,
  totalsForRange,
  webDelta,
} from "./data";

const daily = (partial: Partial<WebMetricsDaily> & { date: string }): WebMetricsDaily => ({
  data_source_id: "source",
  workspace_id: "espace",
  total_users: 0,
  sessions: 0,
  engaged_sessions: 0,
  page_views: 0,
  session_seconds: 0,
  updated_at: "2026-08-25T00:00:00Z",
  ...partial,
});

const breakdown = (
  partial: Partial<WebBreakdownMonthly> & {
    month: string;
    type: WebBreakdownMonthly["type"];
    value: string;
  },
): WebBreakdownMonthly => ({
  data_source_id: "source",
  workspace_id: "espace",
  users: 0,
  sessions: 0,
  updated_at: "2026-08-25T00:00:00Z",
  ...partial,
});

const page = (
  partial: Partial<WebPageMonthly> & { month: string; path: string },
): WebPageMonthly => ({
  data_source_id: "source",
  workspace_id: "espace",
  views: 0,
  sessions: 0,
  engaged_sessions: 0,
  session_seconds: 0,
  updated_at: "2026-08-25T00:00:00Z",
  ...partial,
});

describe("sumWebDaily", () => {
  it("somme les seules grandeurs additives", () => {
    const total = sumWebDaily([
      daily({ date: "2026-07-01", sessions: 100, engaged_sessions: 10, session_seconds: 500 }),
      daily({ date: "2026-07-02", sessions: 50, engaged_sessions: 5, session_seconds: 250.5 }),
    ]);

    expect(total.sessions).toBe(150);
    expect(total.engagedSessions).toBe(15);
    expect(total.sessionSeconds).toBe(750.5);
  });
});

describe("fullMonthsOf", () => {
  it("reconnaît un mois civil entier", () => {
    expect(fullMonthsOf({ from: "2026-07-01", to: "2026-07-31" })).toEqual([
      "2026-07-01",
    ]);
  });

  it("reconnaît plusieurs mois entiers d'affilée", () => {
    expect(fullMonthsOf({ from: "2026-05-01", to: "2026-07-31" })).toEqual([
      "2026-05-01",
      "2026-06-01",
      "2026-07-01",
    ]);
  });

  it("refuse une plage qui entame un mois", () => {
    expect(fullMonthsOf({ from: "2026-07-02", to: "2026-07-31" })).toBeNull();
    expect(fullMonthsOf({ from: "2026-07-01", to: "2026-07-30" })).toBeNull();
  });
});

describe("totalsForRange", () => {
  const monthly = [
    {
      data_source_id: "source",
      workspace_id: "espace",
      month: "2026-07-01",
      total_users: 16433,
      new_users: 15863,
      sessions: 18005,
      engaged_sessions: 2099,
      page_views: 20611,
      session_seconds: 547892.15,
      updated_at: "2026-08-25T00:00:00Z",
    },
  ];
  const dailySums = {
    users: 17685,
    sessions: 18084,
    engagedSessions: 2110,
    pageViews: 20611,
    sessionSeconds: 548000,
  };

  it("rend les totaux du rapport GA sur un mois civil entier", () => {
    // 16 433 utilisateurs et 18 005 sessions : les chiffres que le client
    // lisait dans Looker — pas les sommes quotidiennes, que GA gonfle en
    // recoupant à minuit et en recomptant un visiteur revenu deux jours.
    const { totals, exact, monthCount } = totalsForRange({
      range: { from: "2026-07-01", to: "2026-07-31" },
      monthly,
      daily: dailySums,
    });

    expect(exact).toBe(true);
    expect(monthCount).toBe(1);
    expect(totals.users).toBe(16433);
    expect(totals.sessions).toBe(18005);
  });

  it("retombe sur les sommes quotidiennes pour une plage libre", () => {
    const { totals, exact } = totalsForRange({
      range: { from: "2026-07-10", to: "2026-07-24" },
      monthly,
      daily: dailySums,
    });

    expect(exact).toBe(false);
    expect(totals).toEqual(dailySums);
  });

  it("retombe sur les sommes quand un mois demandé manque en base", () => {
    // Mieux vaut un chiffre approché qu'un exact tronqué d'un mois.
    const { exact } = totalsForRange({
      range: { from: "2026-06-01", to: "2026-07-31" },
      monthly,
      daily: dailySums,
    });
    expect(exact).toBe(false);
  });

  it("ignore une ligne mensuelle d'avant 0062, qui n'a pas ses totaux", () => {
    // Une ligne à zéro session mais pleine d'utilisateurs vient du schéma
    // d'avant : la prendre pour exacte afficherait « 0 session » pour un
    // mois plein.
    const { exact } = totalsForRange({
      range: { from: "2026-07-01", to: "2026-07-31" },
      monthly: [{ ...monthly[0]!, sessions: 0, engaged_sessions: 0 }],
      daily: dailySums,
    });
    expect(exact).toBe(false);
  });
});

describe("bounceRate et averageSessionSeconds", () => {
  it("recalcule depuis les agrégats, jamais une moyenne de moyennes", () => {
    const totals = sumWebDaily([
      daily({ date: "2026-07-01", sessions: 18005, engaged_sessions: 2099, session_seconds: 547952 }),
    ]);

    expect(bounceRate(totals)).toBeCloseTo(0.8834, 3);
    expect(averageSessionSeconds(totals)).toBeCloseTo(30.43, 1);
  });

  it("rend null sans session — jamais un zéro qui se lirait comme une mesure", () => {
    expect(bounceRate({ ...sumWebDaily([]) })).toBeNull();
    expect(averageSessionSeconds({ ...sumWebDaily([]) })).toBeNull();
  });
});

describe("webDelta", () => {
  it("juge selon le sens métier : un rebond qui baisse est une bonne nouvelle", () => {
    expect(webDelta(0.8, 0.9, "down-good").sentiment).toBe("positive");
    expect(webDelta(500, 400, "up-good").sentiment).toBe("positive");
    expect(webDelta(400, 500, "up-good").sentiment).toBe("negative");
  });

  it("reste neutre sans comparaison possible", () => {
    expect(webDelta(10, null, "up-good")).toEqual({ ratio: null, sentiment: "neutral" });
    expect(webDelta(10, 0, "up-good")).toEqual({ ratio: null, sentiment: "neutral" });
  });
});

describe("alignedDailySeries", () => {
  it("aligne par rang dans la plage, pas par quantième", () => {
    const points = alignedDailySeries({
      range: { from: "2026-07-01", to: "2026-07-03" },
      previousRange: { from: "2025-07-01", to: "2025-07-03" },
      current: [
        daily({ date: "2026-07-01", sessions: 100 }),
        daily({ date: "2026-07-03", sessions: 300 }),
      ],
      previous: [daily({ date: "2025-07-02", sessions: 50 })],
      value: (row) => row.sessions,
    });

    expect(points).toEqual([
      { label: "01/07", value: 100, previous: null },
      { label: "02/07", value: null, previous: 50 },
      { label: "03/07", value: 300, previous: null },
    ]);
  });
});

describe("foldBreakdown", () => {
  it("replie la queue en « Autres » et sort « Indéterminé » de l'échelle", () => {
    const rows = [
      breakdown({ month: "2026-07-01", type: "city", value: "Paris", users: 2193 }),
      breakdown({ month: "2026-07-01", type: "city", value: "Marseille", users: 429 }),
      breakdown({ month: "2026-07-01", type: "city", value: "Lyon", users: 390 }),
      breakdown({ month: "2026-07-01", type: "city", value: "(not set)", users: 3024 }),
      // Une ventilation d'un autre type ne doit jamais fuiter dans celle-ci.
      breakdown({ month: "2026-07-01", type: "device", value: "mobile", users: 9999 }),
    ];

    const folded = foldBreakdown(rows, "city", { cap: 2 });

    expect(folded.map((item) => item.label)).toEqual([
      "Indéterminé",
      "Paris",
      "Autres",
    ]);
    expect(folded.find((item) => item.label === "Indéterminé")?.outOfScale).toBe(true);
    expect(folded.find((item) => item.label === "Autres")?.value).toBe(429 + 390);
    const shares = folded.reduce((sum, item) => sum + item.share, 0);
    expect(shares).toBeCloseTo(1, 5);
  });

  it("somme un même découpage sur plusieurs mois", () => {
    const rows = [
      breakdown({ month: "2026-06-01", type: "retention", value: "new", users: 10000 }),
      breakdown({ month: "2026-07-01", type: "retention", value: "new", users: 15863 }),
      breakdown({ month: "2026-07-01", type: "retention", value: "returning", users: 373 }),
    ];

    const folded = foldBreakdown(rows, "retention");
    expect(folded.find((item) => item.label === "Nouveaux")?.value).toBe(25863);
  });
});

describe("sourcesByMonth", () => {
  it("garde les plus grosses sources de la fenêtre et replie le reste", () => {
    const rows = [
      breakdown({ month: "2026-06-01", type: "source", value: "tiktok", sessions: 9000 }),
      breakdown({ month: "2026-07-01", type: "source", value: "tiktok", sessions: 11353 }),
      breakdown({ month: "2026-07-01", type: "source", value: "fb", sessions: 4309 }),
      breakdown({ month: "2026-07-01", type: "source", value: "google", sessions: 318 }),
      breakdown({ month: "2026-07-01", type: "source", value: "ig", sessions: 589 }),
    ];

    const chart = sourcesByMonth(rows, { cap: 3 });

    expect(chart.sources).toEqual(["tiktok", "fb", "ig", "Autres"]);
    expect(chart.months.map((month) => month.label)).toEqual([
      "juin 2026",
      "juil. 2026",
    ]);
    expect(chart.months[1]?.values).toEqual({
      tiktok: 11353,
      fb: 4309,
      ig: 589,
      Autres: 318,
    });
    // Un mois sans la source la porte à zéro : les barres restent empilables.
    expect(chart.months[0]?.values).toEqual({ tiktok: 9000, fb: 0, ig: 0, Autres: 0 });
  });
});

describe("foldPages", () => {
  it("agrège par chemin et recalcule les taux depuis les agrégats", () => {
    const { pages, total } = foldPages([
      page({ month: "2026-06-01", path: "/", views: 100, sessions: 100, engaged_sessions: 10, session_seconds: 1000 }),
      page({ month: "2026-07-01", path: "/", views: 200, sessions: 100, engaged_sessions: 30, session_seconds: 3000 }),
      page({ month: "2026-07-01", path: "/contact/", views: 50, sessions: 40, engaged_sessions: 40, session_seconds: 4000 }),
    ]);

    expect(pages[0]?.path).toBe("/");
    expect(pages[0]?.views).toBe(300);
    expect(pages[0]?.bounceRate).toBeCloseTo(1 - 40 / 200, 5);
    expect(pages[0]?.averageSeconds).toBeCloseTo(20, 5);

    expect(total.views).toBe(350);
    expect(total.bounceRate).toBeCloseTo(1 - 80 / 240, 5);
  });

  it("rend null plutôt qu'un taux sur zéro session", () => {
    const { pages } = foldPages([page({ month: "2026-07-01", path: "/mort/", views: 3 })]);
    expect(pages[0]?.bounceRate).toBeNull();
    expect(pages[0]?.averageSeconds).toBeNull();
  });
});
