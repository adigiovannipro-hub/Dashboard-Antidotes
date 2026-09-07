"use client";

import { StatusPill } from "@/components/ds/status-pill";
import { relativeDays } from "@/lib/antidotes/dates";
import type { PipelineProspect } from "@/lib/antidotes/types";
import { cn } from "@/lib/utils";

/**
 * La carte d'un prospect dans le kanban : trois lignes, pas une de plus.
 * Au-delà, quarante cartes deviennent illisibles.
 *
 *   1. la société, et un badge vert si elle diffuse des publicités ;
 *   2. ville · secteur ;
 *   3. score et dernier contact, en relatif.
 *
 * Le composant ne sait rien du glisser-déposer : `PipelineBoard` l'enveloppe
 * dans le nœud draggable, et la même carte sert de fantôme pendant le
 * déplacement.
 */
export function ProspectCard({
  prospect,
  className,
  overlay,
}: {
  prospect: PipelineProspect;
  className?: string;
  /** Le fantôme qui suit le pointeur : une ombre plus haute, rien d'autre. */
  overlay?: boolean;
}) {
  const place = [prospect.city, prospect.sector].filter(Boolean).join(" · ");

  return (
    <div
      className={cn(
        "rounded-md border border-border bg-surface p-3 text-left shadow-card transition-[border-color,box-shadow] duration-(--motion-duration) ease-standard",
        overlay && "border-border-strong shadow-card-hover",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="type-label min-w-0 truncate text-text-primary">
          {prospect.company_name}
        </p>
        {prospect.ads_active ? <StatusPill tone="positive">Pubs</StatusPill> : null}
      </div>
      <p className="type-caption mt-1 truncate text-text-secondary">{place || "—"}</p>
      <p className="type-caption mt-1.5 flex items-center gap-1.5 text-text-secondary tabular-nums">
        <span className="font-medium text-text-primary">Score {prospect.score}</span>
        <span aria-hidden>·</span>
        <span>
          {prospect.last_contact_at
            ? relativeDays(prospect.last_contact_at)
            : "pas encore contacté"}
        </span>
      </p>
    </div>
  );
}
