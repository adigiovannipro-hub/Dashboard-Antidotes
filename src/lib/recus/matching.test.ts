import { describe, expect, it } from "vitest";

import {
  matchDocument,
  normalizeMerchant,
  similarity,
  type MatchableDocument,
  type MatchableExpense,
} from "./matching";

const expense = (
  overrides: Partial<MatchableExpense> & { id: string },
): MatchableExpense => ({
  amount_cents: 2450,
  currency: "EUR",
  billing_amount_cents: null,
  billing_currency: null,
  transaction_date: "2026-07-12",
  posted_at: null,
  merchant: "GRAB",
  attachment_count: 0,
  ...overrides,
});

const document = (
  overrides: Partial<MatchableDocument> = {},
): MatchableDocument => ({
  amount_cents: 2450,
  currency: "EUR",
  document_date: "2026-07-12",
  received_at: "2026-07-12T09:00:00Z",
  merchant: "Grab",
  ...overrides,
});

describe("normalizeMerchant", () => {
  it("retire accents, casse et ponctuation", () => {
    expect(normalizeMerchant("Café Été, S.A.S.")).toBe("cafe ete");
  });

  it("retire les formes juridiques", () => {
    expect(normalizeMerchant("Notion Labs Inc")).toBe("notion labs");
    expect(normalizeMerchant("Anthropic PBC GmbH")).toBe("anthropic pbc");
  });

  it("retire les préfixes des réseaux de paiement", () => {
    // Sans cela, deux marchands sans rapport passés par Square se
    // ressembleraient plus que le même marchand vu des deux côtés.
    expect(normalizeMerchant("SQ *LE PETIT CAFE")).toBe("le petit cafe");
    expect(normalizeMerchant("PAYPAL *NOTION")).toBe("notion");
    expect(normalizeMerchant("AMZN Mktp FR")).toBe("fr");
  });

  it("retire les nombres isolés des libellés de terminal", () => {
    expect(normalizeMerchant("CARREFOUR 4412")).toBe("carrefour");
  });

  it("rend une chaîne vide sur une entrée absente", () => {
    expect(normalizeMerchant(null)).toBe("");
  });
});

describe("similarity", () => {
  it("vaut 1 sur deux chaînes identiques", () => {
    expect(similarity("notion", "notion")).toBe(1);
  });

  it("reste élevée quand un mot est ajouté", () => {
    expect(similarity("notion", "notion labs")).toBeGreaterThan(0.8);
  });

  it("reste basse sur deux marchands différents", () => {
    expect(similarity("carrefour", "notion")).toBeLessThan(0.3);
  });

  it("vaut 0 si une chaîne est vide", () => {
    expect(similarity("", "notion")).toBe(0);
  });
});

