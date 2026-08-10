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

  it("rend son échéance de règlement à une ligne repassée à la main en facturée", () => {
    /* Le cas vécu : la prestation de mai avait été dite payée par l'import
       Monday, la banque disait le contraire. Repassée « facturée » à la
       main, elle avait perdu son lien — donc la date d'échéance qui seule
       permet de dire que le client est en retard — et portait la date
       d'émission du clic au lieu de celle de la facture. */
    const decisions = reconcile({
      installments: [
        makeInstallment({
          status: "issued",
          vat_rate: 0,
          amount_cents: 210_200,
          issue_on: "2026-06-01",
          issued_at: "2026-08-10T09:00:00.000Z",
          matched_invoice_id: null,
          client_name: "CHASSEURS DE GRAINES",
        }),
      ],
      invoices: [
        makeInvoice({
          client_name: "MEDIAPILOTE ANGERS",
          amount_cents: 210_200,
          status: "sent",
          issued_on: "2026-06-01",
        }),
      ],
      aliases: { "mediapilote angers": "CHASSEURS DE GRAINES" },
      now: NOW,
    });

    expect(decisions).toEqual([
      {
        installment_id: "inst-1",
        set: {
          matched_invoice_id: "fac-1",
          issued_at: "2026-06-01T00:00:00.000Z",
        },
        reason: "matched",
      },
    ]);
  });

  it("aligne le montant d'une échéance rapprochée de longue date", () => {
    // Le cas qui faisait diverger cet écran et le dashboard Finance : le lien
    // était posé depuis un passage précédent, et seul le devis parlait.
    const decisions = reconcile({
      installments: [
        makeInstallment({
          status: "issued",
          vat_rate: 0,
          amount_cents: 210_250,
          matched_invoice_id: "fac-1",
        }),
      ],
      invoices: [makeInvoice({ amount_cents: 210_200 })],
      now: NOW,
    });

    expect(decisions).toEqual([
      {
        installment_id: "inst-1",
        set: { amount_cents: 210_200 },
        reason: "advanced",
      },
    ]);
  });

  it("ne réécrit pas le devis quand la facture rapprochée porte un tout autre montant", () => {
    const decisions = reconcile({
      installments: [
        makeInstallment({
          status: "issued",
          vat_rate: 0,
          amount_cents: 210_250,
          matched_invoice_id: "fac-1",
        }),
      ],
      invoices: [makeInvoice({ amount_cents: 90_000 })],
      now: NOW,
    });

    expect(decisions).toEqual([]);
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

  it("corrige une date d'émission qui contredit la facture rapprochée", () => {
    // La facture dit quand elle est partie ; un horodatage posé à la main ne
    // fait que dire quand on a corrigé le statut.
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
        set: { matched_invoice_id: "fac-1", issued_at: "2026-08-01T00:00:00.000Z" },
        reason: "matched",
      },
    ]);
  });

  it("ne réécrit pas une date d'émission déjà d'accord avec la facture", () => {
    // Le rapprochement tourne toutes les heures : il ne doit pas repousser la
    // même valeur à chaque passage.
    const decisions = reconcile({
      installments: [
        makeInstallment({ status: "issued", issued_at: "2026-08-01T00:00:00+00:00" }),
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

  it("ne fait pas glisser la série quand les premiers mois n'ont pas de facture", () => {
    /* Le devis court de janvier à mars, la facturation n'a commencé qu'en
       mars. Sans fenêtre resserrée, la facture de mars soldait janvier et
       tout le reste suivait, décalé d'un cran. */
    const decisions = reconcile({
      installments: [
        makeInstallment({ id: "jan", issue_on: "2026-02-01", vat_rate: 0 }),
        makeInstallment({ id: "fev", issue_on: "2026-03-01", vat_rate: 0 }),
        makeInstallment({ id: "mars", issue_on: "2026-04-01", vat_rate: 0 }),
      ],
      invoices: [
        makeInvoice({ id: "f-mars", issued_on: "2026-03-04", amount_cents: 250_000 }),
        makeInvoice({ id: "f-avril", issued_on: "2026-04-01", amount_cents: 250_000 }),
      ],
      now: new Date("2026-05-01T10:00:00.000Z"),
    });

    // Janvier reste sans facture ; février et mars trouvent les leurs.
    expect(decisions.map((d) => [d.installment_id, d.set.matched_invoice_id])).toEqual([
      ["fev", "f-mars"],
      ["mars", "f-avril"],
    ]);
  });

  it("préfère la facture la plus proche du jour prévu", () => {
    const decisions = reconcile({
      installments: [makeInstallment({ issue_on: "2026-08-01", vat_rate: 0 })],
      invoices: [
        makeInvoice({ id: "f-tardive", issued_on: "2026-08-18", amount_cents: 250_000 }),
        makeInvoice({ id: "f-juste", issued_on: "2026-08-03", amount_cents: 250_000 }),
      ],
      now: NOW,
    });

    expect(decisions[0]?.set.matched_invoice_id).toBe("f-juste");
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

  it("aligne le montant sur la facture réellement émise", () => {
    // Le devis Monday disait 2 102,50 ; Airwallex a facturé 2 102,00. Sans
    // cet alignement, Finance et Échéances affichent deux chiffres pour la
    // même créance.
    const decisions = reconcile({
      installments: [makeInstallment({ vat_rate: 0, amount_cents: 210_250 })],
      invoices: [makeInvoice({ amount_cents: 210_200 })],
      now: NOW,
    });

    expect(decisions[0]?.set.amount_cents).toBe(210_200);
  });

  it("dérive le hors-taxe quand la facture porte un TTC", () => {
    const decisions = reconcile({
      installments: [makeInstallment({ vat_rate: 20, amount_cents: 250_000 })],
      invoices: [makeInvoice({ amount_cents: 300_000 })],
      now: NOW,
    });

    // 300 000 TTC à 20 % = 250 000 HT : le montant est déjà juste, rien à écrire.
    expect(decisions[0]?.set.amount_cents).toBeUndefined();
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
