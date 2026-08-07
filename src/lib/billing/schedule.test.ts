import { describe, expect, it } from "vitest";

import {
  addMonths,
  installmentsFor,
  isDue,
  isLate,
  issueDateFor,
  scheduleKpis,
  totalsOf,
} from "./schedule";

const NOW = new Date("2026-08-07T10:00:00.000Z");

describe("addMonths", () => {
  it("avance de mois en mois, année comprise", () => {
    expect(addMonths("2026-06-01", 1)).toBe("2026-07-01");
    expect(addMonths("2026-11-01", 3)).toBe("2027-02-01");
    expect(addMonths("2026-01-01", 0)).toBe("2026-01-01");
  });
});

describe("issueDateFor", () => {
  it("facture le lendemain de la fin du mois de prestation", () => {
    // La règle métier du module : juin se facture le 1er juillet.
    expect(issueDateFor("2026-06-01")).toBe("2026-07-01");
    expect(issueDateFor("2026-12-01")).toBe("2027-01-01");
  });
});

describe("installmentsFor", () => {
  it("engendre une échéance par mois de prestation", () => {
    const lines = installmentsFor({
      first_month: "2026-06-01",
      months_count: 3,
      monthly_amount_cents: 250_000,
      currency: "EUR",
    });

    expect(lines).toEqual([
      { service_month: "2026-06-01", amount_cents: 250_000, currency: "EUR", issue_on: "2026-07-01" },
      { service_month: "2026-07-01", amount_cents: 250_000, currency: "EUR", issue_on: "2026-08-01" },
      { service_month: "2026-08-01", amount_cents: 250_000, currency: "EUR", issue_on: "2026-09-01" },
    ]);
  });

  it("traverse un changement d'année sans se décaler", () => {
    const lines = installmentsFor({
      first_month: "2026-11-01",
      months_count: 4,
      monthly_amount_cents: 100_000,
      currency: "EUR",
    });
    expect(lines.map((line) => line.issue_on)).toEqual([
      "2026-12-01",
      "2027-01-01",
      "2027-02-01",
      "2027-03-01",
    ]);
  });
});

describe("isDue", () => {
  it("est due dès le jour d'émission, plus après émission", () => {
    expect(isDue({ status: "pending", issue_on: "2026-08-07" }, NOW)).toBe(true);
    expect(isDue({ status: "pending", issue_on: "2026-08-01" }, NOW)).toBe(true);
    expect(isDue({ status: "pending", issue_on: "2026-09-01" }, NOW)).toBe(false);
    expect(isDue({ status: "issued", issue_on: "2026-08-01" }, NOW)).toBe(false);
  });
});

describe("isLate", () => {
  it("distingue le jour même du jour dépassé", () => {
    // Émettre aujourd'hui est normal ; hier, c'est un retard.
    expect(isLate({ status: "pending", issue_on: "2026-08-07" }, NOW)).toBe(false);
    expect(isLate({ status: "pending", issue_on: "2026-08-06" }, NOW)).toBe(true);
    expect(isLate({ status: "skipped", issue_on: "2026-08-01" }, NOW)).toBe(false);
  });
});

describe("totalsOf", () => {
  it("totalise par devise, jamais entre devises", () => {
    expect(
      totalsOf([
        { amount_cents: 100, currency: "EUR" },
        { amount_cents: 50, currency: "EUR" },
        { amount_cents: 900, currency: "USD" },
      ]),
    ).toEqual({ EUR: 150, USD: 900 });
  });
});

describe("scheduleKpis", () => {
  const lines = [
    // En retard : aurait dû partir le 1er août.
    { status: "pending", issue_on: "2026-08-01", amount_cents: 250_000, currency: "EUR" },
    // Émise dans le mois : compte dans le mois, pas dans le dû.
    { status: "issued", issue_on: "2026-08-01", amount_cents: 180_000, currency: "EUR" },
    // Passée : nulle part.
    { status: "skipped", issue_on: "2026-08-01", amount_cents: 95_000, currency: "EUR" },
    // À venir le mois prochain : nulle part ce mois-ci.
    { status: "pending", issue_on: "2026-09-01", amount_cents: 120_000, currency: "EUR" },
  ] as const;

  it("répartit dû, retard et mois en cours", () => {
    const kpis = scheduleKpis(lines, NOW);
    expect(kpis.due).toEqual({ count: 1, totals: { EUR: 250_000 } });
    expect(kpis.late).toEqual({ count: 1, totals: { EUR: 250_000 } });
    expect(kpis.thisMonth).toEqual({ count: 2, totals: { EUR: 430_000 } });
  });
});
