import { beforeAll, describe, expect, it } from "vitest";

import { DeterministicEmbeddings, faqEmbeddingText } from "./embeddings";
import {
  ANSWERABLE_THRESHOLD,
  MATCH_THRESHOLD,
  needsRework,
  resolveAnswer,
  searchFaq,
  type SearchableEntry,
} from "./faq-search";

/**
 * Fournisseur déterministe : les tests ne doivent pas dépendre du
 * téléchargement d'un modèle de 25 Mo, ni de sa version.
 */
const provider = new DeterministicEmbeddings();

type EntrySeed = Omit<SearchableEntry, "embedding">;

const SEEDS: EntrySeed[] = [
  {
    id: "livraison",
    question_canonical: "Quels sont les délais de livraison ?",
    variants: [
      "combien de temps pour recevoir ma commande",
      "quand vais-je recevoir mon colis",
      "delai expedition livraison",
    ],
    answer_fr: "Nos commandes partent en 24 h et arrivent en 2 à 4 jours ouvrés.",
    answer_en: "Orders ship within 24 hours and arrive in 2–4 business days.",
    category_name: "livraison",
    channels: [],
    priority: 0,
    active: true,
    confidence: 1,
  },
  {
    id: "retour",
    question_canonical: "Comment retourner un article ?",
    variants: ["procedure de retour", "renvoyer un article", "echange taille"],
    answer_fr: "Vous disposez de 30 jours pour retourner un article non porté.",
    answer_en: null,
    category_name: "sav",
    channels: [],
    priority: 0,
    active: true,
    confidence: 1,
  },
  {
    id: "tailles",
    question_canonical: "Comment choisir ma taille ?",
    variants: ["guide des tailles", "je fais du 38 quelle taille prendre"],
    answer_fr: "Le guide des tailles est disponible sur chaque fiche produit.",
    answer_en: "A size guide is available on every product page.",
    category_name: "produit",
    channels: ["instagram"],
    priority: 0,
    active: true,
    confidence: 1,
  },
  {
    id: "boutique-inactive",
    question_canonical: "Où se trouve votre boutique ?",
    variants: ["adresse magasin"],
    answer_fr: "Notre boutique est au 12 rue de la Paix, Paris.",
    answer_en: null,
    category_name: "general",
    channels: [],
    priority: 0,
    active: false,
    confidence: 1,
  },
];

let entries: SearchableEntry[];

beforeAll(async () => {
  entries = await Promise.all(
    SEEDS.map(async (seed) => ({
      ...seed,
      embedding: await provider.embed(faqEmbeddingText(seed)),
    })),
  );
});

describe("recherche FAQ — correspondance", () => {
  it("retrouve l'entrée pertinente sur une formulation proche d'une variante", async () => {
    const result = await searchFaq({
      question: "combien de temps pour recevoir ma commande ?",
      entries,
      channel: "instagram",
      provider,
    });

    expect(result.answerable).toBe(true);
    if (!result.answerable) return;
    expect(result.best.entry.id).toBe("livraison");
    expect(result.best.similarity).toBeGreaterThanOrEqual(ANSWERABLE_THRESHOLD);
  });

  it("classe les correspondances par pertinence décroissante", async () => {
    const result = await searchFaq({
      question: "quand vais-je recevoir mon colis",
      entries,
      channel: "instagram",
      provider,
    });

    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches[0]!.entry.id).toBe("livraison");
    for (let index = 1; index < result.matches.length; index += 1) {
      expect(result.matches[index - 1]!.score).toBeGreaterThanOrEqual(
        result.matches[index]!.score,
      );
    }
  });

  it("écarte les entrées sous le seuil de correspondance", async () => {
    const result = await searchFaq({
      question: "combien de temps pour recevoir ma commande ?",
      entries,
      channel: "instagram",
      provider,
    });
    for (const match of result.matches) {
      expect(match.similarity).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
    }
  });
});

describe("recherche FAQ — absence de réponse", () => {
  it("ne se dit pas couverte sur une question hors FAQ", async () => {
    // `answerable` ne bloque plus la génération — le modèle est appelé dans
    // tous les cas — mais il commande le statut du brouillon : sourcé, ou
    // proposition. Une question hors FAQ ne doit jamais passer pour sourcée.
    const result = await searchFaq({
      question: "Est-ce que vous recrutez des développeurs backend en CDI ?",
      entries,
      channel: "instagram",
      provider,
    });

    expect(result.answerable).toBe(false);
    if (result.answerable) return;
    expect(["no_match", "below_threshold"]).toContain(result.reason);
  });

  it("ignore les entrées inactives", async () => {
    const result = await searchFaq({
      question: "adresse magasin boutique",
      entries,
      channel: "instagram",
      provider,
    });
    expect(result.matches.map((match) => match.entry.id)).not.toContain(
      "boutique-inactive",
    );
  });

  it("ignore une entrée restreinte à un autre canal", async () => {
    const result = await searchFaq({
      question: "guide des tailles je fais du 38",
      entries,
      channel: "whatsapp",
      provider,
    });
    expect(result.matches.map((match) => match.entry.id)).not.toContain("tailles");
  });

  it("accepte une entrée sans canal précisé sur n'importe quel canal", async () => {
    const result = await searchFaq({
      question: "combien de temps pour recevoir ma commande ?",
      entries,
      channel: "whatsapp",
      provider,
    });
    expect(result.matches.map((match) => match.entry.id)).toContain("livraison");
  });

  it("plafonne le nombre de sources citées", async () => {
    const result = await searchFaq({
      question: "commande livraison retour taille colis",
      entries,
      channel: "instagram",
      provider,
      maxSources: 2,
    });
    expect(result.matches.length).toBeLessThanOrEqual(2);
  });
});

