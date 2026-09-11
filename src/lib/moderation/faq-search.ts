import { rankBySimilarity } from "@/lib/antidotes/inbound/similarity";

import {
  cosineSimilarity,
  faqEmbeddingText,
  type EmbeddingProvider,
} from "./embeddings";
import type { ModerationChannel, SupportedLocale } from "./types";

/**
 * Recherche dans la FAQ d'un client.
 *
 * **Règle du module : le panneau Modération se réfère toujours à la FAQ de son
 * client, même quand elle n'existe pas encore, n'est pas viable ou est
 * incomplète.** La recherche ne bloque donc plus rien — elle rapporte ce
 * qu'elle a trouvé, à quelle distance, et par quel moyen. C'est le générateur
 * qui décide quoi en faire, et il appelle le modèle dans tous les cas.
 *
 * Deux moyens, la même sortie :
 *
 *   • **par vecteurs**, quand la question et au moins une entrée en ont un —
 *     le cas nominal, celui que `reindexFaqSearch` entretient ;
 *   • **par recoupement lexical** (TF-IDF) sinon. Ce n'est pas un luxe : le
 *     modèle d'embeddings local ne charge pas sur Vercel (`onnxruntime-node`
 *     n'est pas tracé dans le bundle), donc toute recherche lancée depuis une
 *     Server Action serait autrement muette — aucun vecteur calculable pour la
 *     question, donc zéro correspondance sur une FAQ pourtant fournie.
 *
 * Les deux échelles ne sont pas comparables, d'où deux jeux de seuils et la
 * méthode rendue avec le résultat : l'écran et le prompt doivent pouvoir dire
 * qu'un rapprochement lexical est une approximation, jamais une certitude.
 */

export const MATCH_THRESHOLD = 0.45;
export const ANSWERABLE_THRESHOLD = 0.62;

/**
 * Les mêmes seuils transposés au TF-IDF, où les valeurs vivent beaucoup plus
 * bas : deux formulations d'une même question partagent rarement plus du quart
 * de leur vocabulaire pondéré. Garder 0,62 ici reviendrait à ne jamais rien
 * trouver.
 */
export const LEXICAL_MATCH_THRESHOLD = 0.12;
export const LEXICAL_ANSWERABLE_THRESHOLD = 0.3;

export const MAX_SOURCES = 4;

export type FaqSearchMethod = "embedding" | "lexical";

const THRESHOLDS: Record<FaqSearchMethod, { match: number; answerable: number }> = {
  embedding: { match: MATCH_THRESHOLD, answerable: ANSWERABLE_THRESHOLD },
  lexical: { match: LEXICAL_MATCH_THRESHOLD, answerable: LEXICAL_ANSWERABLE_THRESHOLD },
};

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

/**
 * `answerable` ne décide plus de générer ou non — il dit seulement si la FAQ
 * couvre la demande avec assez de certitude pour que la réponse soit présentée
 * comme sourcée.
 *
 *   • `no_entries` — ce client n'a aucune entrée utilisable sur ce canal ;
 *   • `no_match` — il en a, aucune ne s'approche ;
 *   • `below_threshold` — les meilleures sont rendues quand même, avec leur
 *     distance : elles entrent dans le prompt comme approches, jamais comme
 *     réponses.
 */
export type FaqSearchResult =
  | {
      answerable: true;
      matches: FaqMatch[];
      best: FaqMatch;
      method: FaqSearchMethod;
    }
  | {
      answerable: false;
      matches: FaqMatch[];
      method: FaqSearchMethod;
      reason: "no_entries" | "no_match" | "below_threshold";
    };

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

/**
 * Le vecteur de la question, ou `null` quand le fournisseur ne peut pas le
 * calculer. Un échec de chargement du modèle n'est pas une panne du produit :
 * c'est le cas nominal sur Vercel, et il bascule la recherche en lexical.
 */
async function embedQuestion(
  provider: EmbeddingProvider,
  question: string,
): Promise<number[] | null> {
  try {
    const vector = await provider.embed(question);
    return vector.length > 0 ? vector : null;
  } catch {
    return null;
  }
}

/**
 * Rapprochement lexical, emprunté au studio du pôle Antidotes
 * (`inbound/similarity.ts`) : même problème — un modèle d'embeddings qui ne
 * charge pas là où le code tourne — donc même solution, et une seule
 * implémentation de TF-IDF à entretenir.
 */
function lexicalSimilarities(
  entries: readonly SearchableEntry[],
  question: string,
): { entry: SearchableEntry; similarity: number }[] {
  const ranked = rankBySimilarity(
    entries.map((entry) => ({
      entry,
      content: faqEmbeddingText(entry),
      embedding: null,
    })),
    { text: question },
    entries.length,
  );
  return ranked.map((row) => ({ entry: row.post.entry, similarity: row.similarity }));
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

  const candidates = entries.filter(
    (entry) => entry.active && matchesChannel(entry, channel),
  );
  if (candidates.length === 0) {
    // Aucune méthode n'a servi ; « lexical » est la valeur de repos, celle qui
    // ne promet aucun index sémantique.
    return { answerable: false, matches: [], method: "lexical", reason: "no_entries" };
  }

  const queryVector = await embedQuestion(provider, question);
  const vectorised = queryVector
    ? candidates.filter((entry) => entry.embedding?.length === queryVector.length)
    : [];

  // Une seule méthode pour toute la recherche : mélanger deux échelles dans un
  // même classement donnerait un ordre qui ne veut rien dire.
  const method: FaqSearchMethod = vectorised.length > 0 ? "embedding" : "lexical";
  const scored =
    method === "embedding"
      ? vectorised.map((entry) => ({
          entry,
          similarity: cosineSimilarity(queryVector!, entry.embedding!),
        }))
      : lexicalSimilarities(candidates, question);

  const thresholds = THRESHOLDS[method];
  const matches: FaqMatch[] = scored
    .filter((row) => row.similarity >= thresholds.match)
    .map((row) => ({
      entry: row.entry,
      similarity: row.similarity,
      score: rank(row.similarity, row.entry),
    }));

  matches.sort((a, b) => b.score - a.score);
  const kept = matches.slice(0, maxSources);

  if (kept.length === 0) {
    return { answerable: false, matches: [], method, reason: "no_match" };
  }

  // Le seuil de réponse porte sur la **similarité brute** de la meilleure
  // entrée, pas sur son score pondéré : une entrée prioritaire ne doit pas
  // pouvoir franchir le seuil par sa seule priorité.
  const best = kept[0]!;
  if (best.similarity < thresholds.answerable) {
    return { answerable: false, matches: kept, method, reason: "below_threshold" };
  }

  return { answerable: true, matches: kept, best, method };
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
