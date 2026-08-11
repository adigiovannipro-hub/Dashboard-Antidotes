"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FileText, Gauge, History, Layers, Lock, Quote, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { proposeRegeneration, restoreVersion } from "@/app/actions/context";
import { StatCard, StatGrid } from "@/components/ds/stat-card";
import { StatusPill } from "@/components/ds/status-pill";
import { SectionHeader } from "@/components/ds/surface";
import { Button } from "@/components/ui/button";
import type { ContextFieldDiff } from "@/lib/context/diff";
import { INJECTED_CONTEXT_TOKEN_LIMIT } from "@/lib/context/token-estimate";
import type { ClientAsset, ClientContext, ContextProposal } from "@/lib/context/types";
import { formatDayFr } from "@/lib/format";
import { formatValue } from "@/lib/format";

import { BriefGrid } from "./brief-grid";
import { DiffView } from "./diff-view";
import { DocumentsPanel } from "./documents-panel";

type VersionSummary = Pick<ClientContext, "id" | "version" | "is_active" | "created_at">;

/**
 * L'écran Contexte : en-tête interne, bande de mesures, brief éditorial en
 * grille inégale, diff de régénération, documents. Tout ce qui s'y voit est
 * réservé à l'owner — la page a déjà rendu 404 à quiconque d'autre.
 */