describe("recherche FAQ — pondération", () => {
  it("la priorité départage sans renverser un écart de sens", async () => {
    const boosted = entries.map((entry) =>
      entry.id === "retour" ? { ...entry, priority: 10 } : entry,
    );

    const result = await searchFaq({
      question: "combien de temps pour recevoir ma commande ?",
      entries: boosted,
      channel: "instagram",
      provider,
    });

    // Malgré une priorité maximale sur « retour », « livraison » reste premier.
    expect(result.answerable).toBe(true);
    if (result.answerable) expect(result.best.entry.id).toBe("livraison");
  });

  it("une entrée peu fiable descend dans le classement", async () => {
    const question = "combien de temps pour recevoir ma commande ?";

    const confident = await searchFaq({ question, entries, channel: "instagram", provider });
    const doubtful = await searchFaq({
      question,
      entries: entries.map((entry) =>
        entry.id === "livraison" ? { ...entry, confidence: 0.1 } : entry,
      ),
      channel: "instagram",
      provider,
    });

    const before = confident.matches.find((m) => m.entry.id === "livraison")!;
    const after = doubtful.matches.find((m) => m.entry.id === "livraison")!;
    expect(after.score).toBeLessThan(before.score);
    // La similarité brute, elle, ne bouge pas : seul le classement change.
    expect(after.similarity).toBeCloseTo(before.similarity, 10);
  });
});

describe("résolution de la réponse par langue", () => {
  it("sert la réponse anglaise quand elle existe", () => {
    const entry = SEEDS[0]! as SearchableEntry;
    expect(resolveAnswer(entry, "en")).toEqual({
      text: "Orders ship within 24 hours and arrive in 2–4 business days.",
      translated: false,
    });
  });

  it("signale la traduction quand l'anglais est absent", () => {
    // Servir une traduction sans le dire serait le vrai problème.
    const entry = SEEDS[1]! as SearchableEntry;
    const resolved = resolveAnswer(entry, "en");
    expect(resolved?.translated).toBe(true);
    expect(resolved?.text).toContain("30 jours");
  });

  it("renvoie null quand aucune réponse n'existe", () => {
    const empty = { ...SEEDS[0]!, answer_fr: null, answer_en: null } as SearchableEntry;
    expect(resolveAnswer(empty, "fr")).toBeNull();
  });
});

describe("entrées à retravailler", () => {
  it("signale une entrée souvent corrigée", () => {
    expect(needsRework({ usage_count: 9, correction_count: 4, confidence: 0.9 })).toBe(
      true,
    );
  });

  it("signale une entrée peu fiable", () => {
    expect(needsRework({ usage_count: 10, correction_count: 1, confidence: 0.5 })).toBe(
      true,
    );
  });

  it("ne signale pas une entrée saine", () => {
    expect(needsRework({ usage_count: 30, correction_count: 2, confidence: 1 })).toBe(
      false,
    );
  });

  it("ne signale pas une entrée trop peu utilisée pour conclure", () => {
    expect(needsRework({ usage_count: 2, correction_count: 2, confidence: 1 })).toBe(
      false,
    );
  });
});

describe("recherche FAQ — repli lexical", () => {
  /** Ce que rend un fournisseur d'embeddings qui ne charge pas — le cas Vercel. */
  const indisponible = {
    id: "absent",
    embed: async () => {
      throw new Error("Failed to load external module");
    },
    embedMany: async () => {
      throw new Error("Failed to load external module");
    },
  };

  it("retrouve l'entrée par recoupement de mots quand aucun vecteur n'est calculable", async () => {
    const result = await searchFaq({
      question: "quels sont les delais de livraison de ma commande",
      entries,
      channel: "instagram",
      provider: indisponible,
    });

    expect(result.method).toBe("lexical");
    expect(result.matches[0]?.entry.id).toBe("livraison");
  });

  it("bascule aussi en lexical quand les entrées n'ont pas de vecteur", async () => {
    const result = await searchFaq({
      question: "quels sont les delais de livraison de ma commande",
      entries: entries.map((entry) => ({ ...entry, embedding: null })),
      channel: "instagram",
      provider,
    });

    expect(result.method).toBe("lexical");
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it("distingue une FAQ vide d'une FAQ qui ne couvre pas la demande", async () => {
    const vide = await searchFaq({
      question: "vous livrez en Belgique ?",
      entries: [],
      channel: "instagram",
      provider,
    });
    expect(vide.answerable).toBe(false);
    if (!vide.answerable) expect(vide.reason).toBe("no_entries");
  });

  it("rend les meilleures approches même sous le seuil de certitude", async () => {
    // Elles partent dans le prompt comme pistes : le modèle doit savoir ce que
    // la FAQ contient de plus proche, même quand ce n'est pas la réponse.
    const result = await searchFaq({
      question: "je voudrais retourner un article recu hier, comment faire le renvoi",
      entries,
      channel: "instagram",
      provider,
      maxSources: 4,
    });

    expect(result.answerable).toBe(false);
    if (result.answerable) return;
    expect(result.reason).toBe("below_threshold");
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches[0]!.similarity).toBeLessThan(ANSWERABLE_THRESHOLD);
  });
});
