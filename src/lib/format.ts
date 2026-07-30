import { METRIC_DEFINITIONS } from "@/lib/metrics/definitions";
import type { MetricFormat, MetricId } from "@/lib/metrics/types";

const LOCALE = "fr-FR";

/** Affiché quand une métrique n'est pas définie (dénominateur nul). */
export const NOT_AVAILABLE = "—";

const formatters: Record<MetricFormat, Intl.NumberFormat> = {
  integer: new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }),
  decimal: new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  currency: new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  // `Intl` en fr-FR insère déjà l'espace insécable avant le %.
  percent: new Intl.NumberFormat(LOCALE, {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  ratio: new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
};

export function formatValue(value: number | null, format: MetricFormat): string {
  if (value === null || !Number.isFinite(value)) return NOT_AVAILABLE;
  return formatters[format].format(value);
}

export function formatMetric(id: MetricId, value: number | null): string {
  return formatValue(value, METRIC_DEFINITIONS[id].format);
}

/** Variation relative signée : `0.1346` → « +134,6 % ». */
export function formatDelta(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return "N/A";
  const formatted = new Intl.NumberFormat(LOCALE, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(ratio);
  return formatted;
}

/**
 * Formate les grands nombres en version compacte pour les axes de graphiques
 * (`2777` → « 2,8 k »), afin de ne pas saturer les graduations.
 */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat(LOCALE, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
