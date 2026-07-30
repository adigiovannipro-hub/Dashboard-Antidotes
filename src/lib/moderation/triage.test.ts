import { describe, expect, it } from "vitest";

import { detectLanguage, triageMessage } from "./triage";

describe("détection de langue", () => {
  it("reconnaît un message français", () => {
    const result = detectLanguage("Bonjour, quand sera livrée ma commande ?");
    expect(result.locale).toBe("fr");
    expect(result.confidence).toBeGreaterThan(0.6);
  });

  it("reconnaît un message anglais", () => {
    const result = detectLanguage("Hello, when will my order be delivered?");
    expect(result.locale).toBe("en");
    expect(result.confidence).toBeGreaterThan(0.6);
  });

  it("s'appuie sur les accents comme signal fort", () => {
    // Peu de mots-outils, mais les diacritiques ne laissent aucun doute.
    expect(detectLanguage("Livraison prévue à Nîmes ?").locale).toBe("fr");
  });

  it("retombe sur la langue par défaut sur un message trop court", () => {
    // Répondre en français à un « ok » d'un client français est le bon choix,
    // et c'est le cas majoritaire.
    expect(detectLanguage("ok 👍").locale).toBe("fr");
    expect(detectLanguage("ok 👍", "en").locale).toBe("en");
  });

  it("retombe sur la langue par défaut sur un message vide", () => {
    expect(detectLanguage("").confidence).toBe(0);
  });
});

describe("signalements automatiques", () => {
  it("détecte une demande de remboursement", () => {
    const result = triageMessage("Je veux être remboursé pour cette commande");
    expect(result.flags).toContain("refund");
    expect(result.priority).toBe("high");
    expect(result.requiresHumanReview).toBe(true);
  });

  it("détecte un litige", () => {
    expect(
      triageMessage("Je vais contacter mon avocat si rien ne bouge").flags,
    ).toContain("dispute");
    expect(
      triageMessage("Mise en demeure envoyée demain").flags,
    ).toContain("dispute");
  });

  it("détecte une insulte", () => {
    expect(triageMessage("Bande d'arnaqueurs !").flags).toContain("insult");
    expect(triageMessage("This is a total scam").flags).toContain("insult");
  });

  it("détecte une question sensible", () => {
    expect(
      triageMessage("Mon fils est allergique aux arachides, ce produit en contient ?")
        .flags,
    ).toContain("sensitive");
    expect(
      triageMessage("Je demande la suppression de mes données personnelles (RGPD)")
        .flags,
    ).toContain("sensitive");
  });

  it("détecte le spam", () => {
    expect(
      triageMessage("Check my profile for free followers, dm me for info").flags,
    ).toContain("spam");
  });

  it("attrape les motifs malgré l'absence d'accents", () => {
    // Un client qui tape sans accents doit être signalé comme les autres.
    expect(triageMessage("je veux un remboursement").flags).toContain("refund");
    expect(triageMessage("commande jamais recue").flags).toContain("dispute");
  });

  it("cumule plusieurs signalements sur un même message", () => {
    const result = triageMessage(
      "Escrocs, je veux mon remboursement ou je saisis le tribunal",
    );
    expect(result.flags).toEqual(
      expect.arrayContaining(["insult", "refund", "dispute"]),
    );
  });

  it("ne signale pas une question ordinaire", () => {
    const result = triageMessage("Bonjour, avez-vous ce modèle en taille 38 ?");
    expect(result.flags).toEqual([]);
    expect(result.priority).toBe("normal");
    expect(result.requiresHumanReview).toBe(false);
  });
});
