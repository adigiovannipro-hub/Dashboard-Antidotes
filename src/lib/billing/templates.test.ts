import { describe, expect, it } from "vitest";

import {
  DEFAULT_REMINDER_TEMPLATE,
  DEFAULT_SEND_TEMPLATE,
  renderEmail,
  unknownVariablesIn,
  type TemplateFacts,
} from "./templates";

const faits = (overrides: Partial<TemplateFacts> = {}): TemplateFacts => ({
  firstName: "Jean",
  clientName: "Bondet",
  projectLabel: "Accompagnement social media",
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
    // Un crochet sur plusieurs lignes n'est pas une variable oubliée.
    expect(unknownVariablesIn("un [\ntexte]")).toEqual([]);
  });
});

describe("renderEmail", () => {
  it("prend la première ligne pour objet et le reste pour corps", () => {
    const rendu = renderEmail("Facture [numéro]\n\nBonjour [prénom],", faits());
    expect(rendu).toEqual({
      ok: true,
      subject: "Facture INV-A9DFDGZ3-0005",
      body: "Bonjour Jean,",
    });
  });

  it("remplace toutes les occurrences d'une même variable", () => {
    const rendu = renderEmail("Objet\n\n[montant] puis [montant]", faits());
    expect(rendu).toEqual({
      ok: true,
      subject: "Objet",
      body: "2 522,50 € puis 2 522,50 €",
    });
  });

  it("recoud la formule quand le prénom manque", () => {
    // « Bonjour , » chez un client est une faute que personne ne pardonne.
    const rendu = renderEmail("Objet\n\nBonjour [prénom],", faits({ firstName: null }));
    expect(rendu).toEqual({ ok: true, subject: "Objet", body: "Bonjour," });
  });

  it("refuse d'envoyer un modèle qui porte une variable inconnue", () => {
    const rendu = renderEmail("Objet\n\nLe [periode] est là", faits());
    expect(rendu).toEqual({ ok: false, unknownVariables: ["[periode]"] });
  });

  it("remplit le modèle d'envoi par défaut de bout en bout", () => {
    const rendu = renderEmail(DEFAULT_SEND_TEMPLATE, faits());
    expect(rendu.ok).toBe(true);
    if (!rendu.ok) return;
    expect(rendu.subject).toBe(
      "Facture INV-A9DFDGZ3-0005 — Accompagnement social media — août 2026",
    );
    expect(rendu.body).toContain("Bonjour Jean,");
    expect(rendu.body).toContain("2 522,50 €");
    expect(rendu.body).toContain("5 septembre 2026");
    expect(rendu.body).not.toMatch(/\[[^\]]+\]/);
  });

  it("remplit le modèle de relance par défaut de bout en bout", () => {
    const rendu = renderEmail(DEFAULT_REMINDER_TEMPLATE, faits());
    expect(rendu.ok).toBe(true);
    if (!rendu.ok) return;
    expect(rendu.subject).toBe("Relance — facture INV-A9DFDGZ3-0005 — août 2026");
    expect(rendu.body).not.toMatch(/\[[^\]]+\]/);
  });
});
