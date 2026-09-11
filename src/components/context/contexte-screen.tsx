"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { History, Lock, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { proposeRegeneration, restoreVersion } from "@/app/actions/context";
import { safeAction } from "@/lib/context/safe-action";
import { PendingLabel } from "@/components/ds/pending-label";
import { StatusPill } from "@/components/ds/status-pill";
import { Button } from "@/components/ui/button";
import type { Completeness } from "@/lib/context/completeness";
import type { ContextFieldDiff } from "@/lib/context/diff";
import type { ContextSection } from "@/lib/context/injected-context";
import { totalContextTokens } from "@/lib/context/injected-context";
import type {
  ClientAsset,
  ClientContext,
  ClientGenerationSettings,
  ContextProposal,
} from "@/lib/context/types";
import { formatDayFr } from "@/lib/format";

import { BriefGrid } from "./brief-grid";
import { CompletenessBar } from "./completeness-bar";
import { DiffView } from "./diff-view";
import { DocumentsPanel } from "./documents-panel";
import { InjectedPromptDialog } from "./injected-prompt-dialog";
import { PilotagePanel } from "./pilotage-panel";
import { VersionHistory } from "./version-history";

type VersionSummary = Pick<ClientContext, "id" | "version" | "is_active" | "created_at">;

/**
 * L'écran Contexte : barre de complétude, brief en trois familles repliables,
 * pilotage de la génération, documents. Tout ce qui s'y voit est réservé à
 * l'owner — la page a déjà rendu 404 à quiconque d'autre.
 *
 * Aucun titre de page ici : l'onglet de navigation dit déjà « Contexte » et
 * le cadre porte le nom de l'espace. Le répéter le ferait lire trois fois.
 */
export function ContexteScreen({
  workspaceSlug,
  active,
  viewed,
  versions,
  assets,
  downloads,
  settings,
  sections,
  targetMonth,
  targetMonthLabel,
  completeness,
  accrochesCount,
}: {
  workspaceSlug: string;
  active: ClientContext | null;
  /** Version consultée en lecture seule, quand elle diffère de l'active. */
  viewed: ClientContext | null;
  versions: VersionSummary[];
  assets: ClientAsset[];
  downloads: Record<string, string>;
  settings: ClientGenerationSettings | null;
  /** Les sections servies au modèle, produites par la même fonction que lui. */
  sections: ContextSection[];
  targetMonth: string;
  /** « octobre » : le mois que la prochaine génération vise. */
  targetMonthLabel: string;
  completeness: Completeness;
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

  const shown = viewed ?? active;
  const readOnly = viewed !== null;

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

        {!readOnly ? (
          // Pas de `shrink-0` ici : sur un téléphone de 390 px, les deux
          // boutons font 460 à eux deux, et un conteneur qui refuse de
          // rétrécir est dimensionné sur son contenu — `flex-wrap` ne se
          // déclenche donc jamais et c'est la page entière qui déborde
          // (476 px mesurés). Le piège est déjà écrit dans CLAUDE.md ; il
          // coûte un retour à la ligne, pas un débordement.
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <InjectedPromptDialog
              sections={sections}
              targetMonthLabel={targetMonthLabel}
            />
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

      <CompletenessBar
        completeness={completeness}
        tokens={totalContextTokens(sections)}
      />

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

      <BriefGrid workspaceSlug={workspaceSlug} context={shown} readOnly={readOnly} />

      {proposal && !readOnly ? (
        <DiffView
          workspaceSlug={workspaceSlug}
          diff={proposal.diff}
          proposal={proposal.proposal}
          onClose={() => setProposal(null)}
        />
      ) : null}

      {/* Le pilotage n'est pas le brief : il décrit le moment, pas la marque,
          et vit dans une table non versionnée. Quatrième section, à part. */}
      {!readOnly ? (
        <PilotagePanel
          workspaceSlug={workspaceSlug}
          settings={settings}
          targetMonth={targetMonth}
          targetMonthLabel={targetMonthLabel}
        />
      ) : null}

      <DocumentsPanel workspaceSlug={workspaceSlug} assets={assets} downloads={downloads} />

      {accrochesCount > 0 ? (
        <p className="type-caption text-center text-text-secondary">
          {accrochesCount} accroche{accrochesCount > 1 ? "s" : ""} déjà publiée
          {accrochesCount > 1 ? "s" : ""}, injectée
          {accrochesCount > 1 ? "s" : ""} en négatif.
        </p>
      ) : null}

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
