import { describe, expect, it } from "vitest";

import { groupInvoicesByClient, invoiceKpis, isOverdue } from "./invoices";
import type { FinanceInvoice } from "./types";

let sequence = 0;

function invoice(overrides: Partial<FinanceInvoice>): FinanceInvoice {
  sequence += 1;
  return {
    id: `inv-${sequence}`,
    org_id: "org",
    external_id: `ext-${sequence}`,
    client_name: "Bondet",
    client_external_id: null,
    amount_cents: 100_000,
    currency: "EUR",
    status: "sent",
    raw_status: null,
    issued_on: "2026-07-01",
    due_on: "2026-08-15",
    paid_at: null,
    raw: null,
    synced_at: "2026-08-05T00:00:00.000Z",
    created_at: "2026-08-05T00:00:00.000Z",
    updated_at: "2026-08-05T00:00:00.000Z",
    ...overrides,
  };
}

const TODAY = new Date("2026-08-05T10:00:00");

describe("isOverdue", () => {
  it("déclare en retard une facture envoyée à échéance dépassée", () => {
    expect(isOverdue(invoice({ due_on: "2026-08-04" }), TODAY)).toBe(true);
  });

  it("laisse sa journée à une facture qui échoit aujourd'hui", () => {
    expect(isOverdue(invoice({ due_on: "2026-08-05" }), TODAY)).toBe(false);
  });

  it("ne met jamais en retard une facture payée, brouillon ou annulée", () => {
    expect(isOverdue(invoice({ status: "paid", due_on: "2026-01-01" }), TODAY)).toBe(false);
    expect(isOverdue(invoice({ status: "draft", due_on: "2026-01-01" }), TODAY)).toBe(false);
    expect(isOverdue(invoice({ status: "void", due_on: "2026-01-01" }), TODAY)).toBe(false);
  });

  it("ne conclut rien d'une facture sans échéance", () => {
    expect(isOverdue(invoice({ due_on: null }), TODAY)).toBe(false);
  });
});

describe("invoiceKpis", () => {
  it("attend ce mois-ci les factures envoyées à échéance dans le mois", () => {
    const kpis = invoiceKpis(
      [
        invoice({ due_on: "2026-08-20", amount_cents: 250_000 }),
        invoice({ due_on: "2026-08-28", amount_cents: 100_000 }),
        invoice({ due_on: "2026-09-10", amount_cents: 999_999 }), // mois suivant
        invoice({ due_on: "2026-08-12", status: "paid", amount_cents: 50_000 }),
        invoice({ due_on: "2026-08-12", status: "draft", amount_cents: 50_000 }),
      ],
      TODAY,
    );
    expect(kpis.expected_this_month).toEqual({ EUR: 350_000 });
  });

  it("cumule le retard toutes échéances confondues, par devise", () => {
    const kpis = invoiceKpis(
      [
        invoice({ due_on: "2026-08-01", amount_cents: 100_000 }),
        invoice({ due_on: "2026-06-15", amount_cents: 40_000 }),
        invoice({ due_on: "2026-07-30", amount_cents: 5_000, currency: "USD" }),
        invoice({ due_on: "2026-08-20", amount_cents: 77_000 }), // pas encore due
      ],
      TODAY,
    );
    expect(kpis.overdue).toEqual({ EUR: 140_000, USD: 5_000 });
  });
});

describe("groupInvoicesByClient", () => {
  it("groupe par client, plus gros encours en tête, échéances croissantes", () => {
    const groups = groupInvoicesByClient([
      invoice({ client_name: "Silmo", amount_cents: 80_000, due_on: "2026-09-01" }),
      invoice({ client_name: "Bondet", amount_cents: 300_000, due_on: "2026-08-20" }),
      invoice({ client_name: "Bondet", amount_cents: 120_000, due_on: "2026-08-10" }),
      invoice({ client_name: "Silmo", status: "paid", amount_cents: 999_000 }),
    ]);

    expect(groups.map((group) => group.client_name)).toEqual(["Bondet", "Silmo"]);
    // Une facture payée ne pèse plus dans l'encours…
    expect(groups[1]!.open_totals).toEqual({ EUR: 80_000 });
    // …mais reste visible dans la liste du client.
    expect(groups[1]!.invoices.length).toBe(2);
    // Échéances croissantes chez Bondet.
    expect(groups[0]!.invoices.map((entry) => entry.due_on)).toEqual([
      "2026-08-10",
      "2026-08-20",
    ]);
  });
});
