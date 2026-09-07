"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { toast } from "sonner";

import { launchCampaign } from "@/app/actions/antidotes-sourcing";
import { PendingLabel } from "@/components/ds/pending-label";
import { StatusPill, type StatusTone } from "@/components/ds/status-pill";
import { Button } from "@/components/ui/button";
import { relativeDays } from "@/lib/antidotes/dates";
import {
  RUN_STAGE_LABELS,
  RUN_STATUS_LABELS,
  type CampaignRun,
} from "@/lib/antidotes/types";

const TONES: Record<CampaignRun["status"], StatusTone> = {
  queued: "info",
  running: "warning",
  done: "positive",
  error: "danger",
};

/** L'état du dernier passage, en pastille. */
export function RunStatusPill({ run }: { run: CampaignRun | null }) {
  if (!run) return <StatusPill tone="neutral">Jamais lancée</StatusPill>;
  const label =
    run.status === "running"
      ? `${RUN_STATUS_LABELS.running} · ${RUN_STAGE_LABELS[run.stage]}`
      : RUN_STATUS_LABELS[run.status];
  return <StatusPill tone={TONES[run.status]}>{label}</StatusPill>;
}

/**
 * « Lancer » — pose un passage en file et donne l'ordre à GitHub. Tant que le
 * passage tourne, la page se relit d'elle-même toutes les quinze secondes :
 * le passage écrit son avancement dans sa ligne, et c'est elle qu'on lit.
 */
export function CampaignLaunch({
  campaignId,
  latestRun,
  missing,
  size = "sm",
}: {
  campaignId: string;
  latestRun: CampaignRun | null;
  /** Ce qui manque à la campagne pour partir ; vide, elle peut. */
  missing: string[];
  size?: "sm" | "default";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const active = latestRun !== null && (latestRun.status === "queued" || latestRun.status === "running");

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), 15_000);
    return () => clearInterval(timer);
  }, [active, router]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <RunStatusPill run={latestRun} />
      {latestRun?.finished_at ? (
        <span className="type-caption text-text-secondary">{relativeDays(latestRun.finished_at)}</span>
      ) : null}
      <Button
        type="button"
        size={size}
        variant={active ? "outline" : "default"}
        disabled={pending || active || missing.length > 0}
        title={missing.length > 0 ? `Il manque ${missing.join(" et ")}.` : undefined}
        onClick={() =>
          startTransition(async () => {
            const result = await launchCampaign({ campaignId });
            if (result.ok) {
              toast.success(result.message ?? "Passage lancé.");
              router.refresh();
            } else {
              toast.error(result.error);
            }
          })
        }
      >
        <Play aria-hidden />
        <PendingLabel pending={pending} busy="Lancement…">
          {active ? "En cours" : "Lancer"}
        </PendingLabel>
      </Button>
    </div>
  );
}
