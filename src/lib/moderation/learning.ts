import { cosineSimilarity } from "./embeddings";
import { penalizeConfidence, rewardConfidence } from "./auto-send";
import type { FaqEntry, ModerationChannel, SupportedLocale } from "./types";

/**
 * Boucle d'apprentissage de la FAQ.
 *
 * Règle du produit : **aucun refus ne peut se produire sans opportunité
 * d'enrichir la FAQ.** Un opérateur qui clique sur la croix corrige une réponse
 * *et* améliore la base, dans le même geste. Si le second est optionnel, il
 * n'arrive jamais, et l'outil ne s'améliore pas.
 *
 * Ce module contient la logique pure : quoi créer, quoi enrichir, quel diff,
 * quelle version. Les écritures en base sont faites par les actions serveur.
 */

/** Au-dessus de ce seuil, on propose d'enrichir plutôt que de créer un doublon. */
export const DUPLICATE_THRESHOLD = 0.78;

export type CorrectionInput = {
  /** Reformulation de la demande, préremplie puis éditable par l'opérateur. */
  questionCanonical: string;
  /** L'élément de langage : la formulation de référence. */
  answer: string;
  locale: SupportedLocale;
  categoryId: string | null;
  channels: ModerationChannel[];
  /** Cochée par défaut. Décochée = la réponse part sans toucher à la FAQ. */
  updateFaq: boolean;
  /** Renseigné quand l'opérateur choisit d'enrichir une entrée existante. */
  enrichEntryId: string | null;
};

export type DuplicateSuggestion = {
  entryId: string;
  question: string;
  similarity: number;
};

/**
 * Cherche une entrée assez proche pour qu'enrichir vaille mieux que créer.
 *
 * Une FAQ qui accumule quatre entrées disant la même chose devient pire qu'une
 * FAQ courte : la recherche sémantique se disperse et l'opérateur ne sait plus
 * laquelle corriger.
 */
export function suggestDuplicate(options: {
  questionEmbedding: number[];
  entries: readonly { id: string; question_canonical: string; embedding: number[] | null }[];
  threshold?: number;
}): DuplicateSuggestion | null {
  const threshold = options.threshold ?? DUPLICATE_THRESHOLD;

  let best: DuplicateSuggestion | null = null;
  for (const entry of options.entries) {
    if (!entry.embedding) continue;
    const similarity = cosineSimilarity(options.questionEmbedding, entry.embedding);
    if (similarity < threshold) continue;
    if (!best || similarity > best.similarity) {
      best = { entryId: entry.id, question: entry.question_canonical, similarity };
    }
  }
  return best;
}

/** Champs modifiables lors d'un enrichissement. */
export type EnrichPatch = Partial<
  Pick<FaqEntry, "variants" | "answer_fr" | "answer_en" | "category_id" | "channels">
>;

export type LearningPlan =
  | { action: "none"; reason: "faq_update_declined" }
  | {
      action: "create";
      entry: {
        question_canonical: string;
        variants: string[];
        answer_fr: string | null;
        answer_en: string | null;
        category_id: string | null;
        channels: ModerationChannel[];
      };
      /** Texte à vectoriser pour la nouvelle entrée. */
      embeddingText: string;
    }
  | {
      action: "enrich";
      entryId: string;
      patch: EnrichPatch;
      /** Recalcul nécessaire uniquement si les variantes ou la question changent. */
      reembed: boolean;
      embeddingText: string | null;
    };

/**
 * Décide quoi faire d'une correction.
 *
 * Enrichir consiste à **ajouter la formulation réelle du client aux variantes**
 * et à corriger la réponse dans sa langue. C'est ce qui fait que la même
 * question posée autrement sera reconnue la fois suivante — l'apprentissage
 * réel du système tient dans cette ligne.
 */
