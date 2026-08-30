import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StatusPill, type StatusTone } from "@/components/ds/status-pill";
import { Panel, PanelHeader, SectionHeader } from "@/components/ds/surface";
import { getViewer } from "@/lib/auth";
import { readWorkflowState } from "@/lib/finance/github-actions";
import { CHANNEL_LABELS, type ModerationChannel } from "@/lib/moderation/types";
import { createAdminClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "État des synchronisations" };
export const dynamic = "force-dynamic";

/**
 * L'âge réel de chaque donnée, en un écran — le témoin interne.
 *
 * La sobriété d'interface a sorti la mécanique des écrans clients : elle vit
 * ici, chez le propriétaire. Le piège n°1 documenté du projet est le cron
 * muet pendant des semaines ; cette page le rend visible en dix secondes.
 * Lecture en admin : vue d'exploitation transverse, après la garde owner.
 */

/** Au-delà, une source se dit en retard — deux passages horaires manqués. */
const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

const PROVIDER_LABELS: Record<string, string> = {
  meta_ads: "Meta Ads",
  meta_organic: "Meta organique",
  google_analytics: "Site Web",
};

function ageOf(iso: string | null): { label: string; stale: boolean } {
  if (!iso) return { label: "jamais", stale: true };
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  const stale = minutes * 60_000 > STALE_AFTER_MS;
  if (minutes < 1) return { label: "à l'instant", stale };
  if (minutes < 60) return { label: `il y a ${minutes} min`, stale };
  const hours = Math.round(minutes / 60);
  if (hours < 48) return { label: `il y a ${hours} h`, stale };
  return { label: `il y a ${Math.round(hours / 24)} j`, stale };
}

type SourceRow = {
  name: string;
  detail: string | null;
  lastAt: string | null;
  error: string | null;
};

export default async function SyncsPage() {
  const viewer = await getViewer();
  if (!viewer?.isOwner) notFound();

  const admin = createAdminClient();

  const [
    { data: syncRuns },
    { data: connections },
    { data: workspaces },
    workflow,
  ] = await Promise.all([
    admin
      .from("sync_runs")
      .select("data_source_id, workspace_id, status, finished_at, error, started_at")
      .order("started_at", { ascending: false })
      .limit(200),
    admin
      .from("channel_connections")
      .select("channel, display_name, status, last_polled_at, last_error"),
    admin.from("workspaces").select("id, name"),
    readWorkflowState().catch(() => null),
  ]);

  // Sans le nom de la source, quatre lignes « ANMF » sont indiscernables.
  const { data: sourceRows } = await admin
    .from("data_sources")
    .select("id, provider, display_name");
  const sourcesById = new Map(
    ((sourceRows ?? []) as { id: string; provider: string; display_name: string | null }[]).map(
      (source) => [source.id, source.display_name ?? PROVIDER_LABELS[source.provider] ?? source.provider],
    ),
  );

  const workspaceNames = new Map(
    ((workspaces ?? []) as { id: string; name: string }[]).map((w) => [w.id, w.name]),
  );

  // Le dernier passage par source de données — les runs arrivent triés.
  const latestBySource = new Map<string, SourceRow>();
  for (const run of (syncRuns ?? []) as unknown as {
    data_source_id: string;
    workspace_id: string;
    status: string;
    finished_at: string | null;
    started_at: string;
    error: string | null;
  }[]) {
    if (latestBySource.has(run.data_source_id)) continue;
    latestBySource.set(run.data_source_id, {
      name: workspaceNames.get(run.workspace_id) ?? "Espace",
      detail: sourcesById.get(run.data_source_id) ?? null,
      lastAt: run.finished_at ?? run.started_at,
      error: run.error,
    });
  }

  const moderationRows = (
    (connections ?? []) as unknown as {
      channel: ModerationChannel;
      display_name: string | null;
      status: string;
      last_polled_at: string | null;
      last_error: string | null;
    }[]
  ).map(
    (connection): SourceRow => ({
      name: connection.display_name ?? CHANNEL_LABELS[connection.channel],
      detail: CHANNEL_LABELS[connection.channel],
      lastAt: connection.last_polled_at,
      error: connection.last_error,
    }),
  );

  // Le layout de la section fournit déjà le shell : la page n'en rouvre pas.
  return (
    <div className="max-w-4xl space-y-5">
      <SectionHeader title="État des synchronisations" />
        <SyncPanel
          title="Reporting — régies et web"
          rows={[...latestBySource.values()]}
          emptyMessage="Aucun passage de synchronisation enregistré."
        />
        <SyncPanel
          title="Modération — canaux relevés"
          rows={moderationRows}
          emptyMessage="Aucun canal branché."
        />
        <Panel>
          <PanelHeader title="Finance et Échéances" />
          <div className="px-5 pb-5">
            {workflow ? (
              <SyncLine
                row={{
                  name: "Workflow Airwallex",
                  detail: workflow.running ? "en cours d'exécution" : null,
                  lastAt: workflow.lastAttemptAt,
                  error: null,
                }}
              />
            ) : (
              <p className="type-body text-text-secondary">
                Lecture du workflow indisponible — GITHUB_SYNC_TOKEN absent de cet
                environnement.
              </p>
            )}
          </div>
        </Panel>
    </div>
  );
}

function SyncPanel({
  title,
  rows,
  emptyMessage,
}: {
  title: string;
  rows: SourceRow[];
  emptyMessage: string;
}) {
  return (
    <Panel>
      <PanelHeader title={title} count={rows.length} />
      <div className="px-5 pb-5">
        {rows.length === 0 ? (
          <p className="type-body text-text-secondary">{emptyMessage}</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row, index) => (
              <SyncLine key={`${row.name}-${index}`} row={row} />
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

function SyncLine({ row }: { row: SourceRow }) {
  const age = ageOf(row.lastAt);
  const tone: StatusTone = row.error ? "danger" : age.stale ? "warning" : "positive";
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
      <span className="type-label min-w-40 text-text-primary">{row.name}</span>
      {row.detail ? (
        <span className="type-caption text-text-secondary">{row.detail}</span>
      ) : null}
      <span className="ml-auto flex items-center gap-2">
        <span className="type-caption text-text-secondary tabular-nums">
          {age.label}
        </span>
        <StatusPill tone={tone}>
          {row.error ? "En erreur" : age.stale ? "En retard" : "À jour"}
        </StatusPill>
      </span>
      {row.error ? (
        <p className="type-caption w-full text-danger-ink">{row.error}</p>
      ) : null}
    </li>
  );
}
