import { describe, expect, it } from "vitest";

import {
  normalizeClientName,
  reconcile,
  resolveClient,
  type ReconcilableInstallment,
  type ReconcilableInvoice,
} from "./reconcile";

const NOW = new Date("2026-08-07T10:00:00.000Z");

const makeInstallment = (
  overrides: Partial<ReconcilableInstallment> = {},
): ReconcilableInstallment => ({
  id: "inst-1",
  status: "pending",
  amount_cents: 250_000,
  vat_rate: 20,
  currency: "EUR",
  issue_on: "2026-08-01",
  matched_invoice_id: null,
  archived_at: null,
  issued_at: null,
  paid_at: null,
  client_name: "I-WAY",
  ...overrides,
});

const makeInvoice = (
  overrides: Partial<ReconcilableInvoice> = {},
): ReconcilableInvoice => ({
  id: "fac-1",
  client_name: "I-WAY",
  amount_cents: 300_000,
  currency: "EUR",
  status: "sent",
  issued_on: "2026-08-01",
  paid_at: null,
  ...overrides,
});

describe("normalizeClientName", () => {
  it("efface accents, casse et espaces surnuméraires", () => {
    expect(normalizeClientName("CHASSEURS DE GRAINES")).toBe(
      normalizeClientName("Chasseurs  de graines "),
    );
    expect(normalizeClientName("Échéance Café")).toBe("echeance cafe");
  });
});

describe("resolveClient", () => {
  const aliases = { "night session": "BONDET", "sasu antidotes": null };

  it("traduit une raison sociale vers le nom du devis", () => {
    expect(resolveClient("NIGHT SESSION", aliases)).toBe("bondet");
  });

  it("laisse passer un nom inconnu tel quel", () => {
    expect(resolveClient("Catherine Osti", aliases)).toBe("catherine osti");
  });

  it("rend null pour une facture qui n'est pas une prestation client", () => {
    expect(resolveClient("SASU Antidotes", aliases)).toBeNull();
  });
});

