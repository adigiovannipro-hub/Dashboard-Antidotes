import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, DataSource } from "@/lib/supabase/database.types";
import { findGaConnectedAccountId, gaTransport } from "./composio";
import { explainGaError } from "./errors";
import {
  BREAKDOWN_DIMENSIONS,
  BREAKDOWN_METRICS,
  DAILY_METRICS,
  MONTHLY_METRICS,
  PAGE_METRICS,
  breakdownRows,
  dailyRows,
  monthlyRows,
  monthsCovering,
  monthWindow,
  pageRows,
  webSyncWindow,
  type WebBreakdownKind,
} from "./mapping";
import type { GaTransport } from "./types";

/**
 * Orchestration de la synchronisation Google Analytics d'un espace.
 *
 * Même chemin que le connecteur Meta : chaque propriété GA rattachée dans
 * `data_sources`, chaque passage un `sync_run`, toutes les écritures des
 * upserts par clé naturelle — rejouer un passage ne duplique rien. Chaque
 * `error` Supabase est testé : une table absente rendrait un « rien à faire »
 * parfaitement rassurant, et un connecteur muet pendant des semaines.
 *
 * La fenêtre : huit jours glissants en régime de croisière — GA réécrit ses
 * chiffres pendant environ 72 h, huit jours absorbent large — et l'histoire
 * entière au premier passage (`backfill_from`, posé au rattachement de la
 * propriété). Les tables mensuelles se redemandent **en mois entiers** sur la
 * fenêtre : GA dédoublonne les visiteurs par plage demandée, un mois ne se
 * collecte donc jamais à moitié.
 */

type Admin = SupabaseClient<Database>;

export type WebSyncReport = {
  property: string;
  rows: number;
  /** Le passage a échoué : rien n'est entré pour cette propriété. */
  error: string | null;
};

function fail(message: string): never {
  throw new Error(message);
}

export async function syncWorkspaceWebAnalytics(options: {
  admin: Admin;
  workspaceId: string;
  /** Borne basse demandée par l'écran — étend la fenêtre de collecte. */
  atLeastSince?: string;
  /** Transport injecté (tests, reprise d'historique) ; Composio sinon. */
  transport?: GaTransport;
}): Promise<WebSyncReport[]> {
  const { admin, workspaceId } = options;
  const reports: WebSyncReport[] = [];

  const { data: sourcesData, error: sourcesError } = await admin
    .from("data_sources")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("provider", "google_analytics");
  if (sourcesError) fail(`Lecture des propriétés GA : ${sourcesError.message}`);

  for (const source of (sourcesData ?? []) as unknown as DataSource[]) {
    const report: WebSyncReport = {
      property: source.display_name ?? source.external_account_id,
      rows: 0,
      error: null,
    };
    reports.push(report);

    try {
      const window = webSyncWindow({
        lastSyncAt: source.last_sync_at,
        backfillFrom: source.backfill_from,
        now: new Date(),
        atLeastSince: options.atLeastSince,
      });

      /* Le rattrapage initial se trace une fois : `backfill_from` garde la
         date atteinte — sans cette trace, on ne saurait plus jusqu'où
         l'historique est fiable. */
      if (!source.last_sync_at && source.backfill_from !== window.since) {
        const { error: backfillError } = await admin
          .from("data_sources")
          .update({ backfill_from: window.since } as never)
          .eq("id", source.id);
        if (backfillError) fail(`Trace du rattrapage : ${backfillError.message}`);
      }

      const { data: run, error: runError } = await admin
        .from("sync_runs")
        .insert({
          data_source_id: source.id,
          workspace_id: workspaceId,
          status: "running",
          date_from: window.since,
          date_to: window.until,
        } as never)
        .select("id")
        .single();
      if (runError) fail(`Journal de passage : ${runError.message}`);
      const runId = (run as unknown as { id: string }).id;

      try {
        /* Le transport se résout **dans** le passage tracé : une clé absente
           ou un compte non connecté finit dans `last_error`, que l'écran
           montre — pas seulement dans la réponse du bouton. */
        let transport = options.transport;
        if (!transport) {
          const account = await findGaConnectedAccountId(workspaceId);
          if ("error" in account) fail(account.error);
          transport = gaTransport({ workspaceId, connectedAccountId: account.id });
        }

        report.rows = await syncProperty({
          admin,
          workspaceId,
          dataSourceId: source.id,
          property: source.external_account_id,
          transport,
          window,
        });

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
          .eq("id", source.id);
        if (sourceDone) fail(`Mise à jour de la source : ${sourceDone.message}`);
      } catch (error) {
        // Le passage échoue mais reste tracé : le `sync_run` porte la cause,
        // la source aussi — c'est ce que l'écran lira pour le dire.
        const message = explainGaError((error as Error).message);
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
          .eq("id", source.id);
        throw error;
      }
    } catch (error) {
      report.error = explainGaError((error as Error).message);
    }
  }

  return reports;
}

