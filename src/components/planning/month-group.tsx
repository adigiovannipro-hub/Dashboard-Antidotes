"use client";

import { useState } from "react";
import { ChevronRight, Plus, Trash2 } from "lucide-react";

import { createLane, deleteMonth, renameMonth } from "@/app/actions/planning";
import { TextCell, useCellAction } from "@/components/planning/cells";
import { LaneTable, type DateSort } from "@/components/planning/lane-table";
import type { Scope } from "@/components/planning/subject-row";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ColumnDef } from "@/lib/planning/columns";
import {
  PLATFORM_LABELS,
  PLATFORM_ORDER,
  totalSponsoring,
} from "@/lib/planning/types";
import type { MonthWithLanes, PlanningOwner } from "@/lib/planning/types";
import { cn } from "@/lib/utils";

/**
 * Un mois du planning — un bloc à part entière, nettement détaché des autres.
 *
 * Replié, il reste une carte qui résume son contenu : nombre de publications
 * et budget de sponsorisation, sans avoir à l'ouvrir.
 */
export function MonthGroup({
  scope,
  month,
  columns,
  owners,
  objectives,
  sort,
  onSortToggle,
  selectedIds,
  onToggleSelect,
  onToggleLane,
  onOpenSubject,
  defaultOpen,
}: {
  scope: Scope;
  month: MonthWithLanes;
  columns: ColumnDef[];
  owners: PlanningOwner[];
  objectives: string[];
  sort: DateSort;
  onSortToggle: () => void;
  selectedIds: Set<string>;
  onToggleSelect: (subjectId: string) => void;
  onToggleLane: (subjectIds: string[], selected: boolean) => void;
  onOpenSubject: (subjectId: string) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { run, pending } = useCellAction();

  const subjects = month.lanes.flatMap((lane) => lane.subjects);
  const live = subjects.filter((subject) => subject.status !== "dropped");
  const sponsoring = totalSponsoring(subjects);
  const usedPlatforms = new Set(month.lanes.map((lane) => lane.platform));

  return (
    <section
      aria-label={month.label}
      className="overflow-hidden rounded-xl border border-border"
    >
      <header
        className={cn(
          "flex items-center gap-2 px-3 py-2.5 transition-colors",
          // Un mois ouvert se détache du fond : c'est celui qu'on lit.
          open ? "bg-surface-sunken" : "hover:bg-muted/40",
        )}
      >
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

        {/* Repère neutre, et non plus le rouge de marque : un mois n'est ni un
            retard ni une alerte, et la couleur d'état ne sert qu'à ça. */}
        <span aria-hidden className="bg-border-strong h-5 w-1 rounded-pill" />

        <div className="w-44">
          <TextCell
            value={month.label}
            ariaLabel="Nom du mois"
            className="text-text-primary text-sm font-semibold tracking-wide uppercase"
            onCommit={(next) =>
              run(() => renameMonth(scope, { monthId: month.id, label: next }))
            }
          />
        </div>

        <span className="text-muted-foreground text-xs tabular-nums">
          {live.length} publication{live.length > 1 ? "s" : ""}
        </span>

        {sponsoring > 0 ? (
          <span className="text-muted-foreground text-xs tabular-nums">
            ·{" "}
            {new Intl.NumberFormat("fr-FR", {
              style: "currency",
              currency: "EUR",
              maximumFractionDigits: 0,
            }).format(sponsoring)}{" "}
            de sponso
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
            className="text-muted-foreground hover:text-danger-ink focus-visible:ring-ring rounded p-1 focus-visible:ring-2 focus-visible:outline-none"
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        </div>
      </header>

      {open ? (
        <div className="space-y-3 border-t border-border p-3">
          {month.lanes.length === 0 ? (
            <p className="type-caption rounded-md border border-dashed border-border px-3 py-4 text-center text-text-secondary">
              Aucun réseau pour ce mois. Ajoutez-en un pour commencer à poser des
              publications.
            </p>
          ) : (
            month.lanes.map((lane) => (
              <LaneTable
                key={lane.id}
                scope={scope}
                lane={lane}
                columns={columns}
                owners={owners}
                objectives={objectives}
                sort={sort}
                onSortToggle={onSortToggle}
                selectedIds={selectedIds}
                onToggleSelect={onToggleSelect}
                onToggleLane={onToggleLane}
                onOpenSubject={onOpenSubject}
              />
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}
