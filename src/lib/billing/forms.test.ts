import { describe, expect, it } from "vitest";

import {
  createEngagementInput,
  deliveryInput,
  ficheFrom,
  FICHE_FIELDS,
} from "./forms";

/** Une fiche telle que le panneau l'envoie, tous champs remplis. */
const fiche = (overrides: Record<string, string> = {}) => ({
  recipientEmail: "brice@loriginel.fr",
  ccEmails: "c.deschere@mediapilote.com, a.bouju@mediapilote.com",
  contactFirstName: "Brice",
  billingName: "L'ORIGINEL",
  billingEmail: "compta@loriginel.fr",
  billingStreet: "12 Rue de la Paix",
  billingCity: "Lyon",
  billingPostcode: "69002",
  billingCountry: "FR",
  billingTaxId: "FR94452373269",
  productName: "ACCOMPAGNEMENT SOCIAL MEDIA",
  templateInvoiceId: "",
  sendSubject: "Alessandro x [client] : facture du mois [de mois]",
  sendTemplate: "Hello [prénom],",
  reminder1Subject: "relance",
  reminder1Template: "Hello,",
  reminder2Subject: "seconde relance",
  reminder2Template: "Hello,",
  reminder3Subject: "troisième relance",
  reminder3Template: "Hello,",
  ...overrides,
});

describe("deliveryInput", () => {
  it("accepte une fiche complète", () => {
    // Le test qui manquait : le schéma exigeait trois champs que le
    // formulaire n'envoyait pas sous ce nom, et la validation échouait à
    // tous les coups en accusant le destinataire.
    const parsed = deliveryInput.safeParse({
      engagementId: "0bd9a815-a42d-4cec-8b81-6546ee6c21c6",
      ...fiche(),
    });
    expect(parsed.success).toBe(true);
  });

  it("admet un devis sans destinataire — l'automatisme est alors éteint", () => {
    const parsed = deliveryInput.safeParse({
      engagementId: "0bd9a815-a42d-4cec-8b81-6546ee6c21c6",
      ...fiche({ recipientEmail: "", ccEmails: "" }),
    });
    expect(parsed.success).toBe(true);
  });

  it("refuse une adresse de destinataire malformée", () => {
    const parsed = deliveryInput.safeParse({
      engagementId: "0bd9a815-a42d-4cec-8b81-6546ee6c21c6",
      ...fiche({ recipientEmail: "brice arobase loriginel" }),
    });
    expect(parsed.success).toBe(false);
  });

  it("découpe les copies quel que soit le séparateur collé", () => {
    const parsed = deliveryInput.safeParse({
      engagementId: "0bd9a815-a42d-4cec-8b81-6546ee6c21c6",
      ...fiche({ ccEmails: "un@a.fr; deux@b.fr\ntrois@c.fr" }),
    });
    expect(parsed.success && parsed.data.ccEmails).toEqual([
      "un@a.fr",
      "deux@b.fr",
      "trois@c.fr",
    ]);
  });
});

describe("createEngagementInput", () => {
  it("accepte un devis complet avec sa fiche", () => {
    const parsed = createEngagementInput.safeParse({
      clientName: "L'ORIGINEL",
      label: "Accompagnement social media",
      firstMonth: "2026-09",
      lastMonth: "2027-10",
      monthlyAmount: "2000",
      vatRate: "0",
      ...fiche(),
    });
    expect(parsed.success).toBe(true);
  });

  it("refuse une période à l'envers", () => {
    const parsed = createEngagementInput.safeParse({
      clientName: "X",
      label: "Y",
      firstMonth: "2027-01",
      lastMonth: "2026-01",
      monthlyAmount: "100",
      vatRate: "0",
      ...fiche(),
    });
    expect(parsed.success).toBe(false);
  });
});

describe("ficheFrom", () => {
  it("lit tous les champs de la fiche, et rien de plus", () => {
    // Deux listes tenues à la main finissent par diverger : celle du
    // formulaire et celle du parseur n'en font qu'une.
    const formData = new FormData();
    for (const champ of FICHE_FIELDS) formData.set(champ, `valeur-${champ}`);

    const lu = ficheFrom(formData);
    expect(Object.keys(lu).sort()).toEqual([...FICHE_FIELDS].sort());
  });

  it("rend une chaîne vide pour un champ absent du formulaire", () => {
    expect(ficheFrom(new FormData()).billingCity).toBe("");
  });
});
