import { describe, expect, it } from "vitest";

import { buildExpensesCsv } from "./csv";
import type { FinanceTransaction } from "./types";

let sequence = 0;

function transaction(
  overrides: Partial<FinanceTransaction> & { category_name?: string | null },
): FinanceTransaction & { category_name: string | null } {
  sequence += 1;
  const { category_name = null, ...rest } = overrides;
  return {
    id: `tx-${sequence}`,
    org_id: "org",
    external_id: `ext-${sequence}`,
    occurred_at: "2026-08-05T06:32:00.000Z",
    posted_at: null,
    merchant: "Grab",
    merchant_raw: "Grab* A-9MXOR7UGWAE9AV, 6281384748739, IDN",
    amount_cents: 15_880_000,
    currency: "IDR",
    billing_amount_cents: 773,
    billing_currency: "EUR",
    category_id: null,
    category_raw: "Transports",
    status: "incomplete",
    source: "airwallex",
    has_receipt: false,
    card_last_four: "0162",
    cardholder_name: null,
    raw: null,
    synced_at: "2026-08-05T07:00:00.000Z",
    created_at: "2026-08-05T07:00:00.000Z",
    updated_at: "2026-08-05T07:00:00.000Z",
    category_name,
    ...rest,
  };
}

describe("buildExpensesCsv", () => {
  it("ouvre sur un BOM et l'en-tête, sépare au point-virgule", () => {
    const csv = buildExpensesCsv([]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain(
      "Date;Marchand;Montant;Devise;Montant débité;Devise débitée;Catégorie;Statut;Justificatif;Source",
    );
  });

  it("écrit une ligne à la française : date, virgules, oui/non", () => {
    const csv = buildExpensesCsv([transaction({})]);
    expect(csv).toContain(
      "05/08/2026;Grab;158800,00;IDR;7,73;EUR;Transports;Incomplet;non;airwallex",
    );
  });

  it("préfère le nom de catégorie du plan au libellé Airwallex", () => {
    const csv = buildExpensesCsv([transaction({ category_name: "Déplacements" })]);
    expect(csv).toContain(";Déplacements;");
    expect(csv).not.toContain(";Transports;");
  });

  it("protège les cellules qui portent le séparateur ou des guillemets", () => {
    const csv = buildExpensesCsv([
      transaction({ merchant: 'PT "UNBROKEN"; Lombok' }),
    ]);
    expect(csv).toContain('"PT ""UNBROKEN""; Lombok"');
  });

  it("laisse vide le débit qu'Airwallex n'a pas encore fixé", () => {
    const csv = buildExpensesCsv([
      transaction({ billing_amount_cents: null, billing_currency: null }),
    ]);
    expect(csv).toContain(";158800,00;IDR;;;");
  });

  it("affiche tel quel un statut inconnu plutôt que de casser", () => {
    const csv = buildExpensesCsv([transaction({ status: "exotic_state" })]);
    expect(csv).toContain(";exotic_state;");
  });

  it("finit chaque ligne en CRLF, Excel oblige", () => {
    const csv = buildExpensesCsv([transaction({})]);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv.split("\r\n").length).toBe(3); // en-tête + ligne + vide final
  });
});
