import type { GaReportRow, GaRunReportResponse } from "./types";

/**
 * Traduction des rapports GA4 vers les colonnes des tables `web_*`.
 *
 * Fonctions pures : la sortie de l'API entre, des lignes prêtes à l'upsert
 * sortent. Les listes de métriques vivent **ici, à côté des mappers** qui en
 * dépendent par leur ordre — les séparer, c'est garantir qu'un jour l'une
 * bouge sans l'autre et que « sessions » atterrisse dans « vues ».
 *
 * Deux pièges de l'API, vérifiés sur la vraie propriété :
 *
 *   • toutes les valeurs de métriques sont des **chaînes**, même les entiers ;
 *   • la durée moyenne de session n'existe qu'en moyenne (`TYPE_SECONDS`).
 *     On la remultiplie par les sessions à la collecte pour stocker une durée
 *     **cumulée**, seule forme additive : sommer des moyennes donnerait à un
 *     jour creux le même poids qu'à un jour plein.
 */

/** Ce que la table quotidienne demande, dans l'ordre du rapport. */
export const DAILY_METRICS = [
  "totalUsers",
  "sessions",
  "engagedSessions",
  "screenPageViews",
  "averageSessionDuration",
] as const;

/**
 * Les totaux mensuels exacts — uniques dédoublonnés, mais aussi sessions et
 * compagnie : GA recoupe à minuit une session à cheval sur deux jours, et la
 * somme des quotidiens dépasse d'un demi-pourcent le chiffre du mois. Sur un
 * mois civil, l'écran affiche ces totaux-là.
 */
export const MONTHLY_METRICS = [
  "totalUsers",
  "newUsers",
  "sessions",
  "engagedSessions",
  "screenPageViews",
  "averageSessionDuration",
] as const;

/** Chaque ventilation rapporte visiteurs et sessions, mois par mois. */
export const BREAKDOWN_METRICS = ["totalUsers", "sessions"] as const;

/** La dimension GA de chaque type de ventilation stocké. */
export const BREAKDOWN_DIMENSIONS = {
  source: "sessionSource",
  device: "deviceCategory",
  city: "city",
  retention: "newVsReturning",
} as const;

export type WebBreakdownKind = keyof typeof BREAKDOWN_DIMENSIONS;

/** Le tableau des pages, dans l'ordre du rapport. */
export const PAGE_METRICS = [
  "screenPageViews",
  "sessions",
  "engagedSessions",
  "averageSessionDuration",
] as const;

export type WebDailyColumns = {
  date: string;
  total_users: number;
  sessions: number;
  engaged_sessions: number;
  page_views: number;
  session_seconds: number;
};

export type WebMonthlyColumns = {
  month: string;
  total_users: number;
  new_users: number;
  sessions: number;
  engaged_sessions: number;
  page_views: number;
  session_seconds: number;
};

export type WebBreakdownColumns = {
  month: string;
  type: WebBreakdownKind;
  value: string;
  users: number;
  sessions: number;
};

export type WebPageColumns = {
  month: string;
  path: string;
  views: number;
  sessions: number;
  engaged_sessions: number;
  session_seconds: number;
};

