import type { MetricsTableRow } from "@/components/viz/metrics-table";
import { sumRawMetrics } from "@/lib/metrics/aggregate";
import type { RawMetrics } from "@/lib/metrics/types";

/**
 * Données de démonstration de l'espace Bondet — juin 2026.
 *
 * Ce ne sont pas des valeurs inventées : les trois premiers ad sets sont ceux
 * du rapport Looker Studio réel, au centime. Les trois suivants absorbent le
 * reste pour que **le total tombe exactement** sur celui du rapport :
 * 2 572,22 € de dépense, 557 255 impressions, 11 038 clics, 8 achats,
 * 837,90 € de valeur, 625 landing page views, 13 commentaires, 41 saves,
 * 96 partages.
 *
 * Les grandeurs non lisibles directement sur la capture sont déduites des
 * ratios affichés : `linkClicks` du CTR lien, `landingPageViews` du CPL.
 *
 * Remplacé par les données réelles de l'API à l'étape 6 ; la forme est déjà
 * celle que le connecteur produira.
 */
export interface DemoAdSet extends MetricsTableRow {
  raw: RawMetrics;
}

export const BONDET_AD_SETS: DemoAdSet[] = [
  {
    id: "broad",
    campaign: "SP META - 04/06 - Conversions",
    adSet: "BROAD",
    raw: {
      spend: 590.78,
      impressions: 151_951,
      clicks: 1506,
      linkClicks: 1261,
      purchases: 3,
      purchaseValue: 289.3,
      landingPageViews: 175,
      comments: 5,
      saves: 9,
      shares: 41,
    },
  },
  {
    id: "engageurs-ig",
    campaign: "SP META - 04/06 - Conversions",
    adSet: "Engageurs Instagram 365j",
    raw: {
      spend: 408.9,
      impressions: 131_226,
      clicks: 2298,
      linkClicks: 2283,
      purchases: 0,
      purchaseValue: 0,
      landingPageViews: 95,
      comments: 4,
      saves: 1,
      shares: 19,
    },
  },
  {
    id: "publication-ig",
    campaign: "SP IG - 30/05 - CA Notoriété",
    adSet: "Publication Instagram boostée",
    raw: {
      spend: 451.98,
      impressions: 95_608,
      clicks: 1764,
      linkClicks: 0,
      purchases: 0,
      purchaseValue: 0,
      landingPageViews: 4,
      comments: 2,
      saves: 8,
      shares: 19,
    },
  },
  {
    id: "lookalike-1",
    campaign: "SP META - 04/06 - Conversions",
    adSet: "Lookalike 1 % acheteurs",
    raw: {
      spend: 512.3,
      impressions: 78_200,
      clicks: 2400,
      linkClicks: 240,
      purchases: 3,
      purchaseValue: 340.1,
      landingPageViews: 160,
      comments: 1,
      saves: 12,
      shares: 8,
    },
  },
  {
    id: "retargeting-site",
    campaign: "SP META - 12/06 - Retargeting",
    adSet: "Visiteurs site 30j",
    raw: {
      spend: 366.26,
      impressions: 61_270,
      clicks: 1870,
      linkClicks: 180,
      purchases: 2,
      purchaseValue: 208.5,
      landingPageViews: 120,
      comments: 1,
      saves: 7,
      shares: 6,
    },
  },
  {
    id: "interets-mode",
    campaign: "SP IG - 30/05 - CA Notoriété",
    adSet: "Intérêts mode & lifestyle",
    raw: {
      spend: 242,
      impressions: 39_000,
      clicks: 1200,
      linkClicks: 104,
      purchases: 0,
      purchaseValue: 0,
      landingPageViews: 71,
      comments: 0,
      saves: 4,
      shares: 3,
    },
  },
];

export const BONDET_TOTAL: RawMetrics = sumRawMetrics(
  BONDET_AD_SETS.map((adSet) => adSet.raw),
);

/**
 * Période précédente (mai 2026), reconstituée depuis les variations affichées
 * sur la capture : +134,6 % d'impressions, +124,3 % de clics, +108,0 % de
 * dépense, −11,4 % de CPM.
 *
 * Les cartes qui affichent « N/A » sur le rapport actuel n'avaient aucune
 * donnée de comparaison : le suivi des conversions n'était pas encore en place.
 */
export const BONDET_PREVIOUS_TOTAL: RawMetrics = {
  spend: 1236.64,
  impressions: 237_533,
  clicks: 4921,
  linkClicks: 0,
  purchases: 0,
  purchaseValue: 0,
  landingPageViews: 0,
  comments: 6,
  saves: 17,
  shares: 38,
};

export interface DemoBreakdown {
  label: string;
  share: number;
  value: number;
  /** Hors de l'échelle ordonnée : « Inconnu » n'est pas une tranche d'âge. */
  outOfScale?: boolean;
}

function withImpressions(
  entries: readonly { label: string; share: number }[],
): DemoBreakdown[] {
  return entries.map((entry) => ({
    ...entry,
    value: Math.round(entry.share * BONDET_TOTAL.impressions),
    outOfScale: entry.label === "Inconnu",
  }));
}

/** Tranches d'âge — catégories **ordonnées**, d'où la rampe ordinale. */
export const BONDET_AGE = withImpressions([
  { label: "18-24", share: 0.188 },
  { label: "25-34", share: 0.229 },
  { label: "35-44", share: 0.102 },
  { label: "45-54", share: 0.081 },
  { label: "55-64", share: 0.159 },
  { label: "65+", share: 0.207 },
  { label: "Inconnu", share: 0.034 },
]);

export const BONDET_GENDER = withImpressions([
  { label: "Femmes", share: 0.54 },
  { label: "Hommes", share: 0.444 },
  { label: "Inconnu", share: 0.016 },
]);

export const BONDET_REGIONS = withImpressions([
  { label: "Île-de-France", share: 0.309 },
  { label: "Auvergne-Rhône-Alpes", share: 0.151 },
  { label: "Provence-Alpes-Côte d'Azur", share: 0.138 },
  { label: "Nouvelle-Aquitaine", share: 0.094 },
  { label: "Pays de la Loire", share: 0.081 },
  { label: "Occitanie", share: 0.068 },
  { label: "Grand Est", share: 0.057 },
  { label: "Bretagne", share: 0.049 },
  { label: "Hauts-de-France", share: 0.03 },
  { label: "Normandie", share: 0.023 },
]);

/**
 * Abonnés Instagram. Trois points seulement, et c'est la réalité de la
 * contrainte : Meta n'expose l'historique des abonnés que sur ~30 jours
 * glissants. L'antériorité viendra de l'import CSV prévu à l'étape 7.
 */
export const BONDET_FOLLOWERS = [
  { label: "avr. 2026", value: 1529 },
  { label: "mai 2026", value: 2500 },
  { label: "juin 2026", value: 2777 },
];

export const BONDET_PERIOD = {
  label: "1 juin 2026 – 30 juin 2026",
  comparison: "mai 2026",
};
