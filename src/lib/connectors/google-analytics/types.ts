/**
 * Modèle des échanges avec l'API Google Analytics Data (GA4), telle que la
 * passerelle Composio la rend : le corps de `runReport`, à l'identique de
 * l'API officielle — Composio transmet les arguments sans les transformer.
 *
 * Alias de type et non `interface`, comme partout : postgrest-js n'est pas en
 * jeu ici, mais la règle de la maison est une seule forme.
 */

export type GaDateRange = {
  /** `AAAA-MM-JJ`, bornes incluses — le format natif de l'API GA. */
  startDate: string;
  endDate: string;
};

export type GaRunReportRequest = {
  /** `properties/428494328` — l'identifiant complet, jamais le seul nombre. */
  property: string;
  dateRanges: GaDateRange[];
  dimensions?: { name: string }[];
  metrics: { name: string }[];
  /** GA plafonne à 250 000 ; sans lui, 10 000 — et le surplus se perd. */
  limit?: number;
  orderBys?: {
    dimension?: { dimensionName: string };
    metric?: { metricName: string };
    desc?: boolean;
  }[];
};

export type GaReportRow = {
  dimensionValues?: { value: string }[];
  /** Toujours des chaînes, même pour un entier — à convertir avant tout calcul. */
  metricValues?: { value: string }[];
};

export type GaRunReportResponse = {
  rows?: GaReportRow[];
  rowCount?: number;
};

/**
 * Le transport, injectable : la production passe par Composio, les tests et la
 * reprise d'historique par ce qu'on leur donne. C'est ce qui permet de tester
 * l'orchestration sans passerelle, et de rejouer l'histoire sans elle.
 */
export type GaTransport = (request: GaRunReportRequest) => Promise<GaRunReportResponse>;
