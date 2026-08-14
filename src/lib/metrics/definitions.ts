import type {
  ClickAttributionMode,
  MetricDefinition,
  MetricId,
  RawMetrics,
} from "./types";

/** Division protégée : dénominateur nul ou négatif ⇒ métrique non définie. */
function ratio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator <= 0) return null;
  return numerator / denominator;
}

/**
 * Dictionnaire des métriques, décodé depuis le rapport Looker Studio existant
 * et vérifié sur les totaux de juin 2026 (voir `definitions.test.ts`).
 */
export const METRIC_DEFINITIONS: Record<MetricId, MetricDefinition> = {
  impressions: {
    id: "impressions",
    label: "Impressions",
    format: "integer",
    direction: "up-good",
    compute: (r) => r.impressions,
  },
  clicks: {
    id: "clicks",
    label: "Clics",
    format: "integer",
    direction: "up-good",
    compute: (r) => r.clicks,
  },
  cpa: {
    id: "cpa",
    label: "CPA",
    format: "currency",
    direction: "down-good",
    compute: (r) => ratio(r.spend, r.purchases),
  },
  purchases: {
    id: "purchases",
    label: "Achats",
    format: "integer",
    direction: "up-good",
    compute: (r) => r.purchases,
  },
  roas: {
    id: "roas",
    label: "ROAS",
    format: "ratio",
    direction: "up-good",
    compute: (r) => ratio(r.purchaseValue, r.spend),
  },
  cpm: {
    id: "cpm",
    label: "CPM",
    format: "currency",
    direction: "down-good",
    compute: (r) => {
      const perImpression = ratio(r.spend, r.impressions);
      return perImpression === null ? null : perImpression * 1000;
    },
  },
  ctr: {
    id: "ctr",
    label: "CTR",
    format: "percent",
    direction: "up-good",
    // Seule métrique sensible au mode d'attribution des clics — voir types.ts.
    compute: (r, mode) =>
      ratio(mode === "legacy" ? r.linkClicks : r.clicks, r.impressions),
  },
  spend: {
    id: "spend",
    label: "Budget dépensé",
    format: "currency",
    // Dépenser plus n'est ni bon ni mauvais en soi, mais sur une plateforme de
    // reporting client la hausse du budget se lit comme une progression.
    direction: "up-good",
    compute: (r) => r.spend,
  },
  earn: {
    id: "earn",
    label: "Chiffre d'affaires",
    format: "currency",
    direction: "up-good",
    compute: (r) => r.purchaseValue,
  },
  landingPageViews: {
    id: "landingPageViews",
    label: "Vues de page",
    format: "integer",
    direction: "up-good",
    compute: (r) => r.landingPageViews,
  },
  cpl: {
    id: "cpl",
    label: "CPL",
    format: "currency",
    direction: "down-good",
    // Malgré son nom, le CPL du rapport est un coût par *landing page view*,
    // pas un coût par lead : 2 572,22 / 625 = 4,12 sur juin 2026.
    compute: (r) => ratio(r.spend, r.landingPageViews),
  },
  frequency: {
    id: "frequency",
    label: "Répétition",
    format: "decimal",
    // Trop de répétition lasse : au-delà de 3-4, la même personne revoit la
    // même publicité et le CPM grimpe. Une hausse n'est pas une bonne
    // nouvelle.
    direction: "down-good",
    compute: (raw) => (raw.reach === 0 ? null : raw.impressions / raw.reach),
  },
  cpc: {
    id: "cpc",
    label: "CPC",
    format: "currency",
    direction: "down-good",
    compute: (r) => ratio(r.spend, r.clicks),
  },
  comments: {
    id: "comments",
    label: "Commentaires",
    format: "integer",
    direction: "up-good",
    compute: (r) => r.comments,
  },
  saves: {
    id: "saves",
    label: "Enregistrements",
    format: "integer",
    direction: "up-good",
    compute: (r) => r.saves,
  },
  shares: {
    id: "shares",
    label: "Partages",
    format: "integer",
    direction: "up-good",
    compute: (r) => r.shares,
  },
};

/** Ordre des cartes KPI, repris de la capture du rapport actuel. */
export const DEFAULT_KPI_ORDER: MetricId[] = [
  "impressions",
  "clicks",
  "cpa",
  "purchases",
  "roas",
  "cpm",
  "ctr",
  "spend",
  "earn",
  "landingPageViews",
];

/** Colonnes du tableau « Top Posts », dans l'ordre du rapport actuel. */
export const TOP_POSTS_COLUMNS: MetricId[] = [
  "spend",
  "impressions",
  "purchases",
  "earn",
  "cpa",
  "cpm",
  "cpl",
  "clicks",
  "ctr",
  "cpc",
  "comments",
  "saves",
  "shares",
];

export function computeMetric(
  id: MetricId,
  raw: RawMetrics,
  mode: ClickAttributionMode,
): number | null {
  return METRIC_DEFINITIONS[id].compute(raw, mode);
}
