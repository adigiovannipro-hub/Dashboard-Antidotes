import { RunStatusPill } from "@/components/antidotes/campaign-launch";
import { RunFunnel } from "@/components/antidotes/run-funnel";
import { PanelRows } from "@/components/ds/surface";
import { formatDateTime } from "@/lib/antidotes/dates";
import type { CampaignRun } from "@/lib/antidotes/types";

/**
 * L'historique des passages d'une campagne, le plus récent en tête : son
 * état, son taux de survie, ses erreurs repliées derrière un `<details>`
 * natif — on ne les ouvre que quand une marche a fondu.
 */
export function CampaignRuns({ runs }: { runs: CampaignRun[] }) {
  return (
    <PanelRows>
      {runs.map((run) => (
        <div key={run.id} className="space-y-3 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <RunStatusPill run={run} />
            <span className="type-caption text-text-secondary tabular-nums">
              {formatDateTime(run.started_at ?? run.requested_at)}
            </span>
            {run.errors.length > 0 ? (
              <span className="type-caption text-warning-ink">
                {run.errors.length} erreur{run.errors.length > 1 ? "s" : ""}
              </span>
            ) : null}
          </div>
          <RunFunnel stats={run.stats} compact />
          {run.errors.length > 0 ? (
            <details className="disclosure">
              <summary className="type-caption cursor-pointer text-text-secondary">Détail des erreurs</summary>
              <ul className="type-caption mt-2 space-y-1 text-text-secondary">
                {run.errors.slice(0, 20).map((error, index) => (
                  <li key={`${error.at}-${index}`}>
                    <span className="font-medium text-text-primary">{error.step}</span>
                    {error.prospect ? ` · ${error.prospect}` : ""} — {error.message}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ))}
    </PanelRows>
  );
}
