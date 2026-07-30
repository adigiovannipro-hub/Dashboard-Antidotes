import { METRIC_DEFINITIONS, computeMetric } from "./definitions";
import {
  EMPTY_RAW_METRICS,
  RAW_METRIC_KEYS,
  type ClickAttributionMode,
  type MetricId,
  type RawMetrics,
} from "./types";

/**
 * Somme des grandeurs brutes. C'est la seule agrégation autorisée : les ratios
 * se déduisent ensuite de la somme, jamais l'inverse.
 */
export function sumRawMetrics(rows: readonly Partial<RawMetrics>[]): RawMetrics {
  const total: RawMetrics = { ...EMPTY_RAW_METRICS };
  for (const row of rows) {
    for (const key of RAW_METRIC_KEYS) {
      total[key] += row[key] ?? 0;
    }
  }
  return total;
}

/** Regroupe des lignes par clé (campagne, ad set, date…) puis somme chaque groupe. */
export function groupAndSum<T extends Partial<RawMetrics>>(
  rows: readonly T[],
  keyOf: (row: T) => string,
): Map<string, RawMetrics> {
  const groups = new Map<string, RawMetrics>();
  for (const row of rows) {
    const key = keyOf(row);
    const current = groups.get(key) ?? { ...EMPTY_RAW_METRICS };
    for (const metric of RAW_METRIC_KEYS) {
      current[metric] += row[metric] ?? 0;
    }
    groups.set(key, current);
  }
  return groups;
}

export type MetricValues = Partial<Record<MetricId, number | null>>;

/** Calcule un jeu de métriques dérivées depuis un agrégat brut. */
export function computeMetrics(
  raw: RawMetrics,
  ids: readonly MetricId[],
  mode: ClickAttributionMode,
): MetricValues {
  const values: MetricValues = {};
  for (const id of ids) {
    values[id] = computeMetric(id, raw, mode);
  }
  return values;
}

export type DeltaSentiment = "positive" | "negative" | "neutral";

export interface MetricDelta {
  /** Variation relative (0,12 = +12 %). `null` si non calculable. */
  ratio: number | null;
  /** Lecture métier de la variation, en tenant compte du sens de la métrique. */
  sentiment: DeltaSentiment;
}

/**
 * Variation entre deux périodes, interprétée selon le sens métier de la
 * métrique : un CPA qui baisse est une bonne nouvelle, une dépense qui baisse
 * n'en est pas une. La couleur affichée suit le `sentiment`, pas le signe.
 */
export function computeDelta(
  id: MetricId,
  current: number | null,
  previous: number | null,
): MetricDelta {
  if (
    current === null ||
    previous === null ||
    !Number.isFinite(current) ||
    !Number.isFinite(previous) ||
    previous === 0
  ) {
    return { ratio: null, sentiment: "neutral" };
  }

  const change = (current - previous) / Math.abs(previous);
  if (change === 0) return { ratio: 0, sentiment: "neutral" };

  const isImprovement =
    METRIC_DEFINITIONS[id].direction === "up-good" ? change > 0 : change < 0;
  return { ratio: change, sentiment: isImprovement ? "positive" : "negative" };
}
