/**
 * Le taux de survie d'un passage : sourcés → qualifiés → décideur trouvé →
 * email valide. Sans lui, on ne saurait jamais quelle étape est le vrai
 * goulot. Module pur : les compteurs sont stockés bruts dans le passage, les
 * taux se calculent ici, au rendu.
 */

import type { RunStats } from "../types";

export function emptyRunStats(): RunStats {
  return {
    sourced: 0,
    qualified: 0,
    to_review: 0,
    contact_found: 0,
    email_valid: 0,
    email_risky: 0,
    rejected: {},
  };
}

export function completeRunStats(stats: Partial<RunStats> | null | undefined): RunStats {
  const base = emptyRunStats();
  if (!stats) return base;
  return {
    sourced: stats.sourced ?? 0,
    qualified: stats.qualified ?? 0,
    to_review: stats.to_review ?? 0,
    contact_found: stats.contact_found ?? 0,
    email_valid: stats.email_valid ?? 0,
    email_risky: stats.email_risky ?? 0,
    rejected: { ...(stats.rejected ?? {}) },
  };
}

export type FunnelStepKey = "sourced" | "qualified" | "contact_found" | "email_valid";

export type FunnelStep = {
  key: FunnelStepKey;
  label: string;
  value: number;
  /** Ce qui reste de l'étape précédente, 0-1 ; `null` sur la première ou sans amont. */
  rate: number | null;
};

export const FUNNEL_LABELS: Record<FunnelStepKey, string> = {
  sourced: "Sourcés",
  qualified: "Qualifiés",
  contact_found: "Décideur trouvé",
  email_valid: "Email valide",
};

/**
 * Les quatre marches. « Qualifiés » compte aussi ce qui est parti en revue :
 * ces sociétés sont dans le pipeline, un humain tranchera — elles ne sont
 * pas perdues.
 */
export function buildFunnel(stats: Partial<RunStats> | null | undefined): FunnelStep[] {
  const full = completeRunStats(stats);
  const values: Record<FunnelStepKey, number> = {
    sourced: full.sourced,
    qualified: full.qualified + full.to_review,
    contact_found: full.contact_found,
    email_valid: full.email_valid,
  };
  const keys: FunnelStepKey[] = ["sourced", "qualified", "contact_found", "email_valid"];
  return keys.map((key, index) => {
    const previous = index === 0 ? null : values[keys[index - 1]!];
    return {
      key,
      label: FUNNEL_LABELS[key],
      value: values[key],
      rate: previous === null || previous === 0 ? null : values[key] / previous,
    };
  });
}

/** Le total rejeté, toutes raisons confondues. */
export function rejectedTotal(stats: Partial<RunStats> | null | undefined): number {
  return Object.values(stats?.rejected ?? {}).reduce((sum, count) => sum + count, 0);
}

/** Les raisons de rejet, de la plus fréquente à la plus rare. */
export function rejectionBreakdown(
  stats: Partial<RunStats> | null | undefined,
): { reason: string; count: number }[] {
  return Object.entries(stats?.rejected ?? {})
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}
