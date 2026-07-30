import { cosineSimilarity, type EmbeddingProvider } from "./embeddings";
import type { ModerationChannel, SupportedLocale } from "./types";

/**
 * Recherche sémantique dans la FAQ d'un client.
 *
 * Deux seuils, et la distinction entre eux est le cœur du produit :
 *
 *   • `MATCH_THRESHOLD` — en dessous, l'entrée n'est pas retenue du tout.
 *   • `ANSWERABLE_THRESHOLD` — si la meilleure entrée n'atteint pas ce niveau,
 *     on ne génère **aucun** brouillon. La conversation passe en
 *     « sans réponse disponible » et attend un humain.
 *
 * Le second seuil est ce qui empêche le modèle d'inventer. Sans lui, une
 * question hors FAQ produirait une réponse plausible et fausse — exactement ce
 * qu'un outil de réponse client ne peut pas se permettre.
 */

export const MATCH_THRESHOLD = 0.45;
export const ANSWERABLE_THRESHOLD = 0.62;
export const MAX_SOURCES = 4;

export type SearchableEntry = {
  id: string;
  question_canonical: string;
  variants: string[];
  answer_fr: string | null;
  answer_en: string | null;
  category_name: string | null;
  channels: ModerationChannel[];
  priority: number;
  active: boolean;
  confidence: number;
  embedding: number[] | null;
};

export type FaqMatch = {
  entry: SearchableEntry;
  similarity: number;
  /** Similarité pondérée par la priorité et la confiance de l'entrée. */
  score: number;
};

export type FaqSearchResult =
  | { answerable: true; matches: FaqMatch[]; best: FaqMatch }
  | { answerable: false; matches: FaqMatch[]; reason: "no_match" | "below_threshold" };

/**
 * Une entrée est-elle candidate pour ce canal ?
 *
 * `channels` vide signifie « tous les canaux » — c'est le cas par défaut d'une
 * entrée importée depuis Monday, où la colonne n'existe pas forcément. Ici la
 * liste vide est permissive, contrairement à l'auto-envoi où elle est
 * restrictive : une FAQ sans canal précisé reste utilisable partout, alors qu'un
 * auto-envoi sans canal choisi ne doit rien laisser passer.
 */
function matchesChannel(
  entry: SearchableEntry,
  channel: ModerationChannel,
): boolean {
  return entry.channels.length === 0 || entry.channels.includes(channel);
}

export async function searchFaq(options: {
  question: string;
  entries: readonly SearchableEntry[];
  channel: ModerationChannel;
  provider: EmbeddingProvider;
  maxSources?: number;
}): Promise<FaqSearchResult> {
  const { question, entries, channel, provider } = options;
  const maxSources = options.maxSources ?? MAX_SOURCES;

  const queryVector = await provider.embed(question);

  const matches: FaqMatch[] = [];
  for (const entry of entries) {
    if (!entry.active || !entry.embedding) continue;
    if (!matchesChannel(entry, channel)) continue;

    const similarity = cosineSimilarity(queryVector, entry.embedding);
    if (similarity < MATCH_THRESHOLD) continue;

    matches.push({ entry, similarity, score: rank(similarity, entry) });
  }

  matches.sort((a, b) => b.score - a.score);
  const kept = matches.slice(0, maxSources);

  if (kept.length === 0) {
    return { answerable: false, matches: [], reason: "no_match" };
  }

  // Le seuil de réponse porte sur la **similarité brute** de la meilleure
  // entrée, pas sur son score pondéré : une entrée prioritaire ne doit pas
  // pouvoir franchir le seuil par sa seule priorité.
  const best = kept[0]!;
  if (best.similarity < ANSWERABLE_THRESHOLD) {
    return { answerable: false, matches: kept, reason: "below_threshold" };
  }

  return { answerable: true, matches: kept, best };
}

/**
 * Pondération. La similarité domine ; priorité et confiance ne font que
 * départager. Une entrée souvent corrigée (confiance basse) descend, une entrée
 * marquée prioritaire remonte — sans jamais renverser un écart de sens réel.
 */
function rank(similarity: number, entry: SearchableEntry): number {
  const priorityBoost = 1 + Math.min(entry.priority, 10) * 0.01;
  const confidenceWeight = 0.85 + entry.confidence * 0.15;
  return similarity * priorityBoost * confidenceWeight;
}

/**
 * Réponse à servir pour une langue donnée.
 *
 * Si l'anglais manque, on part du français en le signalant : `translated` remonte
 * jusqu'à l'interface, qui affiche un avertissement sous le brouillon. Servir une
 * traduction sans le dire serait le vrai problème.
 */
export function resolveAnswer(
  entry: SearchableEntry,
  locale: SupportedLocale,
): { text: string; translated: boolean } | null {
  if (locale === "en") {
    if (entry.answer_en) return { text: entry.answer_en, translated: false };
    if (entry.answer_fr) return { text: entry.answer_fr, translated: true };
    return null;
  }
  if (entry.answer_fr) return { text: entry.answer_fr, translated: false };
  return null;
}

/** Entrées à retravailler : souvent citées, souvent corrigées. */
export function needsRework(entry: {
  usage_count: number;
  correction_count: number;
  confidence: number;
}): boolean {
  if (entry.usage_count < 3) return false;
  const correctionRate = entry.correction_count / entry.usage_count;
  return correctionRate >= 0.34 || entry.confidence < 0.6;
}
