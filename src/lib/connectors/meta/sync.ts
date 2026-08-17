import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { decryptSecret } from "@/lib/moderation/crypto";
import type { SocialAccountKind, SocialAccountRow } from "@/lib/social/types";
import type { Database } from "@/lib/supabase/database.types";
import {
  fetchAdBreakdowns,
  fetchAdInsights,
  fetchFollowersCount,
  fetchInstagramMedia,
  fetchPagePosts,
} from "./graph";
import {
  aggregateBreakdown,
  syncWindow,
  toDailyMetricsColumns,
  type MetaInsightRow,
} from "./mapping";
import { mediaToPost, pagePostToPost, type OrganicPostColumns } from "./organic";

/**
 * Orchestration de la synchronisation Meta d'un espace.
 *
 * Le chemin est celui de tout le projet : régie → base → lecture locale.
 * Chaque compte affecté dans Connexions devient une `data_source`, chaque
 * passage un `sync_run`, et toutes les écritures sont des upserts par
 * identifiant externe — rejouer un passage ne duplique rien.
 *
 * Règle des crons appliquée partout : **chaque `error` Supabase est testé**.
 * Une table absente rendrait un « rien à faire » parfaitement rassurant, et
 * un connecteur muet pendant des semaines.
 */

type Admin = SupabaseClient<Database>;

export type SourceSyncReport = {
  kind: SocialAccountKind;
  account: string;
  rows: number;
  error: string | null;
};

type SourceContext = {
  admin: Admin;
  workspaceId: string;
  dataSourceId: string;
  accessToken: string;
  window: { since: string; until: string };
};

function fail(message: string): never {
  throw new Error(message);
}

/** Aujourd'hui en UTC — le grain de tous les instantanés d'abonnés. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** `since` au format que Graph accepte partout : secondes Unix. */
function unixSince(date: string): string {
  return String(Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000));
}

