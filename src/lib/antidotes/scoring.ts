/**
 * Le score d'un prospect, de 0 à 100.
 *
 * ── La formule ──────────────────────────────────────────────────────────────
 *
 *   + 40  si la société diffuse des publicités (`ads_active`)
 *   + 30  si sa taille tombe dans la tolérance de la campagne autour du
 *         client de référence (± 40 % par défaut)
 *   + 20  si un contact principal est joignable — `outreach_channel` autre
 *         que `none`, donc email valide **ou** piste LinkedIn : la piste
 *         LinkedIn est un canal légitime, juger sur `email_status` seul
 *         l'éliminerait du score
 *   + 10  si le secteur est exactement celui du client de référence
 *
 * Les quatre poids sont paramétrables et vivent dans
 * `campaigns.filters.scoring` ; ceux ci-dessus servent quand la campagne ne
 * les surcharge pas. Un prospect sans campagne — saisi à la main — est noté
 * avec les défauts. Le total est borné à 0-100, la contrainte de la colonne
 * l'exige aussi.
 *
 * Fonction pure, ni base ni colonne générée : la formule doit pouvoir changer
 * sans migration. Le score est recalculé et persisté à chaque écriture sur un
 * prospect ou ses contacts (`src/app/actions/antidotes.ts`).
 */

import type { CampaignFilters, ScoringWeights, SizeSignal } from "./types";

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  ads_active: 40,
  size_in_range: 30,
  reachable_contact: 20,
  same_sector: 10,
};

/** ± 40 % autour de la taille du client de référence. */
export const DEFAULT_SIZE_TOLERANCE = 0.4;

export type ScoringContext = {
  prospect: {
    ads_active: boolean;
    sector: string | null;
    size_signal: SizeSignal;
  };
  contacts: { is_primary: boolean; outreach_channel: string }[];
  /**
   * La campagne, quand il y en a une : ses poids, sa tolérance de taille, et
   * la taille du client de référence dans le même signal que le prospect.
   */
  campaign?: {
    filters?: CampaignFilters | null;
    reference_sector?: string | null;
    reference_size?: SizeSignal | null;
  } | null;
};

export type ScoreBreakdown = {
  ads_active: number;
  size_in_range: number;
  reachable_contact: number;
  same_sector: number;
  total: number;
};

/** Les poids effectifs : ceux de la campagne par-dessus les défauts. */
export function resolveScoringWeights(
  filters: CampaignFilters | null | undefined,
): ScoringWeights {
  const overrides = filters?.scoring ?? {};
  const weights = { ...DEFAULT_SCORING_WEIGHTS };
  for (const key of Object.keys(weights) as (keyof ScoringWeights)[]) {
    const value = overrides[key];
    if (typeof value === "number" && Number.isFinite(value)) weights[key] = value;
  }
  return weights;
}

/**
 * La taille du prospect est-elle dans la tolérance autour de la référence ?
 *
 * Les deux tailles se comparent sur le **premier signal commun**, dans l'ordre
 * où ils se lisent le mieux : avis Google pour un lieu, effectif, trafic,
 * chiffre d'affaires. Sans signal commun, on ne sait pas — et « on ne sait
 * pas » ne rapporte pas de points, il n'en retire pas non plus.
 */
export function isSizeInRange(
  prospect: SizeSignal,
  reference: SizeSignal | null | undefined,
  tolerance: number,
): boolean {
  if (!reference) return false;
  const keys: (keyof SizeSignal)[] = ["reviews_count", "employees", "traffic", "revenue"];
  for (const key of keys) {
    const mine = prospect[key];
    const theirs = reference[key];
    if (typeof mine !== "number" || typeof theirs !== "number") continue;
    if (theirs <= 0) return false;
    const ratio = mine / theirs;
    return ratio >= 1 - tolerance && ratio <= 1 + tolerance;
  }
  return false;
}

function normalizeSector(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

export function computeScoreBreakdown(context: ScoringContext): ScoreBreakdown {
  const filters = context.campaign?.filters ?? null;
  const weights = resolveScoringWeights(filters);
  const tolerance =
    typeof filters?.size_tolerance === "number" && filters.size_tolerance >= 0
      ? filters.size_tolerance
      : DEFAULT_SIZE_TOLERANCE;

  const primary = context.contacts.find((contact) => contact.is_primary);
  const reachable = primary !== undefined && primary.outreach_channel !== "none";

  const referenceSector = normalizeSector(context.campaign?.reference_sector);
  const sameSector =
    referenceSector.length > 0 &&
    normalizeSector(context.prospect.sector) === referenceSector;

  const breakdown = {
    ads_active: context.prospect.ads_active ? weights.ads_active : 0,
    size_in_range: isSizeInRange(
      context.prospect.size_signal,
      context.campaign?.reference_size,
      tolerance,
    )
      ? weights.size_in_range
      : 0,
    reachable_contact: reachable ? weights.reachable_contact : 0,
    same_sector: sameSector ? weights.same_sector : 0,
  };

  const total =
    breakdown.ads_active +
    breakdown.size_in_range +
    breakdown.reachable_contact +
    breakdown.same_sector;

  return { ...breakdown, total: Math.max(0, Math.min(100, Math.round(total))) };
}

/** Le score seul, borné à 0-100. */
export function computeScore(context: ScoringContext): number {
  return computeScoreBreakdown(context).total;
}
