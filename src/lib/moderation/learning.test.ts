import { beforeAll, describe, expect, it } from "vitest";

import { DeterministicEmbeddings } from "./embeddings";
import {
  diffSnapshots,
  directValidationRate,
  planLearning,
  planRollback,
  recordCorrection,
  recordDirectValidation,
  suggestDuplicate,
  type FaqSnapshot,
} from "./learning";
import { validateGeneration } from "./draft-prompt";
import type { FaqMatch } from "./faq-search";

const provider = new DeterministicEmbeddings();

const EXISTING = {
  id: "livraison",
  question_canonical: "Quels sont les délais de livraison ?",
  variants: ["combien de temps pour recevoir ma commande"],
  answer_fr: "Nos commandes partent en 24 h.",
  answer_en: null,
};

describe("détection de doublon", () => {
  let entries: { id: string; question_canonical: string; embedding: number[] }[];

  beforeAll(async () => {
    entries = [
      {
        id: "livraison",
        question_canonical: "Quels sont les délais de livraison ?",
        embedding: await provider.embed(
          "Quels sont les délais de livraison ?\ncombien de temps pour recevoir ma commande",
        ),
      },
      {
        id: "retour",
        question_canonical: "Comment retourner un article ?",
        embedding: await provider.embed("Comment retourner un article ?"),
      },
    ];
  });

  it("propose d'enrichir plutôt que de créer un doublon", async () => {
    const embedding = await provider.embed(
      "combien de temps pour recevoir ma commande",
    );
    const suggestion = suggestDuplicate({ questionEmbedding: embedding, entries });

    expect(suggestion).not.toBeNull();
    expect(suggestion!.entryId).toBe("livraison");
  });

  it("ne propose rien sur une question réellement nouvelle", async () => {
    const embedding = await provider.embed(
      "Proposez-vous des cartes cadeaux dématérialisées ?",
    );
    expect(suggestDuplicate({ questionEmbedding: embedding, entries })).toBeNull();
  });
});

describe("plan d'apprentissage — création", () => {
  it("crée une entrée et garde la formulation du client en variante", () => {
    const plan = planLearning({
      correction: {
        questionCanonical: "Proposez-vous des cartes cadeaux ?",
        answer: "Oui, en version dématérialisée de 20 à 200 €.",
        locale: "fr",
        categoryId: "cat-1",
        channels: ["instagram"],
        updateFaq: true,
        enrichEntryId: null,
      },
      originalQuestion: "salut vous faites des cartes cadeau ?",
      existingEntry: null,
    });

    expect(plan.action).toBe("create");
    if (plan.action !== "create") return;
    expect(plan.entry.answer_fr).toContain("dématérialisée");
    expect(plan.entry.answer_en).toBeNull();
    // La formulation réelle du client est ce qui fera reconnaître la question
    // la prochaine fois.
    expect(plan.entry.variants).toContain("salut vous faites des cartes cadeau ?");
    expect(plan.embeddingText).toContain("cartes cadeau");
  });

  it("range la réponse dans la bonne langue", () => {
    const plan = planLearning({
      correction: {
        questionCanonical: "Do you ship to the UK?",
        answer: "Yes, delivery to the UK takes 5 business days.",
        locale: "en",
        categoryId: null,
        channels: [],
        updateFaq: true,
        enrichEntryId: null,
      },
      originalQuestion: "do you ship to england",
      existingEntry: null,
    });

    expect(plan.action).toBe("create");
    if (plan.action !== "create") return;
    expect(plan.entry.answer_en).toContain("5 business days");
    expect(plan.entry.answer_fr).toBeNull();
  });
});

describe("plan d'apprentissage — enrichissement", () => {
  it("ajoute la formulation du client aux variantes existantes", () => {
    const plan = planLearning({
      correction: {
        questionCanonical: "Quels sont les délais de livraison ?",
        answer: "Nos commandes partent en 24 h et arrivent en 2 à 4 jours ouvrés.",
        locale: "fr",
        categoryId: null,
        channels: [],
        updateFaq: true,
        enrichEntryId: "livraison",
      },
      originalQuestion: "ça arrive quand mon colis svp",
      existingEntry: EXISTING,
    });

    expect(plan.action).toBe("enrich");
    if (plan.action !== "enrich") return;
    expect(plan.entryId).toBe("livraison");
    expect(plan.patch.variants).toContain("combien de temps pour recevoir ma commande");
    expect(plan.patch.variants).toContain("ça arrive quand mon colis svp");
    expect(plan.patch.answer_fr).toContain("2 à 4 jours");
    // Les variantes ont changé : l'embedding doit être recalculé, sinon la
    // nouvelle formulation ne sera jamais retrouvée.
    expect(plan.reembed).toBe(true);
    expect(plan.embeddingText).toContain("ça arrive quand mon colis svp");
  });

  it("ne réécrit pas la question canonique d'une entrée existante", () => {
    const plan = planLearning({
      correction: {
        questionCanonical: "Délais d'expédition",
        answer: "24 h.",
        locale: "fr",
        categoryId: null,
        channels: [],
        updateFaq: true,
        enrichEntryId: "livraison",
      },
      originalQuestion: "delai expedition ?",
      existingEntry: EXISTING,
    });

    expect(plan.action).toBe("enrich");
    if (plan.action !== "enrich") return;
    // La canonique proposée devient une variante, pas un remplacement silencieux.
    expect(plan.patch.variants).toContain("Délais d'expédition");
    expect(plan.patch).not.toHaveProperty("question_canonical");
  });

  it("évite les variantes en double", () => {
    const plan = planLearning({
      correction: {
        questionCanonical: "Quels sont les délais de livraison ?",
        answer: "24 h.",
        locale: "fr",
        categoryId: null,
        channels: [],
        updateFaq: true,
        enrichEntryId: "livraison",
      },
      originalQuestion: "Combien de temps pour recevoir ma commande",
      existingEntry: EXISTING,
    });

    expect(plan.action).toBe("enrich");
    if (plan.action !== "enrich") return;
    const lowered = plan.patch.variants!.map((v) => v.toLowerCase());
    expect(new Set(lowered).size).toBe(lowered.length);
  });
});

