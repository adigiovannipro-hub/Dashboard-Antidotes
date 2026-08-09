import { describe, expect, it } from "vitest";

import {
  addMonths,
  installmentsFor,
  isDue,
  isLate,
  issueDateFor,
  lastMonthOf,
  monthsBetween,
  scheduleKpis,
  splitTotal,
  stageOf,
  totalsOf,
  ttcCentsOf,
  ttcTotalsOf,
} from "./schedule";

const NOW = new Date("2026-08-07T10:00:00.000Z");

describe("addMonths", () => {
  it("avance de mois en mois, année comprise", () => {
    expect(addMonths("2026-06-01", 1)).toBe("2026-07-01");
    expect(addMonths("2026-11-01", 3)).toBe("2027-02-01");
    expect(addMonths("2026-01-01", 0)).toBe("2026-01-01");
  });
});

describe("monthsBetween", () => {
  it("compte les mois bornes comprises", () => {
    expect(monthsBetween("2026-08-01", "2026-08-01")).toBe(1);
    expect(monthsBetween("2026-08-01", "2027-07-01")).toBe(12);
    expect(monthsBetween("2026-11-01", "2027-02-01")).toBe(4);
  });
});

describe("lastMonthOf", () => {
  it("retrouve le dernier mois de prestation", () => {
    expect(lastMonthOf({ first_month: "2026-08-01", months_count: 12 })).toBe(
      "2027-07-01",
    );
    expect(lastMonthOf({ first_month: "2026-08-01", months_count: 1 })).toBe(
      "2026-08-01",
    );
  });
});

describe("issueDateFor", () => {
  it("facture le lendemain de la fin du mois de prestation", () => {
    // La règle métier du module : juin se facture le 1er juillet.
    expect(issueDateFor("2026-06-01")).toBe("2026-07-01");
    expect(issueDateFor("2026-12-01")).toBe("2027-01-01");
  });
});

describe("splitTotal", () => {
  it("répartit au centime près, la somme vaut exactement le total", () => {
    expect(splitTotal(750_000, 3)).toEqual([250_000, 250_000, 250_000]);
    // 100 € sur 3 mois : le centime de reste va au premier mois.
    expect(splitTotal(10_000, 3)).toEqual([3_334, 3_333, 3_333]);
    expect(splitTotal(10_001, 3)).toEqual([3_334, 3_334, 3_333]);
  });

  it("ne produit jamais de mensualité négative, même sur un total dérisoire", () => {
    expect(splitTotal(1, 3)).toEqual([1, 0, 0]);
    expect(splitTotal(1, 3).reduce((sum, cents) => sum + cents, 0)).toBe(1);
  });
});

describe("ttcCentsOf", () => {
  it("calcule le TTC en entiers, sans centime fantôme", () => {
    // Les montants du board Monday : 2 102,50 € HT → 2 523,00 € TTC.
    expect(ttcCentsOf(210_250, 20)).toBe(252_300);
    expect(ttcCentsOf(250_000, 20)).toBe(300_000);
    expect(ttcCentsOf(170_000, 20)).toBe(204_000);
  });

  it("laisse le HT intact à TVA nulle", () => {
    expect(ttcCentsOf(210_250, 0)).toBe(210_250);
  });
});

describe("installmentsFor", () => {
  it("engendre une échéance par mois, la division au centime près", () => {
    const lines = installmentsFor({
      first_month: "2026-06-01",
      months_count: 3,
      total_amount_cents: 750_000,
      vat_rate: 20,
      currency: "EUR",
    });

    expect(lines).toEqual([
      { service_month: "2026-06-01", amount_cents: 250_000, vat_rate: 20, currency: "EUR", issue_on: "2026-07-01" },
      { service_month: "2026-07-01", amount_cents: 250_000, vat_rate: 20, currency: "EUR", issue_on: "2026-08-01" },
      { service_month: "2026-08-01", amount_cents: 250_000, vat_rate: 20, currency: "EUR", issue_on: "2026-09-01" },
    ]);
  });

  it("traverse un changement d'année sans se décaler", () => {
    const lines = installmentsFor({
      first_month: "2026-11-01",
      months_count: 4,
      total_amount_cents: 400_000,
      vat_rate: 20,
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

describe("stageOf", () => {
  it("dérive le groupe de l'écran du statut et du calendrier", () => {
    // La bascule « devis confirmé → à facturer » n'attend aucun traitement :
    // elle se produit d'elle-même au passage du 1er du mois.
    expect(stageOf({ status: "pending", issue_on: "2026-09-01", archived_at: null }, NOW)).toBe("confirmed");
    expect(stageOf({ status: "pending", issue_on: "2026-08-01", archived_at: null }, NOW)).toBe("to_invoice");
    expect(stageOf({ status: "issued", issue_on: "2026-08-01", archived_at: null }, NOW)).toBe("invoiced");
    expect(stageOf({ status: "paid", issue_on: "2026-07-01", archived_at: null }, NOW)).toBe("paid");
    expect(stageOf({ status: "paid", issue_on: "2026-05-01", archived_at: "2026-08-01T00:00:00Z" }, NOW)).toBe("archived");
    expect(stageOf({ status: "skipped", issue_on: "2026-08-01", archived_at: null }, NOW)).toBe("skipped");
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

describe("ttcTotalsOf", () => {
  it("totalise les TTC ligne à ligne, chacune avec son taux", () => {
    expect(
      ttcTotalsOf([
        { amount_cents: 210_250, vat_rate: 20, currency: "EUR" },
        { amount_cents: 50_000, vat_rate: 0, currency: "EUR" },
      ]),
    ).toEqual({ EUR: 252_300 + 50_000 });
  });
});

describe("scheduleKpis", () => {
  const lines = [
    // En retard : aurait dû partir le 1er août.
    { status: "pending", issue_on: "2026-08-01", amount_cents: 250_000, currency: "EUR", paid_at: null, archived_at: null },
    // Facturée : en attente de règlement.
    { status: "issued", issue_on: "2026-08-01", amount_cents: 180_000, currency: "EUR", paid_at: null, archived_at: null },
    // Payée ce mois-ci : encaissé du mois.
    { status: "paid", issue_on: "2026-07-01", amount_cents: 95_000, currency: "EUR", paid_at: "2026-08-05T09:00:00Z", archived_at: null },
    // Payée en juin : rien pour ce mois-ci.
    { status: "paid", issue_on: "2026-06-01", amount_cents: 70_000, currency: "EUR", paid_at: "2026-06-20T09:00:00Z", archived_at: null },
    // À venir le mois prochain : nulle part.
    { status: "pending", issue_on: "2026-09-01", amount_cents: 120_000, currency: "EUR", paid_at: null, archived_at: null },
  ] as const;

  it("répartit à facturer, retard, attente de paiement et encaissé du mois", () => {
    const kpis = scheduleKpis(lines, NOW);
    expect(kpis.toInvoice).toEqual({ count: 1, totals: { EUR: 250_000 } });
    expect(kpis.late).toEqual({ count: 1, totals: { EUR: 250_000 } });
    expect(kpis.awaitingPayment).toEqual({ count: 1, totals: { EUR: 180_000 } });
    expect(kpis.paidThisMonth).toEqual({ count: 1, totals: { EUR: 95_000 } });
  });
});
