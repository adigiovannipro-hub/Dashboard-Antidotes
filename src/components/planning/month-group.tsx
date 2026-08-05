"use client";

import { useState } from "react";
import { ChevronRight, Plus, Trash2 } from "lucide-react";

import { createLane, deleteMonth, renameMonth } from "@/app/actions/planning";
import { TextCell, useCellAction } from "@/components/planning/cells";
import { LaneTable } from "@/components/planning/lane-table";
import type { Scope } from "@/components/planning/subject-row";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PLATFORM_LABELS,
  PLATFORM_ORDER,
  totalSponsoring,
} from "@/lib/planning/types";
import type { MonthWithLanes, PlanningOwner } from "@/lib/planning/types";
import { cn } from "@/lib/utils";

/**
 * Un mois du planning : le groupe du board, avec ses couloirs.
 *
 * Le filet rouge à gauche reprend celui de Monday. Il ne porte aucune
 * information — c'est un repère visuel qui découpe l'année, et il vaut mieux
 * qu'un titre isolé quand on fait défiler douze mois.
 */
export function MonthGroup({
  scope,
  month,
  owners,
  objectives,
  flagged,
  defaultOpen,
}: {
  scope: Scope;
  month: MonthWithLanes;
  owners: PlanningOwner[];
  objectives: string[];
  flagged: Set<string>;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { run, pending } = useCellAction();

  const subjects = month.lanes.flatMap((lane) => lane.subjects);
  const live = subjects.filter((subject) => subject.status !== "dropped");
  const sponsoring = totalSponsoring(subjects);
  const empty = live.length === 0;

  const usedPlatforms = new Set(month.lanes.map((lane) => lane.platform));

  return (
    <section
      className={cn("mb-4", open && "mb-6")}
      aria-label={month.label}
    >
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={open ? `Replier ${month.label}` : `Déplier ${month.label}`}
          className="hover:bg-muted focus-visible:ring-ring rounded p-0.5 focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronRight
            className={cn("size-4 transition-transform", open && "rotate-90")}
            aria-hidden
          />
        </button>

        {/* Un mois vide reste visible — l'année entière se parcourt — mais en
            retrait : neuf « 0 publication » alignés ne sont pas une information. */}
        <span
          aria-hidden
          className={cn("bg-brand-red h-5 w-1 rounded-full", empty && !open && "opacity-30")}
        />

        <div className="w-44">
          <TextCell
            value={month.label}
            ariaLabel="Nom du mois"
            className={cn(
              "text-brand-red text-sm font-semibold tracking-wide uppercase",
              empty && !open && "text-brand-red/50",
            )}
            onCommit={(next) =>
              run(() => renameMonth(scope, { monthId: month.id, label: next }))
            }
          />
        </div>

        {empty ? null : (
          <span className="text-muted-foreground text-xs tabular-nums">
            {live.length} publication{live.length > 1 ? "s" : ""}
          </span>
        )}

        {sponsoring > 0 ? (
          <span className="text-muted-foreground text-xs tabular-nums">
            ·{" "}
            {new Intl.NumberFormat("fr-FR", {
              style: "currency",
              currency: "EUR",
              maximumFractionDigits: 0,
            }).format(sponsoring)}{" "}
            de sponsorisation
          </span>
        ) : null}

        <div className="ml-auto flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={pending}
              className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <Plus className="size-3.5" aria-hidden />
              Réseau
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 min-w-44">
              {PLATFORM_ORDER.map((platform) => (
                <DropdownMenuItem
                  key={platform}
                  onClick={() =>
                    run(() =>
                      createLane(scope, {
                        monthId: month.id,
                        boardId: month.board_id,
                        platform,
                      }),
                    )
                  }
                >
                  {PLATFORM_LABELS[platform]}
                  {usedPlatforms.has(platform) ? (
                    <span className="text-muted-foreground ml-auto text-[10px]">
                      déjà présent
                    </span>
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            onClick={() => run(() => deleteMonth(scope, { monthId: month.id }))}
            aria-label={`Supprimer le mois ${month.label}`}
            className="text-muted-foreground hover:text-brand-red focus-visible:ring-ring rounded p-1 focus-visible:ring-2 focus-visible:outline-none"
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        </div>
      </header>

      {open ? (
        <div className="mt-2 ml-6 space-y-3">
          {month.lanes.length === 0 ? (
            <p className="text-muted-foreground border-border/60 rounded-md border border-dashed px-3 py-4 text-center text-xs">
              Aucun réseau pour ce mois. Ajoutez-en un pour commencer à poser des
              publications.
            </p>
          ) : (
            month.lanes.map((lane) => (
              <LaneTable
                key={lane.id}
                scope={scope}
                lane={lane}
                owners={owners}
                objectives={objectives}
                flagged={flagged}
              />
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}
