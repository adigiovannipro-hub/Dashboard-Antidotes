import "server-only";

import type { MetricsTableRow } from "@/components/viz/metrics-table";
import type { BarDatum } from "@/components/viz/bar-list";
import type { RawMetrics } from "@/lib/metrics/types";
import { createClient } from "@/lib/supabase/server";
import type {
  AdBreakdownDaily,
  AdCustomEventDaily,
  AdEntity,
  AdMetricsDaily,
  SocialFollowers,
  SocialPost,
} from "@/lib/supabase/database.types";
import { previousRange, type DateRange } from "./period";
import {
  aggregateCustomEvents,
  buildAdSetRows,
  buildBreakdown,
  foldClientConversions,
  metricsRowToRaw,
  monthlyFollowersSeries,
  sumPosts,
  type ConversionRoles,
  type CustomEventTotal,
} from "./real-data";
import { sumRawMetrics } from "@/lib/metrics/aggregate";

/**
 * Lectures du Reporting — tout vient de la base, remplie par le connecteur.
 * Comme partout : la RLS fait le cloisonnement, l'erreur est ignorée et une
 * liste vide est une réponse valable (l'écran la dit).
 */

export type AdsData = {
  hasData: boolean;
  /** Les événements pixel propres au client — 0051. Vide pour la plupart. */
  customEvents: CustomEventTotal[];
  /** Le rôle donné à chacun — achat, panier — réglage par compte. */
  roles: ConversionRoles;
  adSets: MetricsTableRow[];
  total: RawMetrics;
  previousTotal: RawMetrics;
  /** Le total du compte entier, pour la ligne de pied du tableau : il ne bouge
      pas quand un ad set est ciblé — le tableau reste l'outil de comparaison. */
  tableTotal: RawMetrics;
  /** L'ad set ciblé par le drill-down, résolu en clair pour la pastille. */
  focus: { id: string; campaign: string | null; adSet: string } | null;
  age: BarDatum[];
  gender: BarDatum[];
  regions: BarDatum[];
  followers: { label: string; value: number }[];
};

