import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { findAgencyAccount } from "@/lib/composio/agency";
import { BACKFILL_MONTHS } from "@/lib/connectors/meta/mapping";
import type { SocialAccountRow } from "@/lib/social/types";
import type { Database } from "@/lib/supabase/database.types";
import { tiktokAdsTransport } from "./api";
import { explainTiktokAdsError } from "./errors";
import {
  advertisersFrom,
  AUDIENCE_METRICS,
  audienceBreakdown,
  businessCentersFrom,
  dailyAdGroups,
  entitiesFrom,
  listOf,
  PAGE_SIZE,
  REPORT_METRICS,
  reportWindows,
  toDailyMetricsColumns,
  totalPages,
  uniqueAdvertisers,
} from "./mapping";
import type { TiktokAdsTransport, TiktokAdvertiser, TiktokReportRow } from "./types";

/**
 * Collecte TikTok Ads d'un espace.
 *
 * Le chemin de tout le projet : service → base → lecture locale. TikTok Ads
 * se range dans les **mêmes tables** que Meta Ads — `ad_entities`,
 * `ad_metrics_daily`, `ad_breakdowns_daily` — sous sa propre source
 * (`provider = 'tiktok_ads'`), que la lecture du Reporting sépare de Meta.
 * Le groupe d'annonces de TikTok tient le rang de l'ad set de Meta.
 *
 * Règle des crons appliquée partout : chaque `error` Supabase est testé.
 */

type Admin = SupabaseClient<Database>;

export type TiktokAdsSyncReport = {
  account: string;
  rows: number;
  error: string | null;
  warning?: string | null;
};

/** Les passages suivants : TikTok réécrit ses conversions sur une fenêtre d'attribution. */
const PASSAGE_COURANT_JOURS = 35;

function fail(message: string): never {
  throw new Error(message);
}

/** Toutes les pages d'un GET paginé de la Marketing API. */
async function fetchAllPages(
  transport: TiktokAdsTransport,
  endpoint: string,
  params: Record<string, string>,
): Promise<unknown[]> {
  const first = await transport(endpoint, { ...params, page: "1" });
  const rows = [...listOf(first)];
  const pages = Math.min(totalPages(first), 50);
  for (let page = 2; page <= pages; page += 1) {
    rows.push(...listOf(await transport(endpoint, { ...params, page: String(page) })));
  }
  return rows;
}

/** Les comptes publicitaires que le login branché atteint, Business Center par Business Center. */
async function fetchAdvertisers(transport: TiktokAdsTransport): Promise<TiktokAdvertiser[]> {
  const centers = businessCentersFrom({
    list: await fetchAllPages(transport, "/bc/get/", { page_size: "50" }),
  });

  const advertisers: TiktokAdvertiser[] = [];
  for (const center of centers) {
    const assets = await fetchAllPages(transport, "/bc/asset/get/", {
      bc_id: center.id,
      asset_type: "ADVERTISER",
      page_size: "50",
    });
    advertisers.push(...advertisersFrom({ list: assets }, center));
  }
  return uniqueAdvertisers(advertisers);
}

/**
 * L'inventaire de l'agence, mis à jour depuis TikTok.
 *
 * Rien n'est affecté au passage — même règle que Meta et LinkedIn : le choix
 * du compte qui alimente le Reporting d'un client reste un geste explicite
 * dans Connexions.
 */
