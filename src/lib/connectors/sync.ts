import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database,
  DataProvider,
  DataSource,
} from "@/lib/supabase/database.types";

import { getConnector } from "./registry";
import { ADS_PROVIDERS, type SyncWindow } from "./types";

export type ReportingSyncStep = {
  sourceId: string;
  workspaceId: string;
  provider: DataProvider;
  status: "success" | "error";
  rows: number;
  error?: string;
};

export type ReportingSyncOptions = {
  admin: SupabaseClient<Database>;
  /** Restreint le passage à une seule source (bouton « Synchroniser maintenant »). */
  sourceId?: string;
  now?: Date;
};

const DAY_MS = 86_400_000;

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Fenêtre par famille, bornée à la veille : 28 jours pour le payant — Meta
 * réattribue les conversions plusieurs jours après le clic, les
 * « restatements » du cahier des charges — et 3 jours pour l'organique, dont
 * les valeurs bougent encore 24 à 48 h après (latence des insights).
 */
export function syncWindowFor(provider: DataProvider, now: Date): SyncWindow {
  const yesterday = new Date(now.getTime() - DAY_MS);
  const depth = ADS_PROVIDERS.includes(provider) ? 28 : 3;
  const from = new Date(yesterday.getTime() - (depth - 1) * DAY_MS);
  return { from: isoDay(from), to: isoDay(yesterday) };
}

/**
 * Parcourt les sources actives et fait tourner leur connecteur, une par une —
 * les régies limitent le débit, pas nous. Chaque passage est journalisé dans
 * `sync_runs`, et chaque `error` Supabase est testé : une table absente doit
 * faire du rouge, pas un « rien à faire » rassurant (règle des crons).
 */
export async function runReportingSync(
  options: ReportingSyncOptions,
): Promise<ReportingSyncStep[]> {
  const { admin } = options;
  const now = options.now ?? new Date();
  const steps: ReportingSyncStep[] = [];

  let query = admin
    .from("data_sources")
    .select("*")
    .neq("status", "disabled")
    .order("created_at");
  if (options.sourceId) query = query.eq("id", options.sourceId);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Lecture des sources : ${error.message}`);
  }

  const sources = (data ?? []) as unknown as DataSource[];

  for (const source of sources) {
    const window = syncWindowFor(source.provider, now);
    const step: ReportingSyncStep = {
      sourceId: source.id,
      workspaceId: source.workspace_id,
      provider: source.provider,
      status: "success",
      rows: 0,
    };

    const { data: run, error: runError } = await admin
      .from("sync_runs")
      .insert({
        data_source_id: source.id,
        workspace_id: source.workspace_id,
        status: "running",
        date_from: window.from,
        date_to: window.to,
      })
      .select("id")
      .single();
    if (runError) {
      step.status = "error";
      step.error = `Journal sync_runs : ${runError.message}`;
      steps.push(step);
      continue;
    }

    const connector = getConnector(source.provider);
    if (!connector) {
      step.status = "error";
      step.error = `Connecteur « ${source.provider} » pas encore implémenté.`;
    } else {
      try {
        const report = await connector.sync({ source, window, admin });
        step.rows = report.rows;
        if (report.warnings.length > 0) {
          step.error = report.warnings.join(" · ");
        }
      } catch (cause) {
        step.status = "error";
        step.error = cause instanceof Error ? cause.message : String(cause);
      }
    }

    const finishedAt = new Date().toISOString();
    const { error: closeError } = await admin
      .from("sync_runs")
      .update({
        status: step.status,
        finished_at: finishedAt,
        rows_ingested: step.rows,
        error: step.error ?? null,
      })
      .eq("id", run.id);
    if (closeError) {
      step.status = "error";
      step.error = `${step.error ? `${step.error} · ` : ""}Clôture sync_runs : ${closeError.message}`;
    }

    const { error: sourceError } = await admin
      .from("data_sources")
      .update(
        step.status === "success"
          ? { status: "connected", last_sync_at: finishedAt, last_error: null }
          : { status: "error", last_error: step.error ?? "Erreur inconnue" },
      )
      .eq("id", source.id);
    if (sourceError) {
      step.status = "error";
      step.error = `${step.error ? `${step.error} · ` : ""}État de la source : ${sourceError.message}`;
    }

    steps.push(step);
  }

  return steps;
}