/** Un passage sur une propriété : sept rapports, quatre tables, des upserts. */
async function syncProperty(context: {
  admin: Admin;
  workspaceId: string;
  dataSourceId: string;
  property: string;
  transport: GaTransport;
  window: { since: string; until: string };
}): Promise<number> {
  const { admin, workspaceId, dataSourceId, property, transport, window } = context;
  let rows = 0;

  const stamp = { data_source_id: dataSourceId, workspace_id: workspaceId };
  const months = monthsCovering(window.since, window.until);
  const monthly =
    months.length > 0
      ? { from: months[0]!, to: monthWindow(months.at(-1)!).to }
      : { from: window.since, to: window.until };

  // --- Le quotidien : courbes et sommes additives ---------------------------
  const daily = dailyRows(
    await transport({
      property,
      dateRanges: [{ startDate: window.since, endDate: window.until }],
      dimensions: [{ name: "date" }],
      metrics: DAILY_METRICS.map((name) => ({ name })),
      limit: 100000,
    }),
  );
  if (daily.length > 0) {
    const { error } = await admin
      .from("web_metrics_daily")
      .upsert(daily.map((row) => ({ ...stamp, ...row })) as never, {
        onConflict: "data_source_id,date",
      });
    if (error) fail(`Écriture du quotidien : ${error.message}`);
    rows += daily.length;
  }

  // --- Les uniques mensuels : le chiffre exact du rapport -------------------
  const monthlyUniques = monthlyRows(
    await transport({
      property,
      dateRanges: [{ startDate: monthly.from, endDate: monthly.to }],
      dimensions: [{ name: "yearMonth" }],
      metrics: MONTHLY_METRICS.map((name) => ({ name })),
      limit: 100000,
    }),
  );
  if (monthlyUniques.length > 0) {
    const { error } = await admin
      .from("web_metrics_monthly")
      .upsert(monthlyUniques.map((row) => ({ ...stamp, ...row })) as never, {
        onConflict: "data_source_id,month",
      });
    if (error) fail(`Écriture des uniques mensuels : ${error.message}`);
    rows += monthlyUniques.length;
  }

  // --- Les ventilations : sources, appareils, villes, nouveaux/connus -------
  for (const type of Object.keys(BREAKDOWN_DIMENSIONS) as WebBreakdownKind[]) {
    const breakdown = breakdownRows(
      await transport({
        property,
        dateRanges: [{ startDate: monthly.from, endDate: monthly.to }],
        dimensions: [{ name: "yearMonth" }, { name: BREAKDOWN_DIMENSIONS[type] }],
        metrics: BREAKDOWN_METRICS.map((name) => ({ name })),
        limit: 100000,
      }),
      type,
    );
    if (breakdown.length === 0) continue;

    const { error } = await admin
      .from("web_breakdowns_monthly")
      .upsert(breakdown.map((row) => ({ ...stamp, ...row })) as never, {
        onConflict: "data_source_id,month,type,value",
      });
    if (error) fail(`Écriture de la ventilation ${type} : ${error.message}`);
    rows += breakdown.length;
  }

  // --- Les pages : le tableau Top Pages -------------------------------------
  const pages = pageRows(
    await transport({
      property,
      dateRanges: [{ startDate: monthly.from, endDate: monthly.to }],
      dimensions: [{ name: "yearMonth" }, { name: "pagePath" }],
      metrics: PAGE_METRICS.map((name) => ({ name })),
      limit: 100000,
    }),
  );
  if (pages.length > 0) {
    const { error } = await admin
      .from("web_pages_monthly")
      .upsert(pages.map((row) => ({ ...stamp, ...row })) as never, {
        onConflict: "data_source_id,month,path",
      });
    if (error) fail(`Écriture des pages : ${error.message}`);
    rows += pages.length;
  }

  return rows;
}