export function planLearning(options: {
  correction: CorrectionInput;
  /** Question telle que le client l'a posée, ajoutée aux variantes. */
  originalQuestion: string;
  existingEntry: Pick<
    FaqEntry,
    "id" | "question_canonical" | "variants" | "answer_fr" | "answer_en"
  > | null;
}): LearningPlan {
  const { correction, originalQuestion, existingEntry } = options;

  if (!correction.updateFaq) return { action: "none", reason: "faq_update_declined" };

  const answerFr = correction.locale === "fr" ? correction.answer : null;
  const answerEn = correction.locale === "en" ? correction.answer : null;

  if (!correction.enrichEntryId || !existingEntry) {
    const variants = dedupe([originalQuestion]).filter(
      (variant) => variant.toLowerCase() !== correction.questionCanonical.toLowerCase(),
    );
    return {
      action: "create",
      entry: {
        question_canonical: correction.questionCanonical,
        variants,
        answer_fr: answerFr,
        answer_en: answerEn,
        category_id: correction.categoryId,
        channels: correction.channels,
      },
      embeddingText: [correction.questionCanonical, ...variants].join("\n"),
    };
  }

  // Enrichissement : la formulation du client rejoint les variantes.
  const variants = dedupe([
    ...existingEntry.variants,
    originalQuestion,
    // La question canonique proposée devient une variante si elle diffère de
    // celle déjà enregistrée — on ne réécrit pas la canonique d'une entrée
    // existante sans le dire.
    correction.questionCanonical,
  ]).filter(
    (variant) =>
      variant.toLowerCase() !== existingEntry.question_canonical.toLowerCase(),
  );

  const patch: EnrichPatch = { variants };

  if (answerFr !== null) patch.answer_fr = answerFr;
  if (answerEn !== null) patch.answer_en = answerEn;
  if (correction.categoryId) patch.category_id = correction.categoryId;
  if (correction.channels.length > 0) patch.channels = correction.channels;

  const variantsChanged =
    variants.length !== existingEntry.variants.length ||
    variants.some((variant, index) => variant !== existingEntry.variants[index]);

  return {
    action: "enrich",
    entryId: existingEntry.id,
    patch,
    reembed: variantsChanged,
    embeddingText: variantsChanged
      ? [existingEntry.question_canonical, ...variants].join("\n")
      : null,
  };
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }
  return output;
}

// --- Versionnage -----------------------------------------------------------

export type FaqSnapshot = Pick<
  FaqEntry,
  | "question_canonical"
  | "variants"
  | "answer_fr"
  | "answer_en"
  | "category_id"
  | "channels"
  | "priority"
  | "active"
>;

export type FieldDiff = {
  field: keyof FaqSnapshot;
  before: unknown;
  after: unknown;
};

/** Diff champ par champ, pour un affichage lisible dans l'historique. */
export function diffSnapshots(
  before: FaqSnapshot | null,
  after: FaqSnapshot,
): FieldDiff[] {
  const fields = Object.keys(after) as (keyof FaqSnapshot)[];
  const diffs: FieldDiff[] = [];

  for (const field of fields) {
    const previous = before ? before[field] : undefined;
    const next = after[field];
    if (JSON.stringify(previous) === JSON.stringify(next)) continue;
    diffs.push({ field, before: previous ?? null, after: next });
  }
  return diffs;
}

/**
 * Un rollback ne réécrit pas le passé : il crée une **nouvelle** version dont le
 * contenu est celui d'une version antérieure. L'historique reste un journal, pas
 * une brouillon effaçable — et on peut annuler un rollback.
 */
export function planRollback(options: {
  current: FaqSnapshot;
  target: FaqSnapshot;
  targetVersion: number;
  latestVersion: number;
}): {
  snapshot: FaqSnapshot;
  version: number;
  diff: FieldDiff[];
  reason: string;
} {
  return {
    snapshot: options.target,
    version: options.latestVersion + 1,
    diff: diffSnapshots(options.current, options.target),
    reason: `Restauration de la version ${options.targetVersion}`,
  };
}

// --- Statistiques par entrée ----------------------------------------------

export type EntryStatsUpdate = {
  usage_count: number;
  direct_validation_count: number;
  correction_count: number;
  confidence: number;
};

/**
 * Une validation directe : l'entrée a servi telle quelle. Sa confiance remonte.
 */
export function recordDirectValidation(entry: {
  usage_count: number;
  direct_validation_count: number;
  correction_count: number;
  confidence: number;
}): EntryStatsUpdate {
  return {
    usage_count: entry.usage_count + 1,
    direct_validation_count: entry.direct_validation_count + 1,
    correction_count: entry.correction_count,
    confidence: rewardConfidence(entry.confidence),
  };
}

/**
 * Une correction : l'entrée a produit une réponse refusée. Sa confiance baisse,
 * ce qui la sort du champ de l'auto-envoi et la fait remonter dans « à
 * retravailler ».
 */
export function recordCorrection(entry: {
  usage_count: number;
  direct_validation_count: number;
  correction_count: number;
  confidence: number;
}): EntryStatsUpdate {
  return {
    usage_count: entry.usage_count + 1,
    direct_validation_count: entry.direct_validation_count,
    correction_count: entry.correction_count + 1,
    confidence: penalizeConfidence(entry.confidence),
  };
}

/** Taux de validation directe, pour l'écran FAQ. */
export function directValidationRate(entry: {
  usage_count: number;
  direct_validation_count: number;
}): number | null {
  if (entry.usage_count === 0) return null;
  return entry.direct_validation_count / entry.usage_count;
}
