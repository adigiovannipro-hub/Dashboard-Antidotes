import { describe, expect, it } from "vitest";

import {
  DEFAULT_REMINDER_1_TEMPLATE,
  DEFAULT_REMINDER_2_TEMPLATE,
  DEFAULT_REMINDER_3_TEMPLATE,
  DEFAULT_REMINDER_1_SUBJECT,
  DEFAULT_SEND_SUBJECT,
  DEFAULT_SEND_TEMPLATE,
  renderEmail,
  unknownVariablesIn,
  type TemplateFacts,
} from "./templates";

const faits = (overrides: Partial<TemplateFacts> = {}): TemplateFacts => ({
  firstName: "Jean",
  clientName: "Bondet",
  projectLabel: "Accompagnement social media",
  month: "août",
  period: "août 2026",
  amount: "2 522,50 €",
  invoiceNumber: "INV-A9DFDGZ3-0005",
  dueDate: "5 septembre 2026",
  ...overrides,
});

describe("unknownVariablesIn", () => {
  it("laisse passer les variables connues", () => {
    expect(unknownVariablesIn("Bonjour [prénom], voici [montant].")).toEqual([]);
  });

  it("attrape la faute d'accent, qui est la faute la plus probable", () => {
    expect(unknownVariablesIn("Période : [periode]")).toEqual(["[periode]"]);
  });

  it("ne signale qu'une fois une variable répétée", () => {
    expect(unknownVariablesIn("[machin] et encore [machin]")).toEqual(["[machin]"]);
  });

  it("ignore un crochet qui n'entoure rien de plausible", () => {
    expect(unknownVariablesIn("un [\ntexte]")).toEqual([]);
  });
});

