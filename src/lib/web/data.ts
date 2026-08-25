import type { BarDatum } from "@/components/viz/bar-list";
import { foldTail } from "@/lib/viz/palette";
import type {
  WebBreakdownMonthly,
  WebMetricsDaily,
  WebMetricsMonthly,
  WebPageMonthly,
} from "@/lib/supabase/database.types";
import type { DateRange } from "@/lib/reporting/period";

/**
 * Le pliage des lignes `web_*` vers ce que l'onglet Site Web affiche.
 *
 * Fonctions pures, comme `real-data.ts` : les requêtes lisent, ici on plie,
 * l'écran affiche. La règle des grandeurs vaut partout : seules les valeurs
 * additives se somment (sessions, vues, secondes), et les taux — rebond,
 * durée moyenne — se recalculent depuis les agrégats de la période, jamais
 * l'inverse.
 *
 * Les **visiteurs** sont le cas à part : GA les dédoublonne par période. Sur
 * un ou plusieurs mois civils entiers — la lecture normale du rapport — on
 * additionne les uniques mensuels exacts, ceux que le client lisait dans
 * Looker. Sur une plage libre, on retombe sur la somme des uniques
 * quotidiens : approximation haute assumée, la même que la portée Meta.
 */

export type WebTotals = {
  users: number;
  sessions: number;
  engagedSessions: number;
  pageViews: number;
  sessionSeconds: number;
};

export const EMPTY_WEB_TOTALS: Readonly<WebTotals> = Object.freeze({
  users: 0,
  sessions: 0,
  engagedSessions: 0,
  pageViews: 0,
  sessionSeconds: 0,
});

/** Somme des grandeurs additives d'un jeu de lignes quotidiennes. */
export function sumWebDaily(rows: readonly WebMetricsDaily[]): WebTotals {
  const total: WebTotals = { ...EMPTY_WEB_TOTALS };
  for (const row of rows) {
    total.users += row.total_users;
    total.sessions += row.sessions;
    total.engagedSessions += row.engaged_sessions;
    total.pageViews += row.page_views;
    total.sessionSeconds += Number(row.session_seconds);
  }
  return total;
}

