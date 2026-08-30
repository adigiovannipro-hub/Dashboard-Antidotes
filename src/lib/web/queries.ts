import "server-only";

import { sameRangeLastYear, type DateRange } from "@/lib/reporting/period";
import { createClient } from "@/lib/supabase/server";
import type {
  WebBreakdownMonthly,
  WebMetricsDaily,
  WebMetricsMonthly,
  WebPageMonthly,
} from "@/lib/supabase/database.types";

/**
 * Lectures de l'onglet Site Web — tout vient de la base, remplie par le
 * connecteur Google Analytics. Comme partout : la RLS fait le cloisonnement,
 * l'erreur est ignorée et une liste vide est une réponse valable (l'écran la
 * dit).
 *
 * La comparaison est **l'année N-1**, pas la période précédente : le trafic
 * d'un site est saisonnier, et c'est ce que le rapport Looker de référence
 * faisait déjà. D'où deux fenêtres quotidiennes distinctes — la plage et son
 * double un an plus tôt — lues en une seule requête bornée large.
 */

export type WebData = {
  hasData: boolean;
  range: DateRange;
  previousRange: DateRange;
  daily: WebMetricsDaily[];
  previousDaily: WebMetricsDaily[];
  monthly: WebMetricsMonthly[];
  previousMonthly: WebMetricsMonthly[];
  /** Les ventilations des mois couverts par la plage. */
  breakdowns: WebBreakdownMonthly[];
  /** Les sources des douze derniers mois — l'histogramme, hors sélection. */
  sourcesYear: WebBreakdownMonthly[];
  pages: WebPageMonthly[];
};

/** Le 1ᵉʳ du mois d'une date ISO. */
function monthOf(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

/** Le 1ᵉʳ du mois, `back` mois avant celui d'une date ISO. */
function monthBack(day: string, back: number): string {
  const [year, month] = day.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1 - back, 1))
    .toISOString()
    .slice(0, 10);
}

export async function getWebData(options: {
  workspaceId: string;
  range: DateRange;
  reader?: Awaited<ReturnType<typeof createClient>>;
}): Promise<WebData> {
  const supabase = options.reader ?? (await createClient());
  const { range } = options;
  const previous = sameRangeLastYear(range);

  const [dailyQuery, monthlyQuery, breakdownsQuery, sourcesQuery, pagesQuery] =
    await Promise.all([
      // Une seule requête couvre la plage et son double N-1 : la borne basse
      // est celle d'il y a un an, et les lignes se répartissent en mémoire.
      supabase
        .from("web_metrics_daily")
        .select("*")
        .eq("workspace_id", options.workspaceId)
        .gte("date", previous.from)
        .lte("date", range.to)
        .order("date")
        .limit(10000),
      supabase
        .from("web_metrics_monthly")
        .select("*")
        .eq("workspace_id", options.workspaceId)
        .gte("month", monthOf(previous.from))
        .lte("month", monthOf(range.to))
        .limit(1000),
      supabase
        .from("web_breakdowns_monthly")
        .select("*")
        .eq("workspace_id", options.workspaceId)
        .gte("month", monthOf(range.from))
        .lte("month", monthOf(range.to))
        .limit(10000),
      /* L'histogramme des sources montre l'année écoulée quelle que soit la
         plage — c'est sa lecture : la tendance longue, pas le zoom. */
      supabase
        .from("web_breakdowns_monthly")
        .select("*")
        .eq("workspace_id", options.workspaceId)
        .eq("type", "source")
        .gte("month", monthBack(range.to, 11))
        .lte("month", monthOf(range.to))
        .limit(10000),
      supabase
        .from("web_pages_monthly")
        .select("*")
        .eq("workspace_id", options.workspaceId)
        .gte("month", monthOf(range.from))
        .lte("month", monthOf(range.to))
        .limit(10000),
    ]);

  const allDaily = (dailyQuery.data ?? []) as unknown as WebMetricsDaily[];
  const allMonthly = (monthlyQuery.data ?? []) as unknown as WebMetricsMonthly[];

  const daily = allDaily.filter(
    (row) => row.date >= range.from && row.date <= range.to,
  );
  const previousDaily = allDaily.filter(
    (row) => row.date >= previous.from && row.date <= previous.to,
  );

  return {
    hasData: daily.length > 0,
    range,
    previousRange: previous,
    daily,
    previousDaily,
    monthly: allMonthly.filter((row) => row.month >= monthOf(range.from)),
    previousMonthly: allMonthly.filter((row) => row.month <= monthOf(previous.to)),
    breakdowns: (breakdownsQuery.data ?? []) as unknown as WebBreakdownMonthly[],
    sourcesYear: (sourcesQuery.data ?? []) as unknown as WebBreakdownMonthly[],
    pages: (pagesQuery.data ?? []) as unknown as WebPageMonthly[],
  };
}
