import { describe, expect, it } from "vitest";

import {
  mapInvoiceStatus,
  normalizeBalance,
  normalizeFinanceExpense,
  normalizeInvoice,
} from "./normalize";

describe("normalizeBalance", () => {
  it("convertit un solde décimal en centimes", () => {
    expect(
      normalizeBalance({
        currency: "EUR",
        available_amount: 12_400.55,
        pending_amount: 120,
        reserved_amount: 0,
      }),
    ).toEqual({
      currency: "EUR",
      available_cents: 1_240_055,
      pending_cents: 12_000,
      reserved_cents: 0,
    });
  });

  it("refuse un solde sans devise ou sans montant", () => {
    expect(normalizeBalance({ available_amount: 10 })).toBeNull();
    expect(normalizeBalance({ currency: "EUR" })).toBeNull();
  });
});

describe("normalizeFinanceExpense", () => {
  const grab = {
    id: "exp_123",
    transaction_amount: 158_800,
    transaction_currency: "IDR",
    billing_amount: 7.73,
    billing_currency: "EUR",
    transaction_time: "2026-08-05T06:32:00Z",
    merchant: { name: "Grab", description: "Grab* A-9MXOR7UGWAE9AV, IDN" },
    category: "Transports",
    status: "incomplete",
    card: { last_four: "0162" },
    attachments: [],
  };

  it("conserve les deux montants, local et débité", () => {
    const normalized = normalizeFinanceExpense(grab);
    expect(normalized).toMatchObject({
      external_id: "exp_123",
      amount_cents: 15_880_000,
      currency: "IDR",
      billing_amount_cents: 773,
      billing_currency: "EUR",
      merchant: "Grab",
      merchant_raw: "Grab* A-9MXOR7UGWAE9AV, IDN",
      has_receipt: false,
    });
  });

  it("lit le montant local sous card_transaction sur une dépense DRAFT", () => {
    // Le brut réel du 7 août : tant que la dépense est DRAFT, la racine ne
    // porte que le débit EUR — le local (IDR) vit sous `card_transaction`,
    // et `merchant` est une chaîne nue, pas un objet.
    const normalized = normalizeFinanceExpense({
      id: "exp_draft",
      status: "DRAFT",
      merchant: "Grab",
      billing_amount: "7.56",
      billing_currency: "EUR",
      card_transaction: {
        amount: "154400.00",
        currency: "IDR",
        status: "AUTHORIZED",
      },
      line_items: [{ transaction_amount: "154400.00" }],
      created_at: "2026-08-07T05:00:00Z",
    });
    expect(normalized).toMatchObject({
      amount_cents: 15_440_000,
      currency: "IDR",
      billing_amount_cents: 756,
      billing_currency: "EUR",
      merchant: "Grab",
    });
  });

  it("se rabat sur le montant débité quand le local manque", () => {
    const normalized = normalizeFinanceExpense({
      id: "exp_9",
      billing_amount: 9.99,
      billing_currency: "EUR",
      created_at: "2026-08-05T08:00:00Z",
    });
    expect(normalized?.amount_cents).toBe(999);
    expect(normalized?.currency).toBe("EUR");
  });

  it("compte un justificatif présent depuis les pièces jointes ou le compteur", () => {
    expect(
      normalizeFinanceExpense({ ...grab, attachments: [{ id: "a" }] })?.has_receipt,
    ).toBe(true);
    const viaCount = { ...grab, attachments: undefined, receipt_count: 2 };
    expect(normalizeFinanceExpense(viaCount)?.has_receipt).toBe(true);
  });

  it("rejette une ligne sans identifiant, montant, devise ou date", () => {
    expect(normalizeFinanceExpense({ ...grab, id: undefined })).toBeNull();
    expect(
      normalizeFinanceExpense({ id: "x", transaction_currency: "IDR" }),
    ).toBeNull();
    expect(
      normalizeFinanceExpense({
        id: "x",
        transaction_amount: 5,
        transaction_currency: "IDR",
      }),
    ).toBeNull();
  });
});

describe("mapInvoiceStatus", () => {
  it("ramène le vocabulaire Airwallex sur nos quatre états", () => {
    expect(mapInvoiceStatus("SENT")).toBe("sent");
    expect(mapInvoiceStatus("OVERDUE")).toBe("sent"); // le retard se dérive
    expect(mapInvoiceStatus("PAID")).toBe("paid");
    expect(mapInvoiceStatus("VOIDED")).toBe("void");
    expect(mapInvoiceStatus("DRAFT")).toBe("draft");
  });

  it("classe l'inconnu en brouillon — le seul état qui ne pèse nulle part", () => {
    expect(mapInvoiceStatus("MYSTERY")).toBe("draft");
    expect(mapInvoiceStatus(null)).toBe("draft");
  });

  it("laisse le statut de paiement trancher — le vocabulaire réel du compte", () => {
    // L'écran Airwallex sépare document et paiement : « Finalisé » + « Non
    // payé » est une facture émise qu'on attend, « Finalisé » + « Payé » est
    // close. C'est le couple observé sur les vraies factures du compte.
    expect(mapInvoiceStatus("FINALIZED", "UNPAID")).toBe("sent");
    expect(mapInvoiceStatus("FINALIZED", "PAID")).toBe("paid");
    expect(mapInvoiceStatus("FINALIZED", null)).toBe("sent");
    expect(mapInvoiceStatus("DRAFT", "UNPAID")).toBe("draft");
    expect(mapInvoiceStatus("VOIDED", "UNPAID")).toBe("void");
  });
});

describe("normalizeInvoice", () => {
  it("lit une facture émise avec son client et son échéance", () => {
    const normalized = normalizeInvoice({
      id: "inv_42",
      total_amount: 2500,
      currency: "EUR",
      status: "SENT",
      customer: { name: "Bondet", id: "cus_1" },
      issue_date: "2026-08-01",
      due_date: "2026-08-20",
    });
    expect(normalized).toMatchObject({
      external_id: "inv_42",
      client_name: "Bondet",
      amount_cents: 250_000,
      status: "sent",
      raw_status: "SENT",
      due_on: "2026-08-20",
    });
  });

  it("nomme « Client inconnu » plutôt que de perdre la facture", () => {
    const normalized = normalizeInvoice({
      id: "inv_43",
      amount: 100,
      currency: "EUR",
    });
    expect(normalized?.client_name).toBe("Client inconnu");
  });
});