export async function importTiktokAdsInventory(options: {
  admin: Admin;
  orgId: string;
  connectedBy: string | null;
}): Promise<{ accounts: number } | { error: string }> {
  const connected = await findAgencyAccount("tiktok_ads");
  if ("error" in connected) return { error: connected.error };

  let advertisers: TiktokAdvertiser[];
  try {
    advertisers = await fetchAdvertisers(tiktokAdsTransport(connected.id));
  } catch (error) {
    return { error: explainTiktokAdsError((error as Error).message) };
  }

  if (advertisers.length === 0) {
    return {
      error:
        "Le compte TikTok branché ne voit aucun compte publicitaire dans ses Business Centers. Lui donner un rôle sur le compte du client, puis relancer.",
    };
  }

  const now = new Date().toISOString();
  const { error } = await options.admin.from("social_accounts").upsert(
    advertisers.map((advertiser) => ({
      org_id: options.orgId,
      kind: "tiktok_ad_account",
      external_id: advertiser.id,
      display_name: advertiser.name,
      /* Le Business Center tient lieu de pseudo : la liste de Connexions
         l'affiche à côté du nom, et c'est lui qui dit à quel client un compte
         publicitaire appartient. */
      username: advertiser.businessCenterName,
      parent_external_id: advertiser.businessCenterId,
      status: "connected",
      last_error: null,
      connected_by: options.connectedBy,
      updated_at: now,
    })) as never,
    { onConflict: "org_id,kind,external_id" },
  );
  if (error) return { error: `Inventaire TikTok Ads : ${error.message}` };

  return { accounts: advertisers.length };
}

/** La fenêtre de collecte : un an au premier passage, puis 35 jours glissants. */
function syncSince(options: {
  now: Date;
  lastSyncAt: string | null;
  atLeastSince?: string;
}): string {
  const computed = options.lastSyncAt
    ? new Date(options.now.getTime() - PASSAGE_COURANT_JOURS * 86_400_000)
        .toISOString()
        .slice(0, 10)
    : new Date(
        Date.UTC(
          options.now.getUTCFullYear(),
          options.now.getUTCMonth() - BACKFILL_MONTHS,
          1,
        ),
      )
        .toISOString()
        .slice(0, 10);

  return options.atLeastSince && options.atLeastSince < computed
    ? options.atLeastSince
    : computed;
}

/** La collecte d'un espace. `null` si aucun compte TikTok Ads n'y est affecté. */
export async function syncWorkspaceTiktokAds(options: {
  admin: Admin;
  workspaceId: string;
  now?: Date;
  /** Borne basse demandée par l'écran — étend la fenêtre, jamais ne la réduit. */
  atLeastSince?: string;
}): Promise<TiktokAdsSyncReport | null> {
  const { admin, workspaceId } = options;
  const now = options.now ?? new Date();

  const { data: link, error: linkError } = await admin
    .from("workspace_social_accounts")
    .select("account_id")
    .eq("workspace_id", workspaceId)
    .eq("kind", "tiktok_ad_account")
    .maybeSingle();
  if (linkError) fail(`Lecture de l'affectation TikTok Ads : ${linkError.message}`);

  const accountId = (link as { account_id?: string } | null)?.account_id;
  if (!accountId) return null;

  const report: TiktokAdsSyncReport = { account: accountId, rows: 0, error: null };

  try {
    const { data: row, error: accountError } = await admin
      .from("social_accounts")
      .select("*")
      .eq("id", accountId)
      .single();
    if (accountError) fail(`Compte introuvable : ${accountError.message}`);

    const account = row as unknown as SocialAccountRow;
    report.account = account.display_name ?? account.external_id;

    const connected = await findAgencyAccount("tiktok_ads");
    if ("error" in connected) fail(connected.error);
    const transport = tiktokAdsTransport(connected.id);

    const { data: source, error: sourceError } = await admin
      .from("data_sources")
      .upsert(
        {
          workspace_id: workspaceId,
          provider: "tiktok_ads",
          external_account_id: account.external_id,
          display_name: `TikTok Ads · ${report.account}`,
          status: "connected",
        } as never,
        { onConflict: "workspace_id,provider,external_account_id" },
      )
      .select("id, last_sync_at")
      .single();
    if (sourceError) fail(`Source de données : ${sourceError.message}`);
    const { id: dataSourceId, last_sync_at } = source as unknown as {
      id: string;
      last_sync_at: string | null;
    };

    const since = syncSince({ now, lastSyncAt: last_sync_at, atLeastSince: options.atLeastSince });
    const until = now.toISOString().slice(0, 10);

    const { data: run, error: runError } = await admin
      .from("sync_runs")
      .insert({
        data_source_id: dataSourceId,
        workspace_id: workspaceId,
        status: "running",
        date_from: since,
        date_to: until,
      } as never)
      .select("id")
      .single();
    if (runError) fail(`Journal de passage : ${runError.message}`);
    const runId = (run as unknown as { id: string }).id;

    try {
      const warning = await collect({
        admin,
        transport,
        workspaceId,
        dataSourceId,
        advertiserId: account.external_id,
        since,
        until,
        report,
      });
      report.warning = warning;

      const stamp = new Date().toISOString();
      const { error: doneError } = await admin
        .from("sync_runs")
        .update({
          status: "success",
          finished_at: stamp,
          rows_ingested: report.rows,
          error: warning,
        } as never)
        .eq("id", runId);
      if (doneError) fail(`Clôture du passage : ${doneError.message}`);

      const { error: sourceDone } = await admin
        .from("data_sources")
        .update({ status: "connected", last_sync_at: stamp, last_error: warning } as never)
        .eq("id", dataSourceId);
      if (sourceDone) fail(`Mise à jour de la source : ${sourceDone.message}`);
    } catch (error) {
      const message = explainTiktokAdsError((error as Error).message);
      await admin
        .from("sync_runs")
        .update({
          status: "error",
          finished_at: new Date().toISOString(),
          rows_ingested: report.rows,
          error: message,
        } as never)
        .eq("id", runId);
      await admin
        .from("data_sources")
        .update({ status: "error", last_error: message } as never)
        .eq("id", dataSourceId);
      throw error;
    }
  } catch (error) {
    report.error = explainTiktokAdsError((error as Error).message);
  }

  return report;
}