describe("plan d'apprentissage — refus d'enrichir", () => {
  it("respecte la case décochée : la réponse part sans toucher à la FAQ", () => {
    const plan = planLearning({
      correction: {
        questionCanonical: "Question ponctuelle",
        answer: "Réponse ponctuelle.",
        locale: "fr",
        categoryId: null,
        channels: [],
        updateFaq: false,
        enrichEntryId: null,
      },
      originalQuestion: "cas particulier",
      existingEntry: null,
    });

    expect(plan.action).toBe("none");
  });
});

describe("versionnage", () => {
  const V1: FaqSnapshot = {
    question_canonical: "Quels sont les délais de livraison ?",
    variants: ["combien de temps"],
    answer_fr: "48 h.",
    answer_en: null,
    category_id: null,
    channels: [],
    priority: 0,
    active: true,
  };

  const V2: FaqSnapshot = {
    ...V1,
    answer_fr: "24 h.",
    variants: ["combien de temps", "ça arrive quand"],
  };

  it("produit un diff champ par champ", () => {
    const diff = diffSnapshots(V1, V2);
    const fields = diff.map((entry) => entry.field);

    expect(fields).toContain("answer_fr");
    expect(fields).toContain("variants");
    expect(fields).not.toContain("question_canonical");

    const answerDiff = diff.find((entry) => entry.field === "answer_fr")!;
    expect(answerDiff.before).toBe("48 h.");
    expect(answerDiff.after).toBe("24 h.");
  });

  it("traite une création comme un diff complet", () => {
    const diff = diffSnapshots(null, V1);
    expect(diff.length).toBeGreaterThan(0);
    expect(diff.every((entry) => entry.before === null)).toBe(true);
  });

  it("un rollback crée une nouvelle version au lieu d'effacer le passé", () => {
    const plan = planRollback({
      current: V2,
      target: V1,
      targetVersion: 1,
      latestVersion: 2,
    });

    // Version 3 dont le contenu est celui de la 1 : on peut annuler le rollback.
    expect(plan.version).toBe(3);
    expect(plan.snapshot.answer_fr).toBe("48 h.");
    expect(plan.reason).toContain("version 1");
    expect(plan.diff.map((entry) => entry.field)).toContain("answer_fr");
  });
});

describe("statistiques d'une entrée", () => {
  const base = {
    usage_count: 10,
    direct_validation_count: 8,
    correction_count: 2,
    confidence: 0.9,
  };

  it("une validation directe fait remonter la confiance", () => {
    const next = recordDirectValidation(base);
    expect(next.usage_count).toBe(11);
    expect(next.direct_validation_count).toBe(9);
    expect(next.confidence).toBeGreaterThan(base.confidence);
  });

  it("une correction fait baisser la confiance", () => {
    const next = recordCorrection(base);
    expect(next.usage_count).toBe(11);
    expect(next.correction_count).toBe(3);
    expect(next.confidence).toBeLessThan(base.confidence);
  });

  it("calcule le taux de validation directe", () => {
    expect(directValidationRate(base)).toBeCloseTo(0.8, 5);
    expect(directValidationRate({ usage_count: 0, direct_validation_count: 0 })).toBeNull();
  });
});

describe("validation de la sortie du modèle", () => {
  const matches = [
    {
      entry: { id: "livraison", question_canonical: "Délais ?" },
      similarity: 0.88,
      score: 0.88,
    },
  ] as unknown as FaqMatch[];

  it("écarte un identifiant FAQ que la recherche n'a pas fourni", () => {
    // Un modèle contraint par schéma peut malgré tout citer un id inventé.
    const result = validateGeneration(
      {
        can_answer: true,
        answer: "Nos commandes partent en 24 h.",
        language: "fr",
        confidence: 0.9,
        used_faq_entry_ids: ["livraison", "entree-inventee"],
        missing_information: "",
      },
      matches,
    );

    expect(result.droppedIds).toEqual(["entree-inventee"]);
    expect(result.sources).toHaveLength(1);
    expect(result.usable).toBe(true);
  });

  it("rétrograde un brouillon sans aucune source vérifiable", () => {
    const result = validateGeneration(
      {
        can_answer: true,
        answer: "Une réponse plausible mais non sourcée.",
        language: "fr",
        confidence: 0.95,
        used_faq_entry_ids: ["inconnue"],
        missing_information: "",
      },
      matches,
    );

    expect(result.usable).toBe(false);
  });

  it("rétrograde une réponse vide", () => {
    const result = validateGeneration(
      {
        can_answer: true,
        answer: "   ",
        language: "fr",
        confidence: 0.9,
        used_faq_entry_ids: ["livraison"],
        missing_information: "",
      },
      matches,
    );
    expect(result.usable).toBe(false);
  });

  it("borne la confiance dans [0, 1]", () => {
    const high = validateGeneration(
      {
        can_answer: true,
        answer: "ok",
        language: "fr",
        confidence: 3.7,
        used_faq_entry_ids: ["livraison"],
        missing_information: "",
      },
      matches,
    );
    expect(high.confidence).toBe(1);
  });
});