/** Les 1ᵉʳˢ des mois civils que la plage couvre **exactement**, sinon `null`. */
export function fullMonthsOf(range: DateRange): string[] | null {
  const from = new Date(`${range.from}T00:00:00Z`);
  const to = new Date(`${range.to}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  if (from.getUTCDate() !== 1) return null;

  const lastDay = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() + 1, 0));
  if (to.getUTCDate() !== lastDay.getUTCDate()) return null;

  const months: string[] = [];
  for (
    let cursor = from;
    cursor <= to;
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
  ) {
    months.push(cursor.toISOString().slice(0, 10));
  }
  return months;
}

/**
 * Les totaux d'une plage : ceux du rapport GA quand elle est faite de mois
 * civils entiers **tous présents en base avec leurs totaux**, la somme des
 * quotidiens sinon. Même les sessions ne se somment pas parfaitement depuis
 * le jour — GA recoupe à minuit — et les visiteurs encore moins : sur le mois
 * que le client lit, le chiffre doit être celui qu'il lisait dans Looker.
 *
 * Un mois demandé mais absent, ou présent sans ses totaux (ligne d'avant
 * 0062), fait retomber sur l'approximation : mieux vaut un chiffre approché
 * qu'un exact tronqué d'un mois.
 */
export function totalsForRange(input: {
  range: DateRange;
  monthly: readonly WebMetricsMonthly[];
  daily: WebTotals;
}): { totals: WebTotals; exact: boolean; monthCount: number } {
  const months = fullMonthsOf(input.range);
  if (months) {
    const byMonth = new Map(input.monthly.map((row) => [row.month, row]));
    const rows = months.map((month) => byMonth.get(month));
    const usable = rows.every(
      (row) => row && (row.sessions > 0 || row.total_users === 0),
    );
    if (usable) {
      const totals: WebTotals = { ...EMPTY_WEB_TOTALS };
      for (const row of rows as WebMetricsMonthly[]) {
        totals.users += row.total_users;
        totals.sessions += row.sessions;
        totals.engagedSessions += row.engaged_sessions;
        totals.pageViews += row.page_views;
        totals.sessionSeconds += Number(row.session_seconds);
      }
      return { totals, exact: true, monthCount: months.length };
    }
  }
  return { totals: input.daily, exact: false, monthCount: 0 };
}

/** Durée moyenne d'une session, en secondes. `null` sans session mesurée. */
export function averageSessionSeconds(totals: WebTotals): number | null {
  if (totals.sessions <= 0) return null;
  return totals.sessionSeconds / totals.sessions;
}

/** Taux de rebond GA4 : 1 − engagées / sessions. `null` sans session. */
export function bounceRate(totals: WebTotals): number | null {
  if (totals.sessions <= 0) return null;
  return 1 - totals.engagedSessions / totals.sessions;
}

export type WebDeltaSentiment = "positive" | "negative" | "neutral";

export type WebDelta = {
  ratio: number | null;
  sentiment: WebDeltaSentiment;
};

/**
 * Variation vs l'an dernier, jugée selon le sens métier : un rebond qui
 * baisse est une bonne nouvelle. Même logique que `computeDelta`, sans le
 * détour par un `MetricId` — les mesures du site ne vivent pas dans le
 * catalogue publicitaire.
 */
export function webDelta(
  current: number | null,
  previous: number | null,
  direction: "up-good" | "down-good",
): WebDelta {
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

  const isImprovement = direction === "up-good" ? change > 0 : change < 0;
  return { ratio: change, sentiment: isImprovement ? "positive" : "negative" };
}

// --- Courbes des cartes -------------------------------------------------------

export type WebSparkPoint = {
  /** Libellé du jour courant (« 18/07 »). */
  label: string;
  value: number | null;
  /** Le même jour un an plus tôt, pour la seconde ligne. */
  previous: number | null;
};

type DailyValue = (row: WebMetricsDaily) => number | null;

/**
 * Aligne la période et son année N-1 jour par jour, par **rang** dans la
 * plage et non par date : le 3ᵉ jour de juillet 2026 se compare au 3ᵉ jour de
 * juillet 2025 — comparer au même quantième ferait glisser les jours de
 * semaine et onduler la seconde ligne d'un cran chaque année.
 */
export function alignedDailySeries(input: {
  range: DateRange;
  previousRange: DateRange;
  current: readonly WebMetricsDaily[];
  previous: readonly WebMetricsDaily[];
  value: DailyValue;
}): WebSparkPoint[] {
  const currentByDate = new Map(input.current.map((row) => [row.date, row]));
  const previousByDate = new Map(input.previous.map((row) => [row.date, row]));

  const points: WebSparkPoint[] = [];
  const start = new Date(`${input.range.from}T00:00:00Z`);
  const end = new Date(`${input.range.to}T00:00:00Z`);
  const previousStart = new Date(`${input.previousRange.from}T00:00:00Z`);

  for (
    let offset = 0;
    start.getTime() + offset * 86_400_000 <= end.getTime();
    offset += 1
  ) {
    const day = new Date(start.getTime() + offset * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const previousDay = new Date(previousStart.getTime() + offset * 86_400_000)
      .toISOString()
      .slice(0, 10);

    const row = currentByDate.get(day);
    const previousRow = previousByDate.get(previousDay);
    points.push({
      label: `${day.slice(8, 10)}/${day.slice(5, 7)}`,
      value: row ? input.value(row) : null,
      previous: previousRow ? input.value(previousRow) : null,
    });
  }
  return points;
}

// --- Ventilations -------------------------------------------------------------

/** Libellés français des valeurs GA qui en méritent un. Le reste passe tel quel. */
const BREAKDOWN_LABELS: Record<string, string> = {
  // Courts à dessein : la colonne s'intitule déjà « Visiteurs », et
  // « Nouveaux visiteurs » ne tenait pas dans un tiers de demi-panneau.
  new: "Nouveaux",
  returning: "Connus",
  "(not set)": "Indéterminé",
  "(direct)": "Accès direct",
  mobile: "Mobile",
  desktop: "Ordinateur",
  tablet: "Tablette",
  "smart tv": "TV connectée",
};

export function breakdownLabel(value: string): string {
  return BREAKDOWN_LABELS[value] ?? value;
}

/**
 * Une ventilation mensuelle pliée en liste de barres : sommée sur les mois de
 * la plage, repliée aux `cap` plus grandes parts, « Indéterminé » hors
 * échelle. La somme inter-mois d'uniques est une approximation assumée — la
 * lecture normale est un seul mois, où le chiffre est exact.
 */
export function foldBreakdown(
  rows: readonly WebBreakdownMonthly[],
  type: WebBreakdownMonthly["type"],
  options?: { cap?: number; measure?: "users" | "sessions" },
): BarDatum[] {
  const cap = options?.cap ?? 6;
  const measure = options?.measure ?? "users";

  const byValue = new Map<string, number>();
  for (const row of rows) {
    if (row.type !== type) continue;
    byValue.set(row.value, (byValue.get(row.value) ?? 0) + row[measure]);
  }

  const total = [...byValue.values()].reduce((sum, value) => sum + value, 0);
  if (total <= 0) return [];

  const folded = foldTail(
    [...byValue.entries()].map(([value, count]) => ({
      label: breakdownLabel(value),
      value: count,
    })),
    cap,
    "Autres",
  );

  return folded.map((item) => ({
    label: item.label,
    value: item.value,
    share: item.value / total,
    outOfScale: item.isOther || item.label === "Indéterminé",
  }));
}

// --- Sources par mois ---------------------------------------------------------

export type SourcesByMonth = {
  /** Ordre d'affichage et d'empilement — la teinte suit ce rang, fixe. */
  sources: string[];
  months: {
    month: string;
    /** « juil. 2026 » — l'étiquette d'axe. */
    label: string;
    /** Sessions par source, `Autres` déjà replié. */
    values: Record<string, number>;
  }[];
};

const MONTH_SHORT = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

export function monthShortLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const name = MONTH_SHORT[(monthNumber ?? 1) - 1];
  return name ? `${name} ${year}` : month;
}

/**
 * L'histogramme empilé des sources, mois par mois — la barre du rapport
 * Looker. Les sources gardées sont les plus grosses **sur toute la fenêtre**,
 * jamais mois par mois : une source qui changerait de teinte d'une barre à
 * l'autre serait illisible, et la palette ne cycle pas.
 */
export function sourcesByMonth(
  rows: readonly WebBreakdownMonthly[],
  options?: { cap?: number },
): SourcesByMonth {
  // Trois sources nommées plus « Autres » : la palette ne garantit la
  // séparation daltonisme toutes-paires que sur trois teintes
  // (`ALL_PAIRS_SERIES_CAP`), et les tokens s'arrêtent là.
  const cap = options?.cap ?? 3;

  const bySource = new Map<string, number>();
  const byMonth = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (row.type !== "source") continue;
    bySource.set(row.value, (bySource.get(row.value) ?? 0) + row.sessions);
    const month = byMonth.get(row.month) ?? new Map<string, number>();
    month.set(row.value, (month.get(row.value) ?? 0) + row.sessions);
    byMonth.set(row.month, month);
  }

  const kept = [...bySource.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, cap)
    .map(([value]) => value);
  const hasOthers = bySource.size > kept.length;

  const sources = [
    ...kept.map((value) => breakdownLabel(value)),
    ...(hasOthers ? ["Autres"] : []),
  ];

  const months = [...byMonth.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([month, values]) => {
      const record: Record<string, number> = {};
      for (const source of sources) record[source] = 0;
      for (const [value, sessions] of values) {
        const label = kept.includes(value) ? breakdownLabel(value) : "Autres";
        if (label in record) record[label] = (record[label] ?? 0) + sessions;
      }
      return { month, label: monthShortLabel(month), values: record };
    });

  return { sources, months };
}

// --- Pages --------------------------------------------------------------------

export type WebPageRow = {
  path: string;
  views: number;
  sessions: number;
  /** 1 − engagées / sessions ; `null` quand rien n'est mesurable. */
  bounceRate: number | null;
  /** Durée moyenne de session, en secondes ; `null` sans session. */
  averageSeconds: number | null;
};

/**
 * Le tableau Top Pages : les lignes mensuelles agrégées par chemin sur la
 * plage, taux recalculés depuis les agrégats — la moyenne des taux ligne à
 * ligne donnerait à une page confidentielle le poids de la page d'accueil.
 */
export function foldPages(rows: readonly WebPageMonthly[]): {
  pages: WebPageRow[];
  total: WebPageRow;
} {
  const byPath = new Map<
    string,
    { views: number; sessions: number; engaged: number; seconds: number }
  >();
  const sums = { views: 0, sessions: 0, engaged: 0, seconds: 0 };

  for (const row of rows) {
    const entry = byPath.get(row.path) ?? {
      views: 0,
      sessions: 0,
      engaged: 0,
      seconds: 0,
    };
    entry.views += row.views;
    entry.sessions += row.sessions;
    entry.engaged += row.engaged_sessions;
    entry.seconds += Number(row.session_seconds);
    byPath.set(row.path, entry);

    sums.views += row.views;
    sums.sessions += row.sessions;
    sums.engaged += row.engaged_sessions;
    sums.seconds += Number(row.session_seconds);
  }

  const toRow = (
    path: string,
    entry: { views: number; sessions: number; engaged: number; seconds: number },
  ): WebPageRow => ({
    path,
    views: entry.views,
    sessions: entry.sessions,
    bounceRate: entry.sessions > 0 ? 1 - entry.engaged / entry.sessions : null,
    averageSeconds: entry.sessions > 0 ? entry.seconds / entry.sessions : null,
  });

  return {
    pages: [...byPath.entries()]
      .map(([path, entry]) => toRow(path, entry))
      .sort((a, b) => b.views - a.views),
    total: toRow("Total", sums),
  };
}