export async function syncWorkspaceReporting(options: {
  admin: Admin;
  workspaceId: string;
  /** Borne basse demandée par l'écran — étend la fenêtre, jamais ne la
      raccourcit. C'est ce qui permet à une plage ancienne du sélecteur de
      déclencher le rattrapage qui la couvrira. */
  atLeastSince?: string;
}): Promise<SourceSyncReport[]> {
  const { admin, workspaceId } = options;
  const reports: SourceSyncReport[] = [];

  const { data: links, error: linksError } = await admin
    .from("workspace_social_accounts")
    .select("kind, account_id")
    .eq("workspace_id", workspaceId)
    .in("kind", ["meta_ad_account", "instagram", "facebook_page"]);

  if (linksError) fail(`Lecture des affectations : ${linksError.message}`);

  for (const link of (links ?? []) as { kind: SocialAccountKind; account_id: string }[]) {
    const report: SourceSyncReport = {
      kind: link.kind,
      account: link.account_id,
      rows: 0,
      error: null,
    };
    reports.push(report);

    try {
      const { data: account, error: accountError } = await admin
        .from("social_accounts")
        .select("*")
        .eq("id", link.account_id)
        .single();
      if (accountError) fail(`Compte introuvable : ${accountError.message}`);

      const row = account as unknown as SocialAccountRow;
      report.account = row.display_name ?? row.username ?? row.external_id;

      const { data: secret, error: secretError } = await admin
        .from("social_account_secrets")
        .select("credentials_encrypted")
        .eq("account_id", link.account_id)
        .maybeSingle();
      if (secretError) fail(`Lecture du jeton : ${secretError.message}`);
      const blob = (secret as { credentials_encrypted?: string } | null)
        ?.credentials_encrypted;
      if (!blob) fail("Aucun jeton enregistré — rebrancher Meta depuis Connexions.");

      const accessToken = decryptSecret(blob);

      // Une source par (espace, fournisseur, compte externe) — la clé
      // d'unicité de 0001. L'upsert rend la ligne, ancienne ou neuve.
      const provider = link.kind === "meta_ad_account" ? "meta_ads" : "meta_organic";
      const { data: source, error: sourceError } = await admin
        .from("data_sources")
        .upsert(
          {
            workspace_id: workspaceId,
            provider,
            external_account_id: row.external_id,
            display_name: report.account,
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

      const window = syncWindow({
        lastSyncAt: last_sync_at,
        now: new Date(),
        atLeastSince: options.atLeastSince,
      });

      const { data: run, error: runError } = await admin
        .from("sync_runs")
        .insert({
          data_source_id: dataSourceId,
          workspace_id: workspaceId,
          status: "running",
          date_from: window.since,
          date_to: window.until,
        } as never)
        .select("id")
        .single();
      if (runError) fail(`Journal de passage : ${runError.message}`);
      const runId = (run as unknown as { id: string }).id;

      const context: SourceContext = {
        admin,
        workspaceId,
        dataSourceId,
        accessToken,
        window,
      };

      try {
        if (link.kind === "meta_ad_account") {
          report.rows = await syncAds(context, row.external_id);
        } else {
          report.rows = await syncOrganic(context, row);
        }

        const now = new Date().toISOString();
        const { error: doneError } = await admin
          .from("sync_runs")
          .update({
            status: "success",
            finished_at: now,
            rows_ingested: report.rows,
          } as never)
          .eq("id", runId);
        if (doneError) fail(`Clôture du passage : ${doneError.message}`);

        const { error: sourceDone } = await admin
          .from("data_sources")
          .update({ status: "connected", last_sync_at: now, last_error: null } as never)
          .eq("id", dataSourceId);
        if (sourceDone) fail(`Mise à jour de la source : ${sourceDone.message}`);
      } catch (error) {
        // Le passage échoue mais reste tracé : le `sync_run` porte la cause,
        // la source aussi — c'est ce que l'écran lira pour le dire.
        const message = (error as Error).message;
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
      report.error = (error as Error).message;
    }
  }

  return reports;
}

// --- Publicitaire -------------------------------------------------------------

async function syncAds(
  context: SourceContext,
  adAccountId: string,
): Promise<number> {
  const { admin, workspaceId, dataSourceId, accessToken, window } = context;

  const [rows, ageGender, regions] = await Promise.all([
    fetchAdInsights({ adAccountId, accessToken, ...window }),
    fetchAdBreakdowns({ adAccountId, accessToken, ...window, breakdowns: "age,gender" }),
    fetchAdBreakdowns({ adAccountId, accessToken, ...window, breakdowns: "region" }),
  ]);

  // Les entités se déduisent des lignes : Meta ne rend que ce qui a dépensé,
  // et c'est exactement ce que le tableau doit montrer.
  const entities = new Map<
    string,
    { level: "campaign" | "adset"; name: string; parent: string | null }
  >();
  for (const row of rows) {
    if (row.campaign_id) {
      entities.set(row.campaign_id, {
        level: "campaign",
        name: row.campaign_name ?? row.campaign_id,
        parent: null,
      });
    }
    if (row.adset_id) {
      entities.set(row.adset_id, {
        level: "adset",
        name: row.adset_name ?? row.adset_id,
        parent: row.campaign_id ?? null,
      });
    }
  }

  let ingested = 0;

  if (entities.size > 0) {
    const now = new Date().toISOString();
    const { data: saved, error } = await admin
      .from("ad_entities")
      .upsert(
        [...entities.entries()].map(([externalId, entity]) => ({
          data_source_id: dataSourceId,
          workspace_id: workspaceId,
          level: entity.level,
          external_id: externalId,
          parent_external_id: entity.parent,
          name: entity.name,
          updated_at: now,
        })) as never,
        { onConflict: "data_source_id,external_id" },
      )
      .select("id, external_id");
    if (error) fail(`Entités publicitaires : ${error.message}`);

    const entityIds = new Map(
      ((saved ?? []) as unknown as { id: string; external_id: string }[]).map(
        (entity) => [entity.external_id, entity.id],
      ),
    );

    const metricRows = rows.flatMap((row: MetaInsightRow) => {
      const entityId = row.adset_id ? entityIds.get(row.adset_id) : undefined;
      const columns = toDailyMetricsColumns(row);
      if (!entityId || !columns.date) return [];
      return [
        {
          data_source_id: dataSourceId,
          workspace_id: workspaceId,
          entity_id: entityId,
          ...columns,
          updated_at: now,
        },
      ];
    });

    if (metricRows.length > 0) {
      const { error: metricsError } = await admin
        .from("ad_metrics_daily")
        .upsert(metricRows as never, { onConflict: "entity_id,date" });
      if (metricsError) fail(`Métriques journalières : ${metricsError.message}`);
      ingested += metricRows.length;
    }
  }

  const breakdownRows = [
    ...aggregateBreakdown(ageGender, "age").map((cell) => ({ type: "age", ...cell })),
    ...aggregateBreakdown(ageGender, "gender").map((cell) => ({ type: "gender", ...cell })),
    ...aggregateBreakdown(regions, "region").map((cell) => ({ type: "region", ...cell })),
  ].map((cell) => ({
    data_source_id: dataSourceId,
    workspace_id: workspaceId,
    date: cell.date,
    type: cell.type,
    value: cell.value,
    spend: cell.spend,
    impressions: cell.impressions,
    clicks: cell.clicks,
    updated_at: new Date().toISOString(),
  }));

  if (breakdownRows.length > 0) {
    const { error } = await admin
      .from("ad_breakdowns_daily")
      .upsert(breakdownRows as never, { onConflict: "data_source_id,date,type,value" });
    if (error) fail(`Ventilations : ${error.message}`);
    ingested += breakdownRows.length;
  }

  return ingested;
}

// --- Organique ----------------------------------------------------------------

async function syncOrganic(
  context: SourceContext,
  account: SocialAccountRow,
): Promise<number> {
  const { admin, workspaceId, dataSourceId, accessToken, window } = context;
  const platform = account.kind === "instagram" ? "instagram" : "facebook";

  let posts: OrganicPostColumns[];
  if (account.kind === "instagram") {
    // Le listing des médias se borne côté client, en date ISO — voir graph.ts.
    const media = await fetchInstagramMedia({
      igUserId: account.external_id,
      accessToken,
      since: window.since,
    });
    posts = media
      // Une story disparaît en 24 h : elle n'a pas sa place dans une table de
      // publications qu'on compare de mois en mois.
      .filter((item) => item.media_product_type !== "STORY")
      .flatMap((item) => mediaToPost(item) ?? []);
  } else {
    const pagePosts = await fetchPagePosts({
      pageId: account.external_id,
      accessToken,
      since: unixSince(window.since),
    });
    posts = pagePosts.flatMap((post) => pagePostToPost(post) ?? []);
  }

  let ingested = 0;

  if (posts.length > 0) {
    const now = new Date().toISOString();
    const { error } = await admin.from("social_posts").upsert(
      posts.map((post) => ({
        data_source_id: dataSourceId,
        workspace_id: workspaceId,
        platform,
        ...post,
        updated_at: now,
      })) as never,
      { onConflict: "data_source_id,external_id" },
    );
    if (error) fail(`Publications : ${error.message}`);
    ingested += posts.length;
  }

  const followers = await fetchFollowersCount({
    nodeId: account.external_id,
    accessToken,
  });

  if (followers !== null) {
    const { error } = await admin.from("social_followers").upsert(
      {
        data_source_id: dataSourceId,
        workspace_id: workspaceId,
        platform,
        date: today(),
        followers_count: followers,
        source: "api",
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "data_source_id,platform,date" },
    );
    if (error) fail(`Abonnés : ${error.message}`);
    ingested += 1;

    // La vitrine de l'inventaire suit — c'est elle que l'en-tête du feed lit.
    const { error: vitrineError } = await admin
      .from("social_accounts")
      .update({
        followers_count: followers,
        last_synced_at: new Date().toISOString(),
      } as never)
      .eq("id", account.id);
    if (vitrineError) fail(`Vitrine du compte : ${vitrineError.message}`);
  }

  return ingested;
}
