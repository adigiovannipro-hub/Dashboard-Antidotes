import { describe, expect, it } from "vitest";

import {
  addUtcDays,
  currentUtcMonth,
  decideRetrieval,
  isRetrievedThisMonth,
  retrievalCellState,
  sameUtcMonth,
  utcDay,
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
  session_encrypted: null,
  session_saved_at: null,
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

  it("rend faux sans date, ou sur une date illisible", () => {
    expect(sameUtcMonth(null, NOW)).toBe(false);
    expect(sameUtcMonth("pas-une-date", NOW)).toBe(false);
  });
});

describe("utcDay", () => {
  it("garde le jour UTC, pas celui du fuseau de la machine", () => {
    expect(utcDay(new Date("2026-08-31T23:30:00Z"))).toBe("2026-08-31");
  });
});

describe("addUtcDays", () => {
  it("passe le mois et l'année", () => {
    expect(addUtcDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addUtcDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addUtcDays("2026-09-15", 3)).toBe("2026-09-18");
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

describe("decideRetrieval", () => {
  it("ignore une fiche sans lien", () => {
    expect(
      decideRetrieval({ source: source({ source_link: null }), lastChargeAt: "2026-09-10T00:00:00Z", now: NOW }),
    ).toEqual({ due: false, reason: "no-link", dueOn: null });
  });

  it("écarte une fiche récupérée ce mois-ci", () => {
    expect(
      decideRetrieval({
        source: source({ retrieval_status: "done", auto_retrieved_at: "2026-09-11T08:00:00Z" }),
        lastChargeAt: "2026-09-10T00:00:00Z",
        now: NOW,
      }),
    ).toEqual({ due: false, reason: "done-this-month", dueOn: null });
  });

  it("attend le prélèvement du mois : rien à chercher avant", () => {
    expect(decideRetrieval({ source: source(), lastChargeAt: null, now: NOW })).toEqual({
      due: false,
      reason: "no-charge-this-month",
      dueOn: null,
    });
    expect(
      decideRetrieval({ source: source(), lastChargeAt: "2026-08-26T09:00:00Z", now: NOW }),
    ).toEqual({ due: false, reason: "no-charge-this-month", dueOn: null });
  });

  it("passe le lendemain du prélèvement, pas le jour même", () => {
    const charged = "2026-09-15T02:00:00Z";
    expect(decideRetrieval({ source: source(), lastChargeAt: charged, now: NOW })).toEqual({
      due: false,
      reason: "charge-too-recent",
      dueOn: "2026-09-16",
    });
    expect(
      decideRetrieval({ source: source(), lastChargeAt: charged, now: new Date("2026-09-16T09:00:00Z") }),
    ).toEqual({ due: true, reason: "due", dueOn: "2026-09-16" });
  });

  it("reste à faire tant que la facture n'est pas arrivée, jours après le prélèvement", () => {
    expect(
      decideRetrieval({ source: source(), lastChargeAt: "2026-09-02T09:00:00Z", now: NOW }).due,
    ).toBe(true);
  });

  it("une fiche récupérée le mois dernier se réarme avec le prélèvement du mois", () => {
    const done = source({ retrieval_status: "done", auto_retrieved_at: "2026-08-27T08:00:00Z" });
    expect(
      decideRetrieval({ source: done, lastChargeAt: "2026-09-10T00:00:00Z", now: NOW }).due,
    ).toBe(true);
  });

  it("après un échec, trois jours avant de réessayer", () => {
    const failed = source({ retrieval_status: "failed", updated_at: "2026-09-14T09:00:00Z" });
    expect(decideRetrieval({ source: failed, lastChargeAt: "2026-09-10T00:00:00Z", now: NOW })).toEqual({
      due: false,
      reason: "failed-recently",
      dueOn: "2026-09-17",
    });
    expect(
      decideRetrieval({
        source: failed,
        lastChargeAt: "2026-09-10T00:00:00Z",
        now: new Date("2026-09-17T09:00:00Z"),
      }).due,
    ).toBe(true);
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