describe("renderEmail", () => {
  it("remplit l'objet et le corps séparément", () => {
    const rendu = renderEmail("Facture [numéro]", "Hello [prénom],", faits());
    expect(rendu).toEqual({
      ok: true,
      subject: "Facture INV-A9DFDGZ3-0005",
      body: "Hello Jean,",
    });
  });

  it("aplatit un objet qu'on aurait tapé sur deux lignes", () => {
    // Un en-tête de mail tient sur une ligne : un saut collé dedans
    // deviendrait une injection d'en-tête si on le laissait passer.
    const rendu = renderEmail("Facture\n  [mois]", "corps", faits());
    expect(rendu.ok && rendu.subject).toBe("Facture août");
  });

  it("remplace toutes les occurrences d'une même variable", () => {
    const rendu = renderEmail("Objet", "[montant] puis [montant]", faits());
    expect(rendu.ok && rendu.body).toBe("2 522,50 € puis 2 522,50 €");
  });

  it("recoud la formule quand le prénom manque", () => {
    // « Hello , » chez un client est une faute que personne ne pardonne.
    const rendu = renderEmail("Objet", "Hello [prénom],", faits({ firstName: null }));
    expect(rendu.ok && rendu.body).toBe("Hello,");
  });

  it("refuse d'envoyer si l'objet porte une variable inconnue", () => {
    const rendu = renderEmail("Facture [periode]", "corps", faits());
    expect(rendu).toEqual({ ok: false, unknownVariables: ["[periode]"] });
  });

  it("refuse d'envoyer si le corps porte une variable inconnue", () => {
    const rendu = renderEmail("Objet", "Le [machin] est là", faits());
    expect(rendu).toEqual({ ok: false, unknownVariables: ["[machin]"] });
  });

  it("remplit les modèles d'envoi par défaut de bout en bout", () => {
    const rendu = renderEmail(DEFAULT_SEND_SUBJECT, DEFAULT_SEND_TEMPLATE, faits());
    expect(rendu.ok).toBe(true);
    if (!rendu.ok) return;
    expect(rendu.subject).toBe("Alessandro x Bondet : facture du mois d'août");
    expect(rendu.body).toContain("Hello Jean,");
    expect(rendu.body).toContain("la facture du mois d'août");
    expect(rendu.body).toContain("2 522,50 €");
    expect(rendu.body).toContain("5 septembre 2026");
    expect(rendu.body).not.toMatch(/\[[^\]]+\]/);
  });

  it("ne relance aucun mois précédent dans le mail d'envoi", () => {
    // Le mail qui accompagne une facture ne fait qu'une chose : réclamer un
    // impayé dans le même souffle affaiblirait les deux.
    const rendu = renderEmail(DEFAULT_SEND_SUBJECT, DEFAULT_SEND_TEMPLATE, faits());
    expect(rendu.ok && rendu.body.toLowerCase()).not.toContain("en attente du règlement");
    expect(rendu.ok && rendu.body.toLowerCase()).not.toContain("relance");
  });

  it("remplit les trois relances par défaut de bout en bout", () => {
    for (const modele of [
      DEFAULT_REMINDER_1_TEMPLATE,
      DEFAULT_REMINDER_2_TEMPLATE,
      DEFAULT_REMINDER_3_TEMPLATE,
    ]) {
      const rendu = renderEmail(DEFAULT_REMINDER_1_SUBJECT, modele, faits());
      expect(rendu.ok).toBe(true);
      if (!rendu.ok) return;
      expect(rendu.subject).toContain("Alessandro x Bondet :");
      expect(rendu.body).toContain("Hello Jean,");
      expect(rendu.body).not.toMatch(/\[[^\]]+\]/);
    }
  });

  it("ne répète pas une relance dans la suivante", () => {
    // Une relance identique à la précédente se lit comme un automate, et le
    // client le voit avant même de lire le montant.
    expect(DEFAULT_REMINDER_2_TEMPLATE).not.toBe(DEFAULT_REMINDER_1_TEMPLATE);
    expect(DEFAULT_REMINDER_3_TEMPLATE).not.toBe(DEFAULT_REMINDER_2_TEMPLATE);
  });

  it("finit les deux dernières relances sur une note chaleureuse", () => {
    for (const modele of [DEFAULT_REMINDER_2_TEMPLATE, DEFAULT_REMINDER_3_TEMPLATE]) {
      expect(modele).toContain("Merci beaucoup et à très vite");
    }
  });

  it("ne porte la signature dans aucun modèle", () => {
    // Elle est posée à l'envoi, de part et d'autre de la pièce jointe : la
    // recopier dans quatre modèles, c'est quatre endroits à corriger le jour
    // où le numéro de téléphone change.
    for (const modele of [
      DEFAULT_SEND_TEMPLATE,
      DEFAULT_REMINDER_1_TEMPLATE,
      DEFAULT_REMINDER_2_TEMPLATE,
      DEFAULT_REMINDER_3_TEMPLATE,
    ]) {
      expect(modele).not.toContain("À dispo,");
      expect(modele).not.toContain("DI GIOVANNI");
    }
  });

  it("distingue l'objet d'une relance de celui d'un envoi", () => {
    // Une boîte encombrée doit les distinguer sans les ouvrir.
    expect(DEFAULT_REMINDER_1_SUBJECT).toContain("relance de la facture");
  });
});

describe("l'élision de [de mois]", () => {
  it("dit « de juillet » devant une consonne", () => {
    const rendu = renderEmail("o", "la facture [de mois]", faits({ month: "juillet" }));
    expect(rendu.ok && rendu.body).toBe("la facture de juillet");
  });

  it("dit « d'août » devant une voyelle", () => {
    // « la facture du mois de août » saute aux yeux du client avant le montant.
    const rendu = renderEmail("o", "la facture [de mois]", faits({ month: "août" }));
    expect(rendu.ok && rendu.body).toBe("la facture d'août");
  });

  it("élide aussi devant avril et octobre", () => {
    for (const mois of ["avril", "octobre"]) {
      const rendu = renderEmail("o", "[de mois]", faits({ month: mois }));
      expect(rendu.ok && rendu.body).toBe(`d'${mois}`);
    }
  });

  it("ne confond pas [mois] et [de mois]", () => {
    const rendu = renderEmail("o", "[mois] puis [de mois]", faits({ month: "août" }));
    expect(rendu.ok && rendu.body).toBe("août puis d'août");
  });
});
