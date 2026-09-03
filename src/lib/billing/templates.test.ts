import { describe, expect, it } from "vitest";

import {
  DEFAULT_REMINDER_SUBJECT,
  DEFAULT_REMINDER_TEMPLATE,
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
    expect(rendu.subject).toBe("Facture août — Bondet");
    expect(rendu.body).toContain("Hello Jean,");
    expect(rendu.body).toContain("la facture du mois de août");
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

  it("remplit les modèles de relance par défaut de bout en bout", () => {
    const rendu = renderEmail(
      DEFAULT_REMINDER_SUBJECT,
      DEFAULT_REMINDER_TEMPLATE,
      faits(),
    );
    expect(rendu.ok).toBe(true);
    if (!rendu.ok) return;
    expect(rendu.subject).toBe("Relance — facture août — Bondet");
    expect(rendu.body).toContain("règlement du mois de août");
    expect(rendu.body).not.toMatch(/\[[^\]]+\]/);
  });
});