export async function getAdsData(options: {
  workspaceId: string;
  range: DateRange;
  /** Drill-down : restreint chiffres, entonnoir et événements pixel à un seul
      ad set. Les ventilations Persona restent au compte entier — elles sont
      collectées à ce grain (voir le sync), et l'écran le dit. */
  entityId?: string;
  /** Lecteur imposé — la page de partage public passe l'admin, le token faisant office de droit. */
  reader?: Awaited<ReturnType<typeof createClient>>;
}): Promise<AdsData> {
  const supabase = options.reader ?? (await createClient());
  const previous = previousRange(options.range);

  const [entitiesQuery, metricsQuery, breakdownsQuery, followersQuery, customQuery] =
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
      /* Les événements pixel personnalisés — 0051. L'erreur est ignorée comme
         partout ici : la RLS est l'autorité, et une liste vide est la bonne
         réponse tant que la migration n'est pas passée. La fenêtre couvre la
         période **et sa comparaison**, comme pour les métriques : chez un
         client dont tous les achats viennent du pixel, une comparaison qui ne
         les lirait pas afficherait « M-1 : 0 » pour toujours. */
      supabase
        .from("ad_custom_events_daily")
        .select("*")
        .eq("workspace_id", options.workspaceId)
        .gte("date", previous.from)
        .lte("date", options.range.to)
        .limit(10000),
    ]);

  const entities = (entitiesQuery.data ?? []) as unknown as AdEntity[];
  const allMetrics = (metricsQuery.data ?? []) as unknown as AdMetricsDaily[];
  const breakdowns = (breakdownsQuery.data ?? []) as unknown as AdBreakdownDaily[];
  const followers = (followersQuery.data ?? []) as unknown as SocialFollowers[];
  const allCustoms = (customQuery.data ?? []) as unknown as AdCustomEventDaily[];

  /* Le drill-down se fait à la lecture, en mémoire : un ad set inconnu — ligne
     supprimée, URL recopiée d'un autre compte — retombe sur la vue entière au
     lieu d'un écran de zéros qui se lirait comme une contre-performance. */
  // La clé publique est l'identifiant Meta (celui des lignes du tableau), pas
  // l'uuid interne : c'est lui qui vit dans l'URL et survit à un re-seed.
  const focusEntity = options.entityId
    ? (entities.find(
        (entity) =>
          entity.external_id === options.entityId && entity.level === "adset",
      ) ?? null)
    : null;
  const scoped = <T extends { entity_id: string }>(rows: T[]): T[] =>
    focusEntity ? rows.filter((row) => row.entity_id === focusEntity.id) : rows;

  const customs = scoped(allCustoms.filter((row) => row.date >= options.range.from));
  const customsBefore = scoped(
    allCustoms.filter((row) => row.date < options.range.from),
  );
  const customsAll = allCustoms.filter((row) => row.date >= options.range.from);

  /* Le rôle donné à chaque événement du client. Réglage par compte
     publicitaire, appliqué **à la lecture** : les lignes collectées restent
     fidèles à Meta, et changer d'avis ne demande pas de resynchroniser. */
  const { data: sourceRows } = await supabase
    .from("data_sources")
    .select("purchase_event_names, add_to_cart_event_names")
    .eq("workspace_id", options.workspaceId)
    .eq("provider", "meta_ads");

  const reglages = (sourceRows ?? []) as unknown as {
    purchase_event_names: string[] | null;
    add_to_cart_event_names: string[] | null;
  }[];

  const roles: ConversionRoles = {
    purchase: [...new Set(reglages.flatMap((row) => row.purchase_event_names ?? []))],
    addToCart: [
      ...new Set(reglages.flatMap((row) => row.add_to_cart_event_names ?? [])),
    ],
  };

  // Les événements de la période, par ad set, pour que la colonne « Achats »
  // du tableau dise la même chose que la carte du haut. Le tableau reste
  // entier même en drill-down : c'est lui l'outil de sélection.
  const customsByEntity = new Map<string, AdCustomEventDaily[]>();
  for (const row of customsAll) {
    const list = customsByEntity.get(row.entity_id) ?? [];
    list.push(row);
    customsByEntity.set(row.entity_id, list);
  }
  const eventsByEntity = new Map(
    [...customsByEntity.entries()].map(([entityId, rows]) => [
      entityId,
      aggregateCustomEvents(rows, 0),
    ]),
  );

  const currentAll = allMetrics.filter((row) => row.date >= options.range.from);
  const current = scoped(currentAll);
  const before = scoped(allMetrics.filter((row) => row.date < options.range.from));

  const allEvents = aggregateCustomEvents(customs, 0);
  const total = foldClientConversions(
    sumRawMetrics(current.map(metricsRowToRaw)),
    allEvents,
    roles,
  );

  const tableTotal = focusEntity
    ? foldClientConversions(
        sumRawMetrics(currentAll.map(metricsRowToRaw)),
        aggregateCustomEvents(customsAll, 0),
        roles,
      )
    : total;

  // La comparaison se plie comme la période : sans ça, le delta d'un client
  // au pixel custom dirait « +∞ » chaque mois.
  const previousTotal = foldClientConversions(
    sumRawMetrics(before.map(metricsRowToRaw)),
    aggregateCustomEvents(customsBefore, 0),
    roles,
  );

  return {
    hasData: currentAll.length > 0,
    customEvents: aggregateCustomEvents(customs, total.spend),
    roles,
    adSets: buildAdSetRows(entities, currentAll, eventsByEntity, roles),
    total,
    previousTotal,
    tableTotal,
    focus: focusEntity
      ? {
          id: focusEntity.external_id,
          campaign: focusEntity.parent_external_id
            ? (entities.find(
                (entity) => entity.external_id === focusEntity.parent_external_id,
              )?.name ?? null)
            : null,
          adSet: focusEntity.name,
        }
      : null,
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
  // TikTok n'a pas de connecteur, mais ses relevés d'abonnés (reprise
  // Looker) vivent déjà en base : l'onglet lit ce qui existe.
  platform: "instagram" | "facebook" | "tiktok";
  range: DateRange;
  reader?: Awaited<ReturnType<typeof createClient>>;
}): Promise<OrganicData> {
  const supabase = options.reader ?? (await createClient());
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