export function ContexteScreen({
  workspaceSlug,
  workspaceName,
  active,
  viewed,
  versions,
  assets,
  downloads,
  tokenEstimate,
  accrochesCount,
}: {
  workspaceSlug: string;
  workspaceName: string;
  active: ClientContext | null;
  /** Version consultée en lecture seule, quand elle diffère de l'active. */
  viewed: ClientContext | null;
  versions: VersionSummary[];
  assets: ClientAsset[];
  downloads: Record<string, string>;
  tokenEstimate: number;
  accrochesCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [regenPending, startRegen] = useTransition();
  const [restorePending, startRestore] = useTransition();
  const [proposal, setProposal] = useState<{
    proposal: ContextProposal;
    diff: ContextFieldDiff[];
  } | null>(null);
  // « Modifier » ne change pas le comportement — chaque carte s'édite déjà au
  // clic — il rend l'affordance visible : contours et crayons sur les cartes.
  const [editHint, setEditHint] = useState(false);

  const shown = viewed ?? active;
  const readOnly = viewed !== null;

  const includedCount = useMemo(
    () => assets.filter((asset) => asset.include_in_context && asset.summary).length,
    [assets],
  );

  // Tant qu'une analyse tourne, la page se rafraîchit toute seule : le spinner
  // de la liste devient un résumé sans que l'utilisateur recharge.
  const analyzing = assets.some(
    (asset) => asset.extraction_status === "pending" || asset.extraction_status === "running",
  );
  useEffect(() => {
    if (!analyzing) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [analyzing, router]);

  const overBudget = tokenEstimate > INJECTED_CONTEXT_TOKEN_LIMIT;

  function regenerate() {
    startRegen(async () => {
      const outcome = await proposeRegeneration({ workspace: workspaceSlug });
      if (!outcome.ok) {
        toast.error(outcome.error);
        return;
      }
      if (!outcome.diff.some((entry) => entry.changed)) {
        toast.info("La proposition ne change rien au brief actuel.");
        return;
      }
      setProposal({ proposal: outcome.proposal, diff: outcome.diff });
    });
  }

  function restore(version: number) {
    startRestore(async () => {
      const outcome = await restoreVersion({ workspace: workspaceSlug }, { version });
      if (!outcome.ok) {
        toast.error(outcome.error);
        return;
      }
      toast.success(outcome.message ?? "Version restaurée.");
      router.push(pathname);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Contexte"
        description="Invisible côté client. Alimente les générations IA."
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <StatusPill tone="warning" dot={false}>
              <Lock aria-hidden strokeWidth={1.75} className="size-3" />
              Interne
            </StatusPill>
            {versions.length > 0 ? (
              <select
                aria-label="Consulter une version"
                className="focus-visible:ring-ring h-8 rounded-md border border-border bg-surface px-2 type-caption text-text-primary focus-visible:ring-2 focus-visible:outline-none"
                value={String(viewed?.version ?? active?.version ?? "")}
                onChange={(event) => {
                  const version = Number(event.target.value);
                  const isActive = version === active?.version;
                  router.push(isActive ? pathname : `${pathname}?version=${version}`);
                }}
              >
                {versions.map((entry) => (
                  <option key={entry.id} value={entry.version}>
                    {entry.is_active
                      ? `Version ${entry.version} (active)`
                      : `Version ${entry.version} (${formatDayFr(entry.created_at.slice(0, 10))})`}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        }
      />

      <StatGrid>
        <StatCard
          icon={Layers}
          label="Version active"
          value={active ? `v${active.version}` : "—"}
          context={
            active
              ? `créée le ${formatDayFr(active.created_at.slice(0, 10))}`
              : "aucun brief pour le moment"
          }
        />
        <StatCard
          icon={Gauge}
          label="Contexte injecté"
          value={
            tokenEstimate > 0 ? `≈ ${formatValue(tokenEstimate, "integer")} tokens` : "—"
          }
          valueTone={overBudget ? "warning" : undefined}
          context={
            overBudget
              ? "au-delà des 6 000 conseillés : décocher des documents"
              : "plafond conseillé : 6 000 tokens"
          }
        />
        <StatCard
          icon={FileText}
          label="Documents injectés"
          value={formatValue(includedCount, "integer")}
          context={`sur ${formatValue(assets.length, "integer")} déposés pour ${workspaceName}`}
        />
        <StatCard
          icon={Quote}
          label="Accroches mémorisées"
          value={formatValue(accrochesCount, "integer")}
          context="jamais recyclées par la génération"
        />
      </StatGrid>

      {readOnly && viewed ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-info bg-info-subtle px-5 py-3">
          <p className="type-caption text-info-ink">
            <History aria-hidden strokeWidth={1.75} className="mr-1.5 inline size-3.5" />
            Version {viewed.version} du {formatDayFr(viewed.created_at.slice(0, 10))}, en
            lecture seule. La version active reste v{active?.version ?? "—"}.
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={restorePending}
              onClick={() => restore(viewed.version)}
            >
              Restaurer cette version
            </Button>
            <Button size="sm" variant="ghost" onClick={() => router.push(pathname)}>
              Revenir à l&apos;actif
            </Button>
          </div>
        </div>
      ) : null}

      <BriefGrid
        workspaceSlug={workspaceSlug}
        context={shown}
        readOnly={readOnly}
        editHint={editHint}
      />

      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            aria-pressed={editHint}
            onClick={() => setEditHint((current) => !current)}
          >
            Modifier
          </Button>
          <Button
            variant="default"
            disabled={regenPending}
            onClick={regenerate}
            data-icon="inline-start"
          >
            <RefreshCw
              aria-hidden
              strokeWidth={1.75}
              className={regenPending ? "animate-spin" : undefined}
            />
            {regenPending ? "Consolidation en cours…" : "Régénérer depuis les documents"}
          </Button>
          <p className="type-caption text-text-secondary">
            Chaque carte s&apos;édite d&apos;un clic et s&apos;enregistre en quittant le
            champ. La régénération se valide champ par champ, rien n&apos;est écrasé sans
            accord.
          </p>
        </div>
      ) : null}

      {proposal && !readOnly ? (
        <DiffView
          workspaceSlug={workspaceSlug}
          diff={proposal.diff}
          proposal={proposal.proposal}
          onClose={() => setProposal(null)}
        />
      ) : null}

      <DocumentsPanel workspaceSlug={workspaceSlug} assets={assets} downloads={downloads} />
    </div>
  );
}
