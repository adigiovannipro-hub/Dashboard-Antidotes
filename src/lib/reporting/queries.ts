import "server-only";

import type { MetricsTableRow } from "@/components/viz/metrics-table";
import type { BarDatum } from "@/components/viz/bar-list";
import type { RawMetrics } from "@/lib/metrics/types";
import { createClient } from "@/lib/supabase/server";
import type {
  AdBreakdownDaily,
  AdEntity,
  AdMetricsDaily,
  SocialFollowers,
  SocialPost,
} from "@/lib/supabase/database.types";
import { previousRange, type DateRange } from "./period";
import {
  buildAdSetRows,
  buildBreakdown,
  metricsRowToRaw,
  monthlyFollowersSeries,
  sumPosts,
} from "./real-data";
import { sumRawMetrics } from "@/lib/metrics/aggregate";

/**
 * Lectures du Reporting — tout vient de la base, remplie par le connecteur.
 * Comme partout : la RLS fait le cloisonnement, l'erreur est ignorée et une
 * liste vide est une réponse valable (l'écran la dit).
 */

export type AdsData = {
  hasData: boolean;
  adSets: MetricsTableRow[];
  total: RawMetrics;
  previousTotal: RawMetrics;
  age: BarDatum[];
  gender: BarDatum[];
  regions: BarDatum[];
  followers: { label: string; value: number }[];
};

export async function getAdsData(options: {
  workspaceId: string;
  range: DateRange;
}): Promise<AdsData> {
  const supabase = await createClient();
  const previous = previousRange(options.range);

  const [entitiesQuery, metricsQuery, breakdownsQuery, followersQuery] =
    await Promise.all([
      supabase
        .from("ad_entities")
        .select("*")
        .eq("workspace_id", options.workspaceId)
        .limit(2000),
      // Une seule requête couvre la période et sa comparaison : les lignes se
      // répartissent ensuite en mémoire sur la borne `from`.
      supabase
        .from("ad_metrics_daily")
        .select("*")
        .eq("workspace_id", options.workspaceId)
        .gte("date", previous.from)
        .lte("date", options.range.to)
        .limit(10000),
      supabase
        .from("ad_breakdowns_daily")
        .select("*")
        .eq("workspace_id", options.workspaceId)
        .gte("date", options.range.from)
        .lte("date", options.range.to)
        .limit(10000),
      supabase
        .from("social_followers")
        .select("*")
        .eq("workspace_id", options.workspaceId)
        .eq("platform", "instagram")
        .order("date")
        .limit(1000),
    ]);

  const entities = (entitiesQuery.data ?? []) as unknown as AdEntity[];
  const allMetrics = (metricsQuery.data ?? []) as unknown as AdMetricsDaily[];
  const breakdowns = (breakdownsQuery.data ?? []) as unknown as AdBreakdownDaily[];
  const followers = (followersQuery.data ?? []) as unknown as SocialFollowers[];

  const current = allMetrics.filter((row) => row.date >= options.range.from);
  const before = allMetrics.filter((row) => row.date < options.range.from);

  const total = sumRawMetrics(current.map(metricsRowToRaw));

  return {
    hasData: current.length > 0,
    adSets: buildAdSetRows(entities, current),
    total,
    previousTotal: sumRawMetrics(before.map(metricsRowToRaw)),
    age: buildBreakdown(breakdowns, "age"),
    gender: buildBreakdown(breakdowns, "gender"),
    regions: buildBreakdown(breakdowns, "region"),
    followers: monthlyFollowersSeries(followers),
  };
}

export type OrganicData = {
  hasData: boolean;
  posts: SocialPost[];
  total: RawMetrics;
  previousTotal: RawMetrics;
  followers: { label: string; value: number }[];
  followersNow: number | null;
};

export async function getOrganicData(options: {
  workspaceId: string;
  platform: "instagram" | "facebook";
  range: DateRange;
}): Promise<OrganicData> {
  const supabase = await createClient();
  const previous = previousRange(options.range);

  const [postsQuery, followersQuery] = await Promise.all([
    supabase
      .from("social_posts")
      .select("*")
      .eq("workspace_id", options.workspaceId)
      .eq("platform", options.platform)
      .gte("published_at", `${previous.from}T00:00:00Z`)
      // Borne exclusive au lendemain : `published_at` est un instant, pas un
      // jour — « jusqu'au 31 » veut dire « jusqu'au 31 à minuit passé ».
      .lt("published_at", `${nextDay(options.range.to)}T00:00:00Z`)
      .order("published_at", { ascending: false })
      .limit(500),
    supabase
      .from("social_followers")
      .select("*")
      .eq("workspace_id", options.workspaceId)
      .eq("platform", options.platform)
      .order("date")
      .limit(1000),
  ]);

  const allPosts = (postsQuery.data ?? []) as unknown as SocialPost[];
  const followers = (followersQuery.data ?? []) as unknown as SocialFollowers[];

  const posts = allPosts.filter(
    (post) => post.published_at >= `${options.range.from}T00:00:00Z`,
  );
  const before = allPosts.filter(
    (post) => post.published_at < `${options.range.from}T00:00:00Z`,
  );

  const last = followers.at(-1);

  return {
    hasData: posts.length > 0 || followers.length > 0,
    posts,
    total: sumPosts(posts),
    previousTotal: sumPosts(before),
    followers: monthlyFollowersSeries(followers),
    followersNow: last ? last.followers_count : null,
  };
}

function nextDay(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export type ReportingSource = {
  provider: string;
  display_name: string | null;
  status: string;
  last_sync_at: string | null;
  last_error: string | null;
};

/**
 * L'état des sources branchées — la page le montre quand une synchronisation
 * a échoué : la cause exacte vaut mieux qu'un écran vide inexpliqué.
 */
export async function listReportingSources(
  workspaceId: string,
): Promise<ReportingSource[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("data_sources")
    .select("provider, display_name, status, last_sync_at, last_error")
    .eq("workspace_id", workspaceId)
    .limit(20);

  return (data ?? []) as unknown as ReportingSource[];
}
