"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarCheck, FileText, Gauge, History, Lock, Quote, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { proposeRegeneration, restoreVersion } from "@/app/actions/context";
import { safeAction } from "@/lib/context/safe-action";
import { PendingLabel } from "@/components/ds/pending-label";
import { StatCard, StatGrid } from "@/components/ds/stat-card";
import { StatusPill } from "@/components/ds/status-pill";
import { Button } from "@/components/ui/button";
import {
  normalizeDeliverables,
  summarizeDeliverables,
  totalPublications,
} from "@/lib/context/deliverables";
import type { ContextFieldDiff } from "@/lib/context/diff";
import { INJECTED_CONTEXT_TOKEN_LIMIT } from "@/lib/context/token-estimate";
import type { ClientAsset, ClientContext, ContextProposal } from "@/lib/context/types";
import { formatDayFr, formatValue } from "@/lib/format";

import { BriefGrid } from "./brief-grid";
import { DiffView } from "./diff-view";
import { DocumentsPanel } from "./documents-panel";
import { VersionHistory } from "./version-history";

type VersionSummary = Pick<ClientContext, "id" | "version" | "is_active" | "created_at">;

/**
 * L'écran Contexte : bande de mesures, brief éditorial en trois familles,
 * diff de régénération, documents, historique des versions. Tout ce qui s'y
 * voit est réservé à l'owner — la page a déjà rendu 404 à quiconque d'autre.
 *
 * Aucun titre de page ici : l'onglet de navigation dit déjà « Contexte » et
 * le cadre porte le nom de l'espace. Le répéter le ferait lire trois fois.
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

  // La bande de mesures décrit toujours l'état en vigueur, même en consultant
  // une version passée : c'est le brief actif qui part dans les générations.
  const deliverables = useMemo(
    () => normalizeDeliverables(active?.deliverables),
    [active?.deliverables],
  );
  const publicationsPerMonth = totalPublications(deliverables);

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
      const outcome = await safeAction(() =>
        proposeRegeneration({ workspace: workspaceSlug }),
      );
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
      const outcome = await safeAction(() =>
        restoreVersion({ workspace: workspaceSlug }, { version }),
      );
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone="warning" dot={false}>
              <Lock aria-hidden strokeWidth={1.75} className="size-3" />
              Interne
            </StatusPill>
            {active ? (
              <p className="type-caption text-text-secondary">
                Brief mis à jour le {formatDayFr(active.created_at.slice(0, 10))}.
              </p>
            ) : null}
          </div>
        </div>

        {!readOnly ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
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
              {/* Sans témoin propre : la flèche à gauche tourne déjà. */}
              <PendingLabel
                pending={regenPending}
                busy="Consolidation en cours…"
                spinner={false}
              >
                Régénérer depuis les documents
              </PendingLabel>
            </Button>
          </div>
        ) : null}
      </div>

      <StatGrid>
        <StatCard
          icon={CalendarCheck}
          label="Publications par mois"
          value={
            publicationsPerMonth > 0 ? formatValue(publicationsPerMonth, "integer") : "—"
          }
          context={
            publicationsPerMonth > 0
              ? summarizeDeliverables(deliverables)
              : "livrables mensuels à renseigner"
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

      {proposal && !readOnly ? (
        <DiffView
          workspaceSlug={workspaceSlug}
          diff={proposal.diff}
          proposal={proposal.proposal}
          onClose={() => setProposal(null)}
        />
      ) : null}

      <DocumentsPanel workspaceSlug={workspaceSlug} assets={assets} downloads={downloads} />

      <VersionHistory
        versions={versions}
        activeVersion={active?.version ?? null}
        viewedVersion={viewed?.version ?? null}
        restorePending={restorePending}
        onRestore={restore}
      />
    </div>
  );
}