async function collect(context: {
  admin: Admin;
  transport: TiktokAdsTransport;
  workspaceId: string;
  dataSourceId: string;
  advertiserId: string;
  since: string;
  until: string;
  report: TiktokAdsSyncReport;
}): Promise<string | null> {
  const { admin, transport, workspaceId, dataSourceId, advertiserId, report } = context;
  const warnings: string[] = [];

  const reportParams = (window: { from: string; to: string }) => ({
    advertiser_id: advertiserId,
    report_type: "BASIC",
    data_level: "AUCTION_ADGROUP",
    dimensions: JSON.stringify(["adgroup_id", "stat_time_day"]),
    metrics: JSON.stringify(REPORT_METRICS),
    start_date: window.from,
    end_date: window.to,
    page_size: String(PAGE_SIZE),
  });

  const audienceParams = (window: { from: string; to: string }, axis: "age" | "gender") => ({
    advertiser_id: advertiserId,
    report_type: "AUDIENCE",
    data_level: "AUCTION_ADVERTISER",
    dimensions: JSON.stringify([axis, "stat_time_day"]),
    metrics: JSON.stringify(AUDIENCE_METRICS),
    start_date: window.from,
    end_date: window.to,
    page_size: String(PAGE_SIZE),
  });

  /* Tranche par tranche, en série : trente jours au plus par rapport au
     grain jour (refus 40002 au-delà, constaté), et un refus de débit ne
     s'échange pas contre un autre en parallélisant. */
  for (const window of reportWindows(context.since, context.until)) {
    const days = dailyAdGroups(
      (await fetchAllPages(
        transport,
        "/report/integrated/get/",
        reportParams(window),
      )) as TiktokReportRow[],
    );

    /* La tranche relue fait foi : ses lignes remplacent celles de la base.
       Un upsert seul laisserait vivre un jour que TikTok a depuis ramené à
       zéro — et que le rapport n'envoie plus, puisqu'on écarte les lignes
       muettes. La suppression ne part qu'après une lecture réussie. */
    const { error: purgeError } = await admin
      .from("ad_metrics_daily")
      .delete()
      .eq("data_source_id", dataSourceId)
      .gte("date", window.from)
      .lte("date", window.to);
    if (purgeError) fail(`Remise à plat de la tranche : ${purgeError.message}`);

    if (days.length > 0) {
      const stamp = new Date().toISOString();
      const { data: entities, error: entitiesError } = await admin
        .from("ad_entities")
        .upsert(
          entitiesFrom(days).map((entity) => ({
            data_source_id: dataSourceId,
            workspace_id: workspaceId,
            level: entity.level,
            external_id: entity.externalId,
            parent_external_id: entity.parentExternalId,
            name: entity.name,
            updated_at: stamp,
          })) as never,
          { onConflict: "data_source_id,external_id" },
        )
        .select("id, external_id");
      if (entitiesError) fail(`Campagnes et groupes d'annonces : ${entitiesError.message}`);

      const idByExternal = new Map(
        ((entities ?? []) as { id: string; external_id: string }[]).map((entity) => [
          entity.external_id,
          entity.id,
        ]),
      );

      const metrics = days.flatMap((day) => {
        const entityId = idByExternal.get(day.adgroupId);
        return entityId
          ? [
              {
                data_source_id: dataSourceId,
                workspace_id: workspaceId,
                entity_id: entityId,
                ...toDailyMetricsColumns(day),
                updated_at: stamp,
              },
            ]
          : [];
      });

      const { error: metricsError } = await admin
        .from("ad_metrics_daily")
        .upsert(metrics as never, { onConflict: "entity_id,date" });
      if (metricsError) fail(`Chiffres quotidiens : ${metricsError.message}`);
      report.rows += metrics.length;
    }

    /* Le Persona : âge et genre, au grain compte — TikTok ne ventile pas par
       groupe d'annonces. Un refus ici ne coûte que les deux listes : les
       chiffres sont déjà écrits. Pas de région : TikTok la rend en
       identifiants GeoNames, qu'aucune table ne traduit ici. */
    try {
      const cells = [
        ...audienceBreakdown(
          (await fetchAllPages(
            transport,
            "/report/integrated/get/",
            audienceParams(window, "age"),
          )) as TiktokReportRow[],
          "age",
        ).map((cell) => ({ ...cell, type: "age" as const })),
        ...audienceBreakdown(
          (await fetchAllPages(
            transport,
            "/report/integrated/get/",
            audienceParams(window, "gender"),
          )) as TiktokReportRow[],
          "gender",
        ).map((cell) => ({ ...cell, type: "gender" as const })),
      ];

      const { error: purgeBreakdowns } = await admin
        .from("ad_breakdowns_daily")
        .delete()
        .eq("data_source_id", dataSourceId)
        .gte("date", window.from)
        .lte("date", window.to);
      if (purgeBreakdowns) fail(`Remise à plat du Persona : ${purgeBreakdowns.message}`);

      if (cells.length > 0) {
        const stamp = new Date().toISOString();
        const { error: breakdownError } = await admin.from("ad_breakdowns_daily").upsert(
          cells.map((cell) => ({
            data_source_id: dataSourceId,
            workspace_id: workspaceId,
            date: cell.date,
            type: cell.type,
            value: cell.value,
            spend: cell.spend,
            impressions: cell.impressions,
            clicks: cell.clicks,
            updated_at: stamp,
          })) as never,
          { onConflict: "data_source_id,date,type,value" },
        );
        if (breakdownError) fail(`Persona : ${breakdownError.message}`);
        report.rows += cells.length;
      }
    } catch (error) {
      const message = `Persona non lu (${window.from} → ${window.to}) : ${explainTiktokAdsError((error as Error).message)}`;
      if (!warnings.includes(message)) warnings.push(message);
    }
  }

  return warnings.length > 0 ? warnings.slice(0, 3).join(" · ") : null;
}
