import { describe, expect, it } from "vitest";

import {
  buildBalanceSeries,
  buildExpenseBuckets,
  seriesDelta,
  type SeriesExpense,
  type SeriesSnapshot,
} from "./series";

/** Instantané abrégé : `snap("a", "2026-08-05T10:00", 100)`. */
function snap(
  account: string,
  hourIso: string,
  cents: number,
): SeriesSnapshot {
  return {
    account_id: account,
    snapshot_hour: `${hourIso}:00.000Z`,
    available_cents: cents,
  };
}

const NOW = new Date("2026-08-05T12:30:00.000Z");

describe("buildBalanceSeries", () => {
  it("rend une série vide sans instantané", () => {
    expect(buildBalanceSeries([], 30, NOW)).toEqual([]);
  });

  it("prend un point par heure à 7 jours, un par jour au-delà", () => {
    const snapshots = [snap("a", "2026-08-05T10:00", 100)];
    const hourly = buildBalanceSeries(snapshots, 7, NOW);
    const daily = buildBalanceSeries(snapshots, 30, NOW);

    // 7 jours × 24 créneaux, moins ceux d'avant le premier instantané.
    expect(hourly.length).toBe(3); // 10 h, 11 h, 12 h
    expect(daily.length).toBe(1);
    expect(hourly.at(-1)!.total_cents).toBe(100);
  });

  it("reporte le dernier solde connu sur les créneaux sans instantané", () => {
    const snapshots = [
      snap("a", "2026-08-05T08:00", 500),
      // Rien à 9 h ni 10 h — cron en panne.
      snap("a", "2026-08-05T11:00", 800),
    ];
    const points = buildBalanceSeries(snapshots, 7, NOW);
    const values = points.map((point) => point.total_cents);

    // 8 h → 500, 9 h → 500 (report), 10 h → 500 (report), 11 h → 800, 12 h → 800.
    expect(values).toEqual([500, 500, 500, 800, 800]);
  });

  it("consolide plusieurs comptes, chacun à son dernier solde connu", () => {
    const snapshots = [
      snap("a", "2026-08-05T10:00", 1000),
      snap("b", "2026-08-05T10:00", 200),
      snap("a", "2026-08-05T12:00", 1100),
      // « b » n'a rien après 10 h : il reste compté à 200.
    ];
    const points = buildBalanceSeries(snapshots, 7, NOW);
    expect(points.at(-1)!.total_cents).toBe(1300);
  });

  it("n'invente pas de zéro avant le premier instantané", () => {
    const snapshots = [snap("a", "2026-08-05T11:00", 700)];
    const points = buildBalanceSeries(snapshots, 7, NOW);

    // Aucun point avant 11 h : la trésorerie n'était pas vide, elle était
    // inconnue.
    expect(points[0]!.time).toBe("2026-08-05T11:00:00.000Z");
  });

  it("prend le solde de fin de journée en granularité quotidienne", () => {
    const snapshots = [
      snap("a", "2026-08-04T09:00", 100),
      snap("a", "2026-08-04T18:00", 250),
      snap("a", "2026-08-05T06:00", 300),
    ];
    const points = buildBalanceSeries(snapshots, 30, NOW);

    // Le 4 août vaut son dernier instantané (18 h), pas celui du matin.
    expect(points.map((point) => point.total_cents)).toEqual([250, 300]);
  });

  it("ignore ce qui déborde de la fenêtre", () => {
    const snapshots = [
      snap("a", "2026-05-01T10:00", 42), // bien avant la fenêtre de 30 jours
      snap("a", "2026-08-05T10:00", 900),
    ];
    const points = buildBalanceSeries(snapshots, 30, NOW);

    // Le vieil instantané n'ajoute pas de point, mais il alimente le report :
    // la fenêtre ouvre sur 42, la journée du 5 finit à 900.
    expect(points[0]!.total_cents).toBe(42);
    expect(points.at(-1)!.total_cents).toBe(900);
    expect(points.length).toBe(30);
  });
});

describe("seriesDelta", () => {
  it("mesure la variation entre les deux bouts", () => {
    const points = [
      { time: "2026-08-01T00:00:00.000Z", total_cents: 1000 },
      { time: "2026-08-05T00:00:00.000Z", total_cents: 1450 },
    ];
    expect(seriesDelta(points)).toBe(450);
  });

  it("refuse de conclure sur moins de deux points", () => {
    expect(seriesDelta([])).toBeNull();
    expect(
      seriesDelta([{ time: "2026-08-01T00:00:00.000Z", total_cents: 5 }]),
    ).toBeNull();
  });
});

/** Dépense abrégée : `spend("2026-08-05T14:20", 773)`. */
function spend(
  iso: string,
  billingCents: number | null,
  billingCurrency: string | null = "EUR",
): SeriesExpense {
  return {
    occurred_at: `${iso}:00.000Z`,
    billing_amount_cents: billingCents,
    billing_currency: billingCurrency,
  };
}

describe("buildExpenseBuckets", () => {
  it("range les dépenses sur les créneaux horaires à 7 jours", () => {
    const buckets = buildExpenseBuckets(
      [spend("2026-08-05T10:15", 500), spend("2026-08-05T10:50", 300)],
      7,
      NOW,
    );

    // Même créneau : les deux s'additionnent sur le point de 10 h.
    expect(buckets["2026-08-05T10:00:00.000Z"]).toBe(800);
  });

  it("range les dépenses sur les créneaux quotidiens au-delà", () => {
    const buckets = buildExpenseBuckets(
      [spend("2026-08-05T10:15", 500), spend("2026-08-05T18:50", 300)],
      30,
      NOW,
    );

    expect(buckets["2026-08-05T00:00:00.000Z"]).toBe(800);
  });

  it("ne compte que les débits en euros", () => {
    const buckets = buildExpenseBuckets(
      [
        spend("2026-08-05T10:15", 500),
        // Une ligne débitée en dollars : rien ne dit combien elle a coûté en
        // euros, et aucun taux de change n'existe dans ce projet.
        spend("2026-08-05T10:20", 900, "USD"),
        // Débit pas encore fixé par Airwallex.
        spend("2026-08-05T10:30", null),
      ],
      7,
      NOW,
    );

    expect(buckets["2026-08-05T10:00:00.000Z"]).toBe(500);
  });

  it("ignore ce qui tombe hors de la fenêtre", () => {
    const buckets = buildExpenseBuckets(
      [spend("2026-05-01T10:15", 500), spend("2026-08-05T10:15", 700)],
      30,
      NOW,
    );

    expect(Object.keys(buckets)).toEqual(["2026-08-05T00:00:00.000Z"]);
  });

  it("aligne ses clés sur celles de la courbe du solde", () => {
    // C'est l'invariant qui fait tenir le graphe combiné : une dépense doit
    // pouvoir se poser sur un point de solde sans réalignement.
    const snapshots = [snap("a", "2026-08-05T09:00", 10_000)];
    const points = buildBalanceSeries(snapshots, 7, NOW);
    const buckets = buildExpenseBuckets([spend("2026-08-05T11:40", 250)], 7, NOW);

    const times = new Set(points.map((point) => point.time));
    for (const key of Object.keys(buckets)) {
      expect(times.has(key)).toBe(true);
    }
  });
});
