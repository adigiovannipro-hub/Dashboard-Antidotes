/**
 * Modèle canonique des métriques publicitaires.
 *
 * Ce sont les seules valeurs stockées en base et sommées lors des agrégations :
 * uniquement des grandeurs **additives**. Tout ce qui est un ratio (CPA, CPM,
 * ROAS, CTR, CPC, CPL) est recalculé à la volée depuis ces agrégats — voir
 * `aggregate.ts`. Stocker un ratio en base reviendrait tôt ou tard à en faire
 * une moyenne de moyennes, qui est fausse.
 */
export interface RawMetrics {
  /** Montant dépensé, dans la devise du compte. */
  spend: number;
  /** Impressions. Correspond à la colonne « View » du rapport Looker. */
  impressions: number;
  /** Tous les clics (`clicks`), y compris hors lien. */
  clicks: number;
  /** Clics sur lien uniquement (`inline_link_clicks`). */
  linkClicks: number;
  /** Actions `purchase`. */
  purchases: number;
  /** Valeur des conversions `purchase`. Colonne « Earn » du rapport. */
  purchaseValue: number;
  /** Actions `landing_page_view`. */
  landingPageViews: number;
  /** Actions `add_to_cart` — première marche de l'entonnoir. */
  addToCart: number;
  /** Actions `initiate_checkout` — deuxième marche. */
  initiatedCheckout: number;
  comments: number;
  saves: number;
  shares: number;
}

export const EMPTY_RAW_METRICS: Readonly<RawMetrics> = Object.freeze({
  spend: 0,
  impressions: 0,
  clicks: 0,
  linkClicks: 0,
  purchases: 0,
  purchaseValue: 0,
  landingPageViews: 0,
  addToCart: 0,
  initiatedCheckout: 0,
  comments: 0,
  saves: 0,
  shares: 0,
});

export const RAW_METRIC_KEYS = Object.keys(EMPTY_RAW_METRICS) as (keyof RawMetrics)[];

/**
 * Quel dénominateur de clics alimente le CTR.
 *
 * - `legacy` : clics **sur lien** au numérateur, ce que fait le rapport Looker
 *   Studio actuel — alors que la colonne « Clics » et le CPC, eux, utilisent
 *   tous les clics. C'est incohérent, mais c'est la définition historique et
 *   la conserver garantit qu'aucun chiffre ne bouge lors de la bascule.
 * - `consistent` : tous les clics partout. CTR × Impressions = Clics, et
 *   CPC × Clics = Spend. Les trois métriques se réconcilient enfin entre elles.
 */
export type ClickAttributionMode = "legacy" | "consistent";

export const DEFAULT_CLICK_MODE: ClickAttributionMode = "legacy";

/** Sens métier d'une variation : une hausse est-elle une bonne nouvelle ? */
export type MetricDirection = "up-good" | "down-good";

export type MetricFormat =
  | "integer"
  | "decimal"
  | "currency"
  | "percent"
  | "ratio";

export interface MetricDefinition {
  id: MetricId;
  /** Libellé affiché, repris à l'identique du rapport Looker Studio. */
  label: string;
  format: MetricFormat;
  direction: MetricDirection;
  /**
   * Calcule la valeur depuis des agrégats bruts.
   * Renvoie `null` quand la métrique n'est pas définie (dénominateur nul) —
   * jamais 0, qui se lirait à tort comme « acquisition gratuite ».
   */
  compute: (raw: RawMetrics, mode: ClickAttributionMode) => number | null;
}

export type MetricId =
  | "impressions"
  | "clicks"
  | "cpa"
  | "purchases"
  | "roas"
  | "cpm"
  | "ctr"
  | "spend"
  | "earn"
  | "landingPageViews"
  | "cpl"
  | "cpc"
  | "comments"
  | "saves"
  | "shares";
