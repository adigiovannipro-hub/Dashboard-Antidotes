import { describe, expect, it } from "vitest";

import {
  currentUtcMonth,
  isDueForRetrieval,
  isRetrievedThisMonth,
  retrievalCellState,
  sameUtcMonth,
} from "./retrieval";
import type { FinanceRetrievalSource } from "./types";

const NOW = new Date("2026-09-15T10:00:00Z");

const source = (overrides: Partial<FinanceRetrievalSource> = {}): FinanceRetrievalSource => ({
  id: "src-1",
  org_id: "org-1",
  merchant_key: "adobe",
  merchant_label: "Adobe",
  source_link: "https://account.adobe.com/orders/billing-history",
  retrieval_status: "pending",
  auto_retrieved_at: null,
  last_error: null,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  ...overrides,
});

describe("sameUtcMonth", () => {
  it("reconnaît deux instants du même mois", () => {
    expect(sameUtcMonth("2026-09-01T00:00:00Z", NOW)).toBe(true);
    expect(sameUtcMonth("2026-09-30T23:59:59Z", NOW)).toBe(true);
  });

  it("distingue le mois précédent et l'année précédente", () => {
    expect(sameUtcMonth("2026-08-31T23:59:59Z", NOW)).toBe(false);
    expect(sameUtcMonth("2025-09-15T10:00:00Z", NOW)).toBe(false);
  });

  it("juge en UTC : le 31 août à 23 h à Paris est encore août", () => {
    // 2026-08-31T23:30 Paris = 2026-08-31T21:30Z — août, pas septembre.
    expect(sameUtcMonth("2026-08-31T21:30:00Z", NOW)).toBe(false);
  });

  it("rend faux sans date, ou sur une date illisible", () => {
    expect(sameUtcMonth(null, NOW)).toBe(false);
    expect(sameUtcMonth("pas-une-date", NOW)).toBe(false);
  });
});

describe("isRetrievedThisMonth", () => {
  it("exige à la fois le statut « done » et une date du mois", () => {
    expect(
      isRetrievedThisMonth(
        source({ retrieval_status: "done", auto_retrieved_at: "2026-09-03T08:00:00Z" }),
        NOW,
      ),
    ).toBe(true);
    expect(
      isRetrievedThisMonth(
        source({ retrieval_status: "pending", auto_retrieved_at: "2026-09-03T08:00:00Z" }),
        NOW,
      ),
    ).toBe(false);
    expect(
      isRetrievedThisMonth(
        source({ retrieval_status: "done", auto_retrieved_at: "2026-08-03T08:00:00Z" }),
        NOW,
      ),
    ).toBe(false);
  });
});

describe("isDueForRetrieval", () => {
  it("ignore une fiche sans lien", () => {
    expect(isDueForRetrieval(source({ source_link: null }), NOW)).toBe(false);
  });

  it("retient une fiche en attente, et une fiche en échec", () => {
    expect(isDueForRetrieval(source(), NOW)).toBe(true);
    expect(isDueForRetrieval(source({ retrieval_status: "failed" }), NOW)).toBe(true);
  });

  it("écarte une fiche récupérée ce mois-ci, la reprend le mois suivant", () => {
    const done = source({ retrieval_status: "done", auto_retrieved_at: "2026-09-03T08:00:00Z" });
    expect(isDueForRetrieval(done, NOW)).toBe(false);
    expect(isDueForRetrieval(done, new Date("2026-10-01T00:00:00Z"))).toBe(true);
  });
});

describe("retrievalCellState", () => {
  it("sans fiche ni lien : « none »", () => {
    expect(retrievalCellState(null, NOW)).toEqual({ kind: "none" });
    expect(retrievalCellState(source({ source_link: null }), NOW)).toEqual({ kind: "none" });
  });

  it("lien posé, rien reçu : « pending » avec le lien", () => {
    expect(retrievalCellState(source(), NOW)).toEqual({
      kind: "pending",
      link: "https://account.adobe.com/orders/billing-history",
    });
  });

  it("récupérée ce mois-ci : « done » daté", () => {
    expect(
      retrievalCellState(
        source({ retrieval_status: "done", auto_retrieved_at: "2026-09-03T08:00:00Z" }),
        NOW,
      ),
    ).toEqual({
      kind: "done",
      link: "https://account.adobe.com/orders/billing-history",
      retrievedAt: "2026-09-03T08:00:00Z",
    });
  });

  it("récupérée le mois dernier : le bouton se réarme, « pending »", () => {
    expect(
      retrievalCellState(
        source({ retrieval_status: "done", auto_retrieved_at: "2026-08-03T08:00:00Z" }),
        NOW,
      ).kind,
    ).toBe("pending");
  });

  it("en échec : « failed » avec la cause", () => {
    expect(
      retrievalCellState(
        source({ retrieval_status: "failed", last_error: "Session Adobe expirée" }),
        NOW,
      ),
    ).toEqual({
      kind: "failed",
      link: "https://account.adobe.com/orders/billing-history",
      error: "Session Adobe expirée",
    });
  });
});

describe("currentUtcMonth", () => {
  it("formate AAAA-MM avec le zéro de tête", () => {
    expect(currentUtcMonth(NOW)).toBe("2026-09");
    expect(currentUtcMonth(new Date("2026-01-31T23:00:00Z"))).toBe("2026-01");
  });
});