describe("matchDocument", () => {
  it("rapproche montant et date identiques avec une confiance forte", () => {
    const result = matchDocument(document(), [expense({ id: "a" })]);

    expect(result.best?.expense_id).toBe("a");
    expect(result.best?.method).toBe("exact");
    expect(result.best!.confidence).toBeGreaterThan(0.9);
    expect(result.ambiguous).toBe(false);
  });

  it("écarte une dépense d'un montant sans rapport", () => {
    const result = matchDocument(document(), [
      expense({ id: "a", amount_cents: 19_900 }),
    ]);
    expect(result.best).toBeNull();
  });

  it("tolère un écart de quelques centimes", () => {
    // Frais de service ou arrondi : l'écart est plausible, la ligne reste
    // candidate mais avec une confiance moindre qu'un montant identique.
    const result = matchDocument(document(), [
      expense({ id: "a", amount_cents: 2500 }),
    ]);
    expect(result.best?.expense_id).toBe("a");
    expect(result.best?.method).toBe("fuzzy");
  });

  it("écarte une dépense trop éloignée dans le temps", () => {
    const result = matchDocument(document(), [
      expense({ id: "a", transaction_date: "2026-05-01" }),
    ]);
    expect(result.best).toBeNull();
  });

  it("accepte le décalage entre date de transaction et date de comptabilisation", () => {
    const result = matchDocument(document(), [
      expense({ id: "a", transaction_date: "2026-07-14" }),
    ]);
    expect(result.best?.expense_id).toBe("a");
  });

  it("refuse de comparer deux devises différentes", () => {
    // 24,50 USD et 24,50 EUR ne sont pas le même paiement, et deviner un taux
    // de change produirait un faux rapprochement plausible — le pire des cas.
    const result = matchDocument(document({ currency: "USD" }), [
      expense({ id: "a", currency: "EUR" }),
    ]);
    expect(result.best).toBeNull();
  });

  it("signale l'ambiguïté quand deux dépenses sont indiscernables", () => {
    // Deux courses le même jour au même prix : le score ne peut pas trancher.
    const result = matchDocument(document(), [
      expense({ id: "a" }),
      expense({ id: "b" }),
    ]);

    expect(result.ambiguous).toBe(true);
    expect(result.candidates).toHaveLength(2);
  });

  it("départage deux montants identiques par le nom du marchand", () => {
    const result = matchDocument(document({ merchant: "Notion" }), [
      expense({ id: "grab", merchant: "GRAB SINGAPORE" }),
      expense({ id: "notion", merchant: "PAYPAL *NOTION LABS" }),
    ]);

    expect(result.best?.expense_id).toBe("notion");
    expect(result.ambiguous).toBe(false);
  });

  it("préfère une ligne encore sans pièce jointe, à score égal", () => {
    const result = matchDocument(document(), [
      expense({ id: "deja-rangee", attachment_count: 2 }),
      expense({ id: "nue", attachment_count: 0 }),
    ]);
    expect(result.best?.expense_id).toBe("nue");
  });

  it("plafonne la confiance quand la pièce n'a pas de montant", () => {
    // Date et marchand seuls ne feront jamais une certitude, et ce plafond est
    // ce qui empêche un envoi automatique sur cette base.
    const result = matchDocument(
      document({ amount_cents: null, currency: null }),
      [expense({ id: "a" })],
    );
    expect(result.best!.confidence).toBeLessThanOrEqual(0.5);
  });

  it("classe les candidats du plus probable au moins probable", () => {
    const result = matchDocument(document(), [
      expense({ id: "loin", transaction_date: "2026-07-20" }),
      expense({ id: "proche", transaction_date: "2026-07-12" }),
    ]);

    expect(result.candidates.map((candidate) => candidate.expense_id)).toEqual([
      "proche",
      "loin",
    ]);
  });

  it("rend une liste vide plutôt qu'un mauvais candidat", () => {
    expect(matchDocument(document(), []).candidates).toEqual([]);
  });

  it("explique chaque candidat en clair", () => {
    const result = matchDocument(document(), [expense({ id: "a" })]);
    expect(result.best?.reason).toContain("Montant identique");
  });
});

describe("matchDocument — les deux montants d'une dépense", () => {
  it("rapproche un e-reçu en devise locale d'une dépense au débit converti", () => {
    // Le cas Grab du 7 août : l'e-reçu dit 154 400 IDR, la carte a débité
    // 7,56 EUR. La pièce doit se comparer au montant local, pas au débit.
    const result = matchDocument(
      document({ amount_cents: 15_440_000, currency: "IDR", merchant: "Grab" }),
      [
        expense({
          id: "grab",
          amount_cents: 15_440_000,
          currency: "IDR",
          billing_amount_cents: 756,
          billing_currency: "EUR",
        }),
      ],
    );

    expect(result.best?.expense_id).toBe("grab");
    expect(result.best?.method).toBe("exact");
  });

  it("rapproche aussi une pièce libellée dans la devise du débit", () => {
    // L'inverse existe : une facture d'abonnement européenne parle en EUR,
    // même si la ligne carte est portée en devise locale.
    const result = matchDocument(
      document({ amount_cents: 756, currency: "EUR", merchant: "Grab" }),
      [
        expense({
          id: "grab",
          amount_cents: 15_440_000,
          currency: "IDR",
          billing_amount_cents: 756,
          billing_currency: "EUR",
        }),
      ],
    );

    expect(result.best?.expense_id).toBe("grab");
  });

  it("refuse toujours quand aucune devise ne coïncide — jamais de taux deviné", () => {
    const result = matchDocument(
      document({ amount_cents: 999, currency: "USD" }),
      [
        expense({
          id: "grab",
          amount_cents: 15_440_000,
          currency: "IDR",
          billing_amount_cents: 756,
          billing_currency: "EUR",
        }),
      ],
    );

    expect(result.best).toBeNull();
  });
});
