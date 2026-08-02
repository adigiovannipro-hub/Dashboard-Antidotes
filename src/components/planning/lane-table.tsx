"use client";

import { useState } from "react";
import { ChevronRight, Plus, Trash2 } from "lucide-react";

import { createSubject, deleteLane, renameLane } from "@/app/actions/planning";
import { TextCell, useCellAction } from "@/components/planning/cells";
import {
  ROW_GRID,
  SubjectRowView,
  type Scope,
} from "@/components/planning/subject-row";
import type { LaneWithSubjects, PlanningOwner } from "@/lib/planning/types";
import { totalSponsoring } from "@/lib/planning/types";
import { cn } from "@/lib/utils";

/**
 * Un couloir : le réseau social, et ses publications.
 *
 * L'en-tête de colonnes est répété par couloir plutôt qu'une fois par mois.
 * C'est ce que fait le board d'origine, et sur un mois à quatre réseaux, ça
 * évite de remonter pour savoir quelle colonne on est en train de lire.
 */
export function LaneTable({
  scope,
  lane,
  owners,
  objectives,
  flagged,
}: {
  scope: Scope;
  lane: LaneWithSubjects;
  owners: PlanningOwner[];
  objectives: string[];
  flagged: Set<string>;
}) {
  const [open, setOpen] = useState(true);
  const { run, pending } = useCellAction();

  const live = lane.subjects.filter((subject) => subject.status !== "dropped");
  const sponsoring = totalSponsoring(lane.subjects);

  return (
    <section className="border-border/60 rounded-md border" aria-label={lane.name}>
      <header className="bg-card/60 flex items-center gap-2 rounded-t-md px-2 py-1.5">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={open ? `Replier ${lane.name}` : `Déplier ${lane.name}`}
          className="hover:bg-muted focus-visible:ring-ring rounded p-0.5 focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronRight
            className={cn("size-3.5 transition-transform", open && "rotate-90")}
            aria-hidden
          />
        </button>

        <div className="w-40">
          <TextCell
            value={lane.name}
            ariaLabel="Nom du réseau"
            className="text-xs font-semibold tracking-wide uppercase"
            onCommit={(next) => run(() => renameLane(scope, { laneId: lane.id, name: next }))}
          />
        </div>

        <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[11px] tabular-nums">
          {live.length}
        </span>

        {sponsoring > 0 ? (
          <span className="text-muted-foreground text-xs tabular-nums">
            {new Intl.NumberFormat("fr-FR", {
              style: "currency",
              currency: "EUR",
              maximumFractionDigits: 2,
            }).format(sponsoring)}
          </span>
        ) : null}

        <button
          type="button"
          onClick={() => run(() => deleteLane(scope, { laneId: lane.id }))}
          aria-label={`Supprimer le réseau ${lane.name}`}
          className="text-muted-foreground hover:text-brand-red focus-visible:ring-ring ml-auto rounded p-1 focus-visible:ring-2 focus-visible:outline-none"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      </header>

      {open ? (
        <>
          <div
            className={cn(
              "border-border/60 text-muted-foreground border-b px-2 py-1 text-[10px] font-medium tracking-wide uppercase",
              ROW_GRID,
            )}
          >
            <span className="px-1.5">Sujet</span>
            <span className="sr-only">Retours</span>
            <span className="sr-only">Propriétaire</span>
            <span className="text-center">Statut</span>
            <span className="text-center">Type</span>
            <span className="px-1.5">Date</span>
            <span className="text-center">Visuel</span>
            <span className="px-1.5">Wording</span>
            <span className="px-1.5 text-right">Sponso</span>
            <span className="px-1.5">Objectif</span>
            <span className="text-center">Ads</span>
            <span />
          </div>

          {lane.subjects.map((subject) => (
            <SubjectRowView
              key={subject.id}
              scope={scope}
              row={subject}
              owners={owners}
              objectives={objectives}
              flagged={flagged.has(subject.id)}
            />
          ))}

          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(() =>
                createSubject(scope, {
                  laneId: lane.id,
                  monthId: lane.month_id,
                  boardId: lane.board_id,
                }),
              )
            }
            className="text-muted-foreground hover:text-foreground hover:bg-muted/40 focus-visible:ring-ring flex w-full items-center gap-1.5 rounded-b-md px-3 py-1.5 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <Plus className="size-3.5" aria-hidden />
            Ajouter une publication
          </button>
        </>
      ) : null}
    </section>
  );
}
