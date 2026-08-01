import { describe, expect, it } from "vitest";

import {
  buildExtractionPrompt,
  toResult,
  validateExtraction,
  type ExtractionOutput,
} from "./extraction-prompt";

const output = (overrides: Partial<ExtractionOutput> = {}): ExtractionOutput => ({
  kind: "invoice",
  confidence: 0.95,
  reason: "Facture Notion avec numéro et total TTC.",
  merchant: "Notion Labs",
  total_amount: "15,00",
  currency: "EUR",
  tax_amount: "2,50",
  document_date: "2026-07-12",
  invoice_number: "INV-42",
  ...overrides,
});

describe("validateExtraction", () => {
  it("accepte une sortie conforme", () => {
    expect(validateExtraction(output())).toMatchObject({
      kind: "invoice",
      confidence: 0.95,
      merchant: "Notion Labs",
    });
  });

  it("rejette une nature inconnue", () => {
    expect(validateExtraction(output({ kind: "devis" as never }))).toBeNull();
  });

  it("rejette ce qui n'est pas un objet", () => {
    expect(validateExtraction(null)).toBeNull();
    expect(validateExtraction("facture")).toBeNull();
  });

  it("borne une confiance hors limites plutôt que de tout rejeter", () => {
    // Une confiance de 1,4 est une maladresse de formulation, pas le signe que
    // l'extraction entière est fausse.
    expect(validateExtraction(output({ confidence: 1.4 }))?.confidence).toBe(1);
    expect(validateExtraction(output({ confidence: -0.2 }))?.confidence).toBe(0);
  });

  it("écarte une devise mal formée plutôt que de la garder", () => {
    // Une fausse devise bloquerait tout rapprochement sans qu'on sache pourquoi.
    expect(validateExtraction(output({ currency: "euros" }))?.currency).toBe("");
    expect(validateExtraction(output({ currency: "eur" }))?.currency).toBe("EUR");
  });

  it("écarte une date au mauvais format", () => {
    expect(validateExtraction(output({ document_date: "12/07/2026" }))?.document_date).toBe("");
    expect(validateExtraction(output({ document_date: "2026-07-12" }))?.document_date).toBe(
      "2026-07-12",
    );
  });

  it("tronque un marchand ou une raison interminables", () => {
    const validated = validateExtraction(output({ merchant: "x".repeat(500) }));
    expect(validated!.merchant.length).toBe(200);
  });

  it("traite un champ manquant comme une chaîne vide", () => {
    const partial = { ...output() } as Record<string, unknown>;
    delete partial.invoice_number;
    expect(validateExtraction(partial)?.invoice_number).toBe("");
  });
});

describe("toResult", () => {
  it("convertit les montants en centimes", () => {
    const result = toResult(output());
    expect(result.amount_cents).toBe(1500);
    expect(result.tax_cents).toBe(250);
  });

  it("transforme les chaînes vides en null", () => {
    const result = toResult(
      output({ merchant: "", total_amount: "", document_date: "", invoice_number: "" }),
    );
    expect(result.merchant).toBeNull();
    expect(result.amount_cents).toBeNull();
    expect(result.document_date).toBeNull();
  });

  it("baisse la confiance quand un montant annoncé est illisible", () => {
    // Sans cela, la pièce partirait avec un total manquant et une confiance
    // intacte — personne ne verrait le problème.
    const result = toResult(output({ total_amount: "quinze euros", confidence: 0.98 }));
    expect(result.amount_cents).toBeNull();
    expect(result.confidence).toBeLessThanOrEqual(0.5);
  });

  it("ne pénalise pas une pièce sans montant annoncé", () => {
    const result = toResult(output({ total_amount: "", confidence: 0.93 }));
    expect(result.confidence).toBe(0.93);
  });

  it("marque la provenance", () => {
    expect(toResult(output()).source).toBe("llm");
    expect(toResult(output()).prompt_version).toBeTruthy();
  });
});

describe("buildExtractionPrompt", () => {
  const email = {
    subject: "Votre facture",
    from_email: "billing@notion.so",
    from_name: "Notion",
    received_at: new Date("2026-07-12T08:00:00Z"),
    text: "Total : 15,00 €",
    attachmentNames: ["facture.pdf"],
  };

  it("porte l'expéditeur, l'objet, la date et les pièces jointes", () => {
    const prompt = buildExtractionPrompt(email);
    expect(prompt).toContain("Notion <billing@notion.so>");
    expect(prompt).toContain("Objet : Votre facture");
    expect(prompt).toContain("2026-07-12");
    expect(prompt).toContain("facture.pdf");
  });

  it("annonce explicitement l'absence de pièce jointe", () => {
    const prompt = buildExtractionPrompt({ ...email, attachmentNames: [] });
    expect(prompt).toContain("Pièces jointes : aucune");
  });

  it("tronque un corps interminable", () => {
    // Pieds de page juridiques et fils cités multiplient montants et dates
    // sans rien apporter : ce qui compte sur une facture est en tête.
    const prompt = buildExtractionPrompt({ ...email, text: "a".repeat(50_000) });
    expect(prompt.length).toBeLessThan(13_000);
  });
});