/** `"20260718"` → `"2026-07-18"`. `null` si la forme n'est pas celle attendue. */
export function gaDay(value: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

/** `"202607"` → `"2026-07-01"` — le 1ᵉʳ du mois, convention de la maison. */
export function gaMonth(value: string): string | null {
  const match = /^(\d{4})(\d{2})$/.exec(value);
  return match ? `${match[1]}-${match[2]}-01` : null;
}

/** Une valeur de métrique GA — chaîne, parfois vide — vers un nombre sûr. */
function metricNumber(row: GaReportRow, index: number): number {
  const parsed = Number(row.metricValues?.[index]?.value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function dimension(row: GaReportRow, index: number): string {
  return row.dimensionValues?.[index]?.value ?? "";
}

/** Rapport `date × DAILY_METRICS` → lignes de `web_metrics_daily`. */
export function dailyRows(response: GaRunReportResponse): WebDailyColumns[] {
  const rows: WebDailyColumns[] = [];
  for (const row of response.rows ?? []) {
    const date = gaDay(dimension(row, 0));
    if (!date) continue;

    const sessions = metricNumber(row, 1);
    rows.push({
      date,
      total_users: metricNumber(row, 0),
      sessions,
      engaged_sessions: metricNumber(row, 2),
      page_views: metricNumber(row, 3),
      // Deux décimales suffisent : la colonne est en `numeric(14,2)`, et une
      // durée de session ne se lit jamais au centième de seconde.
      session_seconds: Math.round(metricNumber(row, 4) * sessions * 100) / 100,
    });
  }
  return rows;
}

/** Rapport `yearMonth × MONTHLY_METRICS` → lignes de `web_metrics_monthly`. */
export function monthlyRows(response: GaRunReportResponse): WebMonthlyColumns[] {
  const rows: WebMonthlyColumns[] = [];
  for (const row of response.rows ?? []) {
    const month = gaMonth(dimension(row, 0));
    if (!month) continue;

    const sessions = metricNumber(row, 2);
    rows.push({
      month,
      total_users: metricNumber(row, 0),
      new_users: metricNumber(row, 1),
      sessions,
      engaged_sessions: metricNumber(row, 3),
      page_views: metricNumber(row, 4),
      session_seconds: Math.round(metricNumber(row, 5) * sessions * 100) / 100,
    });
  }
  return rows;
}

/**
 * Rapport `yearMonth × dimension × BREAKDOWN_METRICS` → lignes de
 * `web_breakdowns_monthly`. La valeur reste telle que GA la rend, `(not set)`
 * compris : c'est une mesure, pas un libellé — l'écran décide comment la dire.
 */
export function breakdownRows(
  response: GaRunReportResponse,
  type: WebBreakdownKind,
): WebBreakdownColumns[] {
  const rows: WebBreakdownColumns[] = [];
  for (const row of response.rows ?? []) {
    const month = gaMonth(dimension(row, 0));
    const value = dimension(row, 1);
    if (!month || value === "") continue;

    rows.push({
      month,
      type,
      value,
      users: metricNumber(row, 0),
      sessions: metricNumber(row, 1),
    });
  }
  return rows;
}

/** Rapport `yearMonth × pagePath × PAGE_METRICS` → lignes de `web_pages_monthly`. */
export function pageRows(response: GaRunReportResponse): WebPageColumns[] {
  const rows: WebPageColumns[] = [];
  for (const row of response.rows ?? []) {
    const month = gaMonth(dimension(row, 0));
    const path = dimension(row, 1);
    if (!month || path === "") continue;

    const sessions = metricNumber(row, 1);
    rows.push({
      month,
      path,
      views: metricNumber(row, 0),
      sessions,
      engaged_sessions: metricNumber(row, 2),
      session_seconds: Math.round(metricNumber(row, 3) * sessions * 100) / 100,
    });
  }
  return rows;
}

/**
 * Les mois civils couverts par une fenêtre de collecte, au 1ᵉʳ de chaque mois.
 * Sert à borner les rapports mensuels : GA dédoublonne par plage demandée,
 * donc chaque mois se demande **en mois entier** — même quand la fenêtre
 * commence au milieu.
 */
export function monthsCovering(since: string, until: string): string[] {
  const start = new Date(`${since.slice(0, 7)}-01T00:00:00Z`);
  const end = new Date(`${until.slice(0, 7)}-01T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const months: string[] = [];
  for (
    let cursor = start;
    cursor <= end;
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
  ) {
    months.push(cursor.toISOString().slice(0, 10));
  }
  return months;
}

/** Les deux bornes d'un mois posé au 1ᵉʳ (`2026-07-01`), incluses. */
export function monthWindow(month: string): { from: string; to: string } {
  const start = new Date(`${month}T00:00:00Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  return { from: month, to: end.toISOString().slice(0, 10) };
}

/** Le tout premier rattrapage, quand la source ne dit rien : tout GA4 utile. */
const DEFAULT_BACKFILL_FROM = "2023-01-01";

/** Régime de croisière : la fenêtre glissante refaite à chaque passage. */
const ROLLING_DAYS = 8;

/**
 * La fenêtre d'un passage — bornée à aujourd'hui, jamais au-delà.
 *
 * Huit jours glissants en croisière : GA réécrit ses chiffres pendant environ
 * 72 h, huit jours absorbent large. L'histoire entière au premier passage, et
 * la demande de l'écran **étend** la fenêtre, jamais ne la raccourcit — c'est
 * ce qui permet à une plage ancienne du sélecteur de déclencher le rattrapage
 * qui la couvrira.
 */
export function webSyncWindow(input: {
  lastSyncAt: string | null;
  backfillFrom: string | null;
  now: Date;
  atLeastSince?: string;
}): { since: string; until: string } {
  const until = input.now.toISOString().slice(0, 10);

  const rolling = new Date(input.now.getTime() - ROLLING_DAYS * 86_400_000);
  let since = input.lastSyncAt
    ? rolling.toISOString().slice(0, 10)
    : (input.backfillFrom ?? DEFAULT_BACKFILL_FROM);

  if (input.atLeastSince && input.atLeastSince < since) since = input.atLeastSince;
  if (since > until) since = until;

  return { since, until };
}
