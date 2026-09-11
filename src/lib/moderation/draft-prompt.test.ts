import { describe, expect, it } from "vitest";

import {
  buildSystemPrompt,
  buildUserPrompt,
  validateGeneration,
  type DraftGeneration,
} from "./draft-prompt";
import type { FaqMatch, SearchableEntry } from "./faq-search";
import type { ToneSettings } from "./types";

const entry = (overrides: Partial<SearchableEntry> = {}): SearchableEntry => ({
  id: "livraison",
  question_canonical: "Quels sont les délais de livraison ?",
  variants: [],
  answer_fr: "Nos commandes partent en 24 h.",
  answer_en: null,
  category_name: null,
  channels: [],
  priority: 0,
  active: true,
  confidence: 1,
  embedding: null,
  ...overrides,
});

const match = (overrides: Partial<FaqMatch> = {}): FaqMatch => ({
  entry: entry(),
  similarity: 0.88,
  score: 0.88,
  ...overrides,
});

const tone = (overrides: Partial<ToneSettings> = {}): ToneSettings => ({
  address: "vous",
  signature: null,
  emojis_allowed: false,
  target_length: "long",
  ...overrides,
});

const generation = (overrides: Partial<DraftGeneration> = {}): DraftGeneration => ({
  grounded_in_faq: true,
  answer: "Nos commandes partent en 24 h.",
  language: "fr",
  confidence: 0.9,
  used_faq_entry_ids: ["livraison"],
  missing_information: "",
  ...overrides,
});

describe("buildSystemPrompt", () => {
  it("impose une réponse très courte sur un commentaire, quel que soit le réglage de longueur", () => {
    // Le type de conversation prime sur `tone.target_length` : un paragraphe
    // de huit phrases sous un post ne se lit pas.
    const prompt = buildSystemPrompt({
      clientName: "Bondet",
      tone: tone({ target_length: "long" }),
      locale: "fr",
      kind: "comment",
    });

    expect(prompt).toContain("Une à deux phrases");
    expect(prompt).not.toContain("huit phrases");
    expect(prompt).toContain("commentaire");
  });

  it("ouvre par « Bonjour » et signe « L'équipe » en message privé", () => {
    const prompt = buildSystemPrompt({
      clientName: "Bondet",
      tone: tone(),
      locale: "fr",
      kind: "dm",
    });

    expect(prompt).toContain("Commence par « Bonjour »");
    expect(prompt).toContain("L'équipe Bondet");
  });

  it("garde la signature réglée par le client quand il y en a une", () => {
    const prompt = buildSystemPrompt({
      clientName: "Bondet",
      tone: tone({ signature: "Camille" }),
      locale: "fr",
      kind: "dm",
    });

    expect(prompt).toContain("« Camille »");
    expect(prompt).not.toContain("L'équipe Bondet");
  });

  it("n'ajoute ni accroche ni signature sous un commentaire", () => {
    const prompt = buildSystemPrompt({
      clientName: "Bondet",
      tone: tone(),
      locale: "fr",
      kind: "comment",
    });

    expect(prompt).toContain("sans formule d'accroche");
    expect(prompt).toContain("N'ajoute aucune signature");
  });

  it("demande une réponse même hors FAQ, sans autoriser l'invention", () => {
    const prompt = buildSystemPrompt({
      clientName: "Bondet",
      tone: tone(),
      locale: "fr",
      kind: "dm",
    });

    expect(prompt).toContain("tu rédiges quand même");
    expect(prompt).toContain("N'invente jamais");
  });
});

describe("buildUserPrompt", () => {
  it("rend un bloc FAQ cacheable quand des extraits existent", () => {
    const { faqBlock, questionBlock } = buildUserPrompt({
      matches: [match()],
      method: "embedding",
      answerable: true,
      locale: "fr",
      conversationExcerpt: "",
      question: "Vous livrez en combien de temps ?",
      channelLabel: "Instagram",
      kind: "comment",
    });

    expect(faqBlock).toContain("id: livraison");
    expect(faqBlock).toContain("Rapprochement par sens");
    expect(questionBlock).toContain("Vous livrez en combien de temps ?");
  });

  it("dit qu'un rapprochement lexical est une approximation", () => {
    const { faqBlock } = buildUserPrompt({
      matches: [match({ similarity: 0.2 })],
      method: "lexical",
      answerable: false,
      locale: "fr",
      conversationExcerpt: "",
      question: "vous livrez où ?",
      channelLabel: "Instagram",
      kind: "comment",
    });

    expect(faqBlock).toContain("approximation");
    expect(faqBlock).toContain("pistes");
  });

  it("tourne sans bloc FAQ quand rien ne s'approche", () => {
    // FAQ vide ou hors sujet : le prompt part quand même, il ne refuse pas de
    // tourner — c'est le cœur de la règle du module.
    const { faqBlock, questionBlock } = buildUserPrompt({
      matches: [],
      method: "lexical",
      answerable: false,
      locale: "fr",
      conversationExcerpt: "",
      question: "vous recrutez ?",
      channelLabel: "Instagram",
      kind: "comment",
    });

    expect(faqBlock).toBeNull();
    expect(questionBlock).toContain("Aucun extrait de FAQ");
  });
});

describe("validateGeneration", () => {
  it("écarte un identifiant FAQ que la recherche n'a pas fourni", () => {
    // Un modèle contraint par schéma peut malgré tout citer un id inventé.
    const result = validateGeneration(
      generation({ used_faq_entry_ids: ["livraison", "entree-inventee"] }),
      [match()],
    );

    expect(result.droppedIds).toEqual(["entree-inventee"]);
    expect(result.sources).toHaveLength(1);
    expect(result.usable).toBe(true);
    expect(result.grounded).toBe(true);
  });

  it("accepte un brouillon sans source et le marque non sourcé", () => {
    // L'ancien verrou rétrogradait cette réponse et laissait l'écran vide.
    const result = validateGeneration(
      generation({
        grounded_in_faq: false,
        answer: "On regarde ça et on revient vers vous en message privé.",
        used_faq_entry_ids: [],
        confidence: 0.3,
      }),
      [],
    );

    expect(result.usable).toBe(true);
    expect(result.grounded).toBe(false);
    expect(result.sources).toEqual([]);
  });

  it("ne croit pas un modèle qui se dit sourcé sans citer d'entrée vérifiable", () => {
    const result = validateGeneration(
      generation({ grounded_in_faq: true, used_faq_entry_ids: ["inconnue"] }),
      [match()],
    );

    expect(result.usable).toBe(true);
    expect(result.grounded).toBe(false);
  });

  it("refuse une réponse vide", () => {
    const result = validateGeneration(generation({ answer: "   " }), [match()]);
    expect(result.usable).toBe(false);
  });

  it("borne la confiance dans [0, 1]", () => {
    expect(validateGeneration(generation({ confidence: 3.7 }), [match()]).confidence).toBe(1);
    expect(validateGeneration(generation({ confidence: -2 }), [match()]).confidence).toBe(0);
  });
});