describe("reconcile", () => {
  it("rapproche à travers la raison sociale du client", () => {
    // Le devis dit « BONDET », la facture dit « NIGHT SESSION ».
    const decisions = reconcile({
      installments: [
        makeInstallment({ client_name: "BONDET", vat_rate: 0, amount_cents: 170_000 }),
      ],
      invoices: [makeInvoice({ client_name: "NIGHT SESSION", amount_cents: 170_000 })],
      aliases: { "night session": "BONDET" },
      now: NOW,
    });

    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.set.matched_invoice_id).toBe("fac-1");
  });

  it("ignore une facture interne, même si tout concorde", () => {
    const decisions = reconcile({
      installments: [
        makeInstallment({ client_name: "SASU Antidotes", vat_rate: 0, amount_cents: 250_000 }),
      ],
      invoices: [makeInvoice({ client_name: "SASU Antidotes", amount_cents: 250_000 })],
      aliases: { "sasu antidotes": null },
      now: NOW,
    });

    expect(decisions).toEqual([]);
  });

  it("absorbe une coquille de saisie de quelques centimes", () => {
    // Monday portait 2 102,50 ; la facture émise dit 2 102,00.
    const decisions = reconcile({
      installments: [makeInstallment({ vat_rate: 0, amount_cents: 210_250 })],
      invoices: [makeInvoice({ amount_cents: 210_200 })],
      now: NOW,
    });

    expect(decisions).toHaveLength(1);
  });

  it("refuse un écart de montant qui dépasse la tolérance", () => {
    // 1 % de 2 102,50 € plafonné à 5 € : 20 € d'écart est une autre prestation.
    const decisions = reconcile({
      installments: [makeInstallment({ vat_rate: 0, amount_cents: 210_250 })],
      invoices: [makeInvoice({ amount_cents: 208_250 })],
      now: NOW,
    });

    expect(decisions).toEqual([]);
  });

  it("rapproche une échéance de sa facture et la passe facturée", () => {
    const decisions = reconcile({
      installments: [makeInstallment()],
      invoices: [makeInvoice()],
      now: NOW,
    });

    expect(decisions).toEqual([
      {
        installment_id: "inst-1",
        set: {
          matched_invoice_id: "fac-1",
          status: "issued",
          issued_at: "2026-08-01T00:00:00.000Z",
        },
        reason: "matched",
      },
    ]);
  });

  it("passe directement payée quand Airwallex dit la facture réglée", () => {
    const decisions = reconcile({
      installments: [makeInstallment()],
      invoices: [
        makeInvoice({ status: "paid", paid_at: "2026-08-04T08:00:00.000Z" }),
      ],
      now: NOW,
    });

    expect(decisions[0]?.set).toEqual({
      matched_invoice_id: "fac-1",
      status: "paid",
      issued_at: "2026-08-01T00:00:00.000Z",
      paid_at: "2026-08-04T08:00:00.000Z",
    });
  });

  it("avance une échéance déjà rapprochée quand sa facture passe payée", () => {
    const decisions = reconcile({
      installments: [
        makeInstallment({ status: "issued", matched_invoice_id: "fac-1" }),
      ],
      invoices: [
        makeInvoice({ status: "paid", paid_at: "2026-08-06T08:00:00.000Z" }),
      ],
      now: NOW,
    });

    expect(decisions).toEqual([
      {
        installment_id: "inst-1",
        set: { status: "paid", paid_at: "2026-08-06T08:00:00.000Z" },
        reason: "advanced",
      },
    ]);
  });

  it("garde le statut posé à la main et comble la date d'émission absente", () => {
    // Marquée facturée avant que le rapprochement ne trouve la facture.
    const decisions = reconcile({
      installments: [makeInstallment({ status: "issued" })],
      invoices: [makeInvoice()],
      now: NOW,
    });

    expect(decisions).toEqual([
      {
        installment_id: "inst-1",
        set: { matched_invoice_id: "fac-1", issued_at: "2026-08-01T00:00:00.000Z" },
        reason: "matched",
      },
    ]);
  });

  it("ne réécrit pas une date d'émission déjà posée", () => {
    const decisions = reconcile({
      installments: [
        makeInstallment({ status: "issued", issued_at: "2026-07-30T09:00:00.000Z" }),
      ],
      invoices: [makeInvoice()],
      now: NOW,
    });

    expect(decisions).toEqual([
      {
        installment_id: "inst-1",
        set: { matched_invoice_id: "fac-1" },
        reason: "matched",
      },
    ]);
  });

  it("relie une payée sans lien et lui apporte la date de paiement réelle", () => {
    // Le statut vient du board Monday ; la facture apporte la date, rien ne recule.
    const decisions = reconcile({
      installments: [makeInstallment({ status: "paid" })],
      invoices: [
        makeInvoice({ status: "paid", paid_at: "2026-08-04T08:00:00.000Z" }),
      ],
      now: NOW,
    });

    expect(decisions).toEqual([
      {
        installment_id: "inst-1",
        set: {
          matched_invoice_id: "fac-1",
          issued_at: "2026-08-01T00:00:00.000Z",
          paid_at: "2026-08-04T08:00:00.000Z",
        },
        reason: "matched",
      },
    ]);
  });

  it("relie une payée à une facture seulement émise sans la faire reculer", () => {
    const decisions = reconcile({
      installments: [makeInstallment({ status: "paid" })],
      invoices: [makeInvoice({ status: "sent" })],
      now: NOW,
    });

    expect(decisions).toEqual([
      {
        installment_id: "inst-1",
        set: { matched_invoice_id: "fac-1", issued_at: "2026-08-01T00:00:00.000Z" },
        reason: "matched",
      },
    ]);
  });

  it("ne recule jamais : une payée reste payée même si la facture retombe", () => {
    const decisions = reconcile({
      installments: [
        makeInstallment({
          status: "paid",
          matched_invoice_id: "fac-1",
          paid_at: "2026-08-01T00:00:00.000Z",
        }),
      ],
      invoices: [makeInvoice({ status: "sent" })],
      now: NOW,
    });

    expect(decisions).toEqual([]);
  });

  it("refuse un montant TTC différent, un client différent, une devise différente", () => {
    const decisions = reconcile({
      installments: [makeInstallment()],
      invoices: [
        // Au-delà de la tolérance : une autre prestation, pas un arrondi.
        makeInvoice({ id: "fac-montant", amount_cents: 280_000 }),
        makeInvoice({ id: "fac-client", client_name: "Bondet" }),
        makeInvoice({ id: "fac-devise", currency: "USD" }),
      ],
      now: NOW,
    });

    expect(decisions).toEqual([]);
  });

  it("tolère accents, casse et espaces dans le nom du client", () => {
    const decisions = reconcile({
      installments: [makeInstallment({ client_name: "Chasseurs de Graines" })],
      invoices: [makeInvoice({ client_name: "CHASSEURS  DE GRAINES" })],
      now: NOW,
    });

    expect(decisions).toHaveLength(1);
  });

  it("ignore une facture émise hors fenêtre", () => {
    const decisions = reconcile({
      installments: [makeInstallment({ issue_on: "2026-08-01" })],
      invoices: [
        makeInvoice({ id: "fac-tot", issued_on: "2026-07-10" }),
        makeInvoice({ id: "fac-tard", issued_on: "2026-09-20" }),
      ],
      now: NOW,
    });

    expect(decisions).toEqual([]);
  });

  it("n'apparie une facture qu'une seule fois", () => {
    // Deux mensualités identiques, une seule facture : la plus ancienne gagne.
    const decisions = reconcile({
      installments: [
        makeInstallment({ id: "inst-juillet", issue_on: "2026-08-01" }),
        makeInstallment({ id: "inst-aout", issue_on: "2026-09-01" }),
      ],
      invoices: [makeInvoice({ issued_on: "2026-08-02" })],
      now: new Date("2026-09-05T10:00:00.000Z"),
    });

    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.installment_id).toBe("inst-juillet");
  });

  it("apparie deux mensualités et deux factures dans l'ordre chronologique", () => {
    const decisions = reconcile({
      installments: [
        makeInstallment({ id: "inst-aout", issue_on: "2026-09-01" }),
        makeInstallment({ id: "inst-juillet", issue_on: "2026-08-01" }),
      ],
      invoices: [
        makeInvoice({ id: "fac-septembre", issued_on: "2026-09-01" }),
        makeInvoice({ id: "fac-aout", issued_on: "2026-08-01" }),
      ],
      now: new Date("2026-09-05T10:00:00.000Z"),
    });

    expect(decisions).toEqual([
      expect.objectContaining({
        installment_id: "inst-juillet",
        set: expect.objectContaining({ matched_invoice_id: "fac-aout" }),
      }),
      expect.objectContaining({
        installment_id: "inst-aout",
        set: expect.objectContaining({ matched_invoice_id: "fac-septembre" }),
      }),
    ]);
  });

  it("ne touche jamais une échéance passée", () => {
    const decisions = reconcile({
      installments: [makeInstallment({ status: "skipped" })],
      invoices: [makeInvoice()],
      now: NOW,
    });

    expect(decisions).toEqual([]);
  });

  it("compare le TTC avec le taux de la ligne, pas un taux global", () => {
    // TVA à 0 : la facture Airwallex porte le HT tel quel.
    const decisions = reconcile({
      installments: [makeInstallment({ vat_rate: 0, amount_cents: 250_000 })],
      invoices: [makeInvoice({ amount_cents: 250_000 })],
      now: NOW,
    });

    expect(decisions).toHaveLength(1);
  });

  it("archive une payée de plus de soixante jours, laisse la récente", () => {
    const decisions = reconcile({
      installments: [
        makeInstallment({
          id: "inst-vieille",
          status: "paid",
          paid_at: "2026-06-01T00:00:00.000Z",
        }),
        makeInstallment({
          id: "inst-recente",
          status: "paid",
          paid_at: "2026-08-01T00:00:00.000Z",
        }),
      ],
      invoices: [],
      now: NOW,
    });

    expect(decisions).toEqual([
      {
        installment_id: "inst-vieille",
        set: { archived_at: NOW.toISOString() },
        reason: "archived",
      },
    ]);
  });

  it("n'archive pas une payée sans date de paiement ni une déjà archivée", () => {
    const decisions = reconcile({
      installments: [
        makeInstallment({ id: "inst-sans-date", status: "paid", paid_at: null }),
        makeInstallment({
          id: "inst-archivee",
          status: "paid",
          paid_at: "2026-01-01T00:00:00.000Z",
          archived_at: "2026-04-01T00:00:00.000Z",
        }),
      ],
      invoices: [],
      now: NOW,
    });

    expect(decisions).toEqual([]);
  });

  it("ne décide rien quand tout est déjà à jour", () => {
    // L'idempotence est ce qui permet au rapprochement de tourner toutes les
    // heures sans jamais réécrire l'histoire.
    const decisions = reconcile({
      installments: [
        makeInstallment({
          status: "paid",
          matched_invoice_id: "fac-1",
          paid_at: "2026-08-01T00:00:00.000Z",
        }),
      ],
      invoices: [makeInvoice({ status: "paid", paid_at: "2026-08-01T00:00:00.000Z" })],
      now: NOW,
    });

    expect(decisions).toEqual([]);
  });
});
