/**
 * Qualifier une société avant de l'enrichir.
 *
 * C'est le filtre qui garde le coût sous contrôle : on ne cherche jamais le
 * décisionnaire d'une société qui n'a pas passé ce tamis. Quatre critères,
 * tous désactivables depuis la campagne — pays, note Google minimale, taille
 * dans la tolérance autour du client de référence, publicités actives.
 *
 * Trois issues et non deux : ce qu'on ne sait pas ne se rejette pas. Une
 * société dont les publicités n'ont pas pu être vérifiées — jeton Meta
 * absent, plafond d'appels — passe en « À qualifier », colonne du kanban où
 * l'œil tranche ; la rejeter en silence transformerait une panne en verdict.
 *
 * Module pur, testé.
 */

import { isSizeInRange } from "../scoring";
import type { SizeSignal } from "../types";
import type { ResolvedFilters } from "./config";

export type QualificationCandidate = {
  country: string | null;
  rating: number | null;
  size_signal: SizeSignal;
  /** `null` : pas vérifié — le fournisseur n'a pas répondu ou n'est pas branché. */
  ads_active: boolean | null;
};

export type QualificationOutcome = "qualified" | "to_review" | "rejected";

export type QualificationVerdict = {
  outcome: QualificationOutcome;
  /** Les raisons, dans le vocabulaire des compteurs du taux de survie. */
  reasons: string[];
  size_ratio: number | null;
};

/** Les raisons de rejet, telles que le taux de survie les compte. */
export const REJECTION_LABELS = {
  country: "pays hors cible",
  rating: "note trop basse",
  size: "taille hors tolérance",
  ads: "sans publicité active",
} as const;

export const REVIEW_LABELS = {
  ads_unknown: "publicités non vérifiées",
} as const;

/** Le ratio taille prospect / taille de référence, sur le premier signal commun. */
export function sizeRatio(prospect: SizeSignal, reference: SizeSignal | null): number | null {
  if (!reference) return null;
  const keys: (keyof SizeSignal)[] = ["reviews_count", "employees", "traffic", "revenue"];
  for (const key of keys) {
    const mine = prospect[key];
    const theirs = reference[key];
    if (typeof mine !== "number" || typeof theirs !== "number" || theirs <= 0) continue;
    return mine / theirs;
  }
  return null;
}

export function qualifyCandidate(
  candidate: QualificationCandidate,
  filters: ResolvedFilters,
): QualificationVerdict {
  const rejections: string[] = [];
  const reviews: string[] = [];

  if (
    filters.countries.length > 0 &&
    candidate.country !== null &&
    !filters.countries.includes(candidate.country.toUpperCase())
  ) {
    rejections.push(REJECTION_LABELS.country);
  }

  if (filters.min_rating > 0 && candidate.rating !== null && candidate.rating < filters.min_rating) {
    rejections.push(REJECTION_LABELS.rating);
  }

  const ratio = sizeRatio(candidate.size_signal, filters.reference_size);
  if (
    ratio !== null &&
    !isSizeInRange(candidate.size_signal, filters.reference_size, filters.size_tolerance)
  ) {
    rejections.push(REJECTION_LABELS.size);
  }

  if (filters.require_ads === true) {
    if (candidate.ads_active === false) rejections.push(REJECTION_LABELS.ads);
    else if (candidate.ads_active === null) reviews.push(REVIEW_LABELS.ads_unknown);
  }

  if (rejections.length > 0) {
    return { outcome: "rejected", reasons: rejections, size_ratio: ratio };
  }
  if (reviews.length > 0) {
    return { outcome: "to_review", reasons: reviews, size_ratio: ratio };
  }
  return { outcome: "qualified", reasons: [], size_ratio: ratio };
}
