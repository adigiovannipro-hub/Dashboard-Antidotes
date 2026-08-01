import { describe, expect, it } from "vitest";

import {
  extractAmounts,
  likelyTotal,
  parseAmountToCents,
  senderDomain,
  triageEmail,
} from "./heuristics";

describe("senderDomain", () => {
  it("regroupe les sous-domaines d'envoi sous le domaine du fournisseur", () => {
    expect(senderDomain("billing@mail.notion.so")).toBe("notion.so");
    expect(senderDomain("no-reply@email.grab.com")).toBe("grab.com");
    expect(senderDomain("invoice@stripe.com")).toBe("stripe.com");
  });

  it("garde trois segments sur les suffixes composés", () => {
    // `co.uk` seul n'identifierait aucun fournisseur.
    expect(senderDomain("billing@invoices.acme.co.uk")).toBe("acme.co.uk");
    expect(senderDomain("x@shop.example.com.au")).toBe("example.com.au");
  });

  it("normalise la casse et les caractères d'en-tête résiduels", () => {
    expect(senderDomain("Billing@Notion.SO>")).toBe("notion.so");
  });
});

describe("parseAmountToCents", () => {
  it("lit les décimales à la française comme à l'américaine", () => {
    expect(parseAmountToCents("12,50")).toBe(1250);
    expect(parseAmountToCents("12.50")).toBe(1250);
  });

  it("distingue séparateur de milliers et séparateur décimal", () => {
    expect(parseAmountToCents("1 234,56")).toBe(123456);
    expect(parseAmountToCents("1,234.56")).toBe(123456);
    expect(parseAmountToCents("1.234,56")).toBe(123456);
  });

  it("traite un groupe de trois chiffres comme des milliers, pas des décimales", () => {
    // Le cas qui piège : « 1.234 » n'est pas 1,234 mais mille deux cent
    // trente-quatre — trois chiffres après le point ne sont jamais des centimes.
    expect(parseAmountToCents("1.234")).toBe(123400);
    expect(parseAmountToCents("1,234")).toBe(123400);
  });

  it("complète une décimale unique", () => {
    expect(parseAmountToCents("9,5")).toBe(950);
  });

  it("rend null sur ce qui n'est pas un nombre", () => {
    expect(parseAmountToCents("abc")).toBeNull();
  });
});

describe("extractAmounts", () => {
  it("lit le symbole devant comme derrière", () => {
    expect(extractAmounts("Total : 24,50 €")).toEqual([
      { cents: 2450, currency: "EUR" },
    ]);
    expect(extractAmounts("Total: $19.99")).toEqual([
      { cents: 1999, currency: "USD" },
    ]);
  });

  it("lit les codes ISO", () => {
    expect(extractAmounts("Amount charged: USD 20.00")).toContainEqual({
      cents: 2000,
      currency: "USD",
    });
    expect(extractAmounts("Montant 15,00 EUR")).toContainEqual({
      cents: 1500,
      currency: "EUR",
    });
  });

  it("ignore les suites de trois lettres qui ne sont pas des devises", () => {
    expect(extractAmounts("ref 12.00")).toEqual([]);
  });

  it("dédoublonne les montants identiques répétés", () => {
    const found = extractAmounts("Total 24,50 € — soit 24,50 € TTC");
    expect(found).toHaveLength(1);
  });
});

describe("likelyTotal", () => {
  it("retient le plus grand montant de la devise dominante", () => {
    const amounts = [
      { cents: 1000, currency: "EUR" },
      { cents: 200, currency: "EUR" },
      { cents: 1250, currency: "EUR" },
      { cents: 99_000, currency: "USD" },
    ];
    // Le total d'un reçu est presque toujours son plus grand nombre ; l'USD
    // isolé ici est un taux de change en pied de page, pas le montant payé.
    expect(likelyTotal(amounts)).toEqual({ cents: 1250, currency: "EUR" });
  });

  it("rend null sur une liste vide", () => {
    expect(likelyTotal([])).toBeNull();
  });
});

describe("triageEmail", () => {
  const base = { from_email: "no-reply@example.com", snippet: null };

  it("retient une facture avec PDF joint", () => {
    const result = triageEmail({
      ...base,
      subject: "Votre facture Notion — 15,00 €",
      attachmentNames: ["facture-2026-07.pdf"],
    });
    expect(result.verdict).toBe("inspect");
    expect(result.score).toBeGreaterThan(0.5);
  });

  it("retient un reçu anglais sans le mot facture", () => {
    const result = triageEmail({
      ...base,
      subject: "Your receipt from Grab",
      snippet: "Total SGD 12.40 — thanks for riding",
    });
    expect(result.verdict).toBe("inspect");
  });

  it("retient une commande sans vocabulaire comptable si PDF et montant", () => {
    const result = triageEmail({
      ...base,
      subject: "Votre commande est confirmée",
      snippet: "Total 89,90 €",
      attachmentNames: ["document.pdf"],
    });
    expect(result.verdict).toBe("inspect");
  });

  it("écarte une newsletter", () => {
    const result = triageEmail({
      ...base,
      subject: "Découvrez nos nouveautés de la semaine",
      snippet: "Inscrivez-vous au webinaire gratuit",
    });
    expect(result.verdict).toBe("skip");
  });

  it("écarte un démarchage qui emprunte le vocabulaire des factures", () => {
    // « Votre facture vous attend » : les mots y sont, l'intention non.
    const result = triageEmail({
      ...base,
      subject: "Votre facture d'électricité pourrait baisser",
      snippet: "Offre spéciale : -30% sur votre abonnement, essai gratuit",
    });
    expect(result.verdict).toBe("skip");
  });

  it("écarte un mail ordinaire sans hésiter", () => {
    const result = triageEmail({
      ...base,
      subject: "Point hebdo lundi 10h",
      snippet: "On décale d'une heure ?",
    });
    expect(result.verdict).toBe("skip");
    expect(result.score).toBe(0);
  });

  it("explique toujours son verdict", () => {
    const result = triageEmail({
      ...base,
      subject: "Facture Anthropic",
      snippet: "Montant : 20,00 €",
    });
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});
