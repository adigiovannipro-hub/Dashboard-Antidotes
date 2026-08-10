"use client";

import { useState } from "react";
import { ChevronRight, Plus, Trash2 } from "lucide-react";

import { createSubject, deleteLane, renameLane, updateColumn } from "@/app/actions/planning";
import { TextCell, useCellAction } from "@/components/planning/cells";
import { AddColumnMenu, ColumnHeaderMenu } from "@/components/planning/column-menus";
import { PlatformIcon } from "@/components/planning/platform-icon";
import { SubjectRowView, type Scope } from "@/components/planning/subject-row";
import type { ColumnDef } from "@/lib/planning/columns";
import { gridTemplate } from "@/lib/planning/columns";
import type {
  LaneWithSubjects,
  PlanningOwner,
  SubjectRow,
} from "@/lib/planning/types";
import { totalSponsoring } from "@/lib/planning/types";
import { cn } from "@/lib/utils";

export type DateSort = "position" | "asc" | "desc";

/**
 * Un couloir : le réseau social et ses publications, sous un en-tête de
 * colonnes vivant — chaque titre est un menu, le « + » du bout ajoute une
 * colonne, la coche de tête sélectionne le couloir entier.
 */
export function LaneTable({
  scope,
  lane,
  columns,
  owners,
  sort,
  onSortToggle,
  selectedIds,
  onToggleSelect,
  onToggleLane,
  onOpenSubject,
  onResizePreview,
}: {
  scope: Scope;
  lane: LaneWithSubjects;
  columns: ColumnDef[];
  owners: PlanningOwner[];
  sort: DateSort;
  onSortToggle: () => void;
  selectedIds: Set<string>;
  onToggleSelect: (subjectId: string) => void;
  onToggleLane: (subjectIds: string[], selected: boolean) => void;
  onOpenSubject: (subjectId: string) => void;
  /** Largeur en cours de drag, avant l'écriture en base. */
  onResizePreview: (columnId: string, width: number | null) => void;
}) {
  const [open, setOpen] = useState(true);
  const { run, pending } = useCellAction();

  const template = gridTemplate(columns);
  const subjects = sortSubjects(lane.subjects, sort);
  const live = subjects.filter((subject) => subject.status !== "dropped");
  const sponsoring = totalSponsoring(subjects);

  const allSelected =
    subjects.length > 0 && subjects.every((subject) => selectedIds.has(subject.id));

  return (
    <section
      className="overflow-hidden rounded-md border border-border bg-background"
      aria-label={lane.name}
    >
      <header className="flex items-center gap-2 bg-surface-sunken px-2 py-1.5">
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

        <PlatformIcon platform={lane.platform} />

        <div className="w-40">
          <TextCell
            value={lane.name}
            ariaLabel="Nom du réseau"
            className="text-xs font-semibold tracking-wide uppercase"
            onCommit={(next) =>
              run(() => renameLane(scope, { laneId: lane.id, name: next }))
            }
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
          className="text-muted-foreground hover:text-danger-ink focus-visible:ring-ring ml-auto rounded p-1 focus-visible:ring-2 focus-visible:outline-none"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      </header>

      {open ? (
        // Le tableau déborde à droite plutôt que d'écraser ses colonnes : le
        // conteneur défile, la page ne bouge pas.
        <div className="overflow-x-auto">
          <div className="min-w-fit">
            <div
              className="border-border bg-surface-sunken/60 grid items-center gap-x-1 border-b px-2 py-1"
              style={{ gridTemplateColumns: template }}
            >
              <span className="flex justify-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  aria-label={`Sélectionner tout ${lane.name}`}
                  onChange={() =>
                    onToggleLane(
                      subjects.map((subject) => subject.id),
                      !allSelected,
                    )
                  }
                  className="accent-brand size-3.5"
                />
              </span>

              {columns.map((column) => (
                <HeaderCell
                  key={column.id}
                  scope={scope}
                  column={column}
                  sort={sort}
                  onSortToggle={onSortToggle}
                  onResizePreview={onResizePreview}
                />
              ))}

              <AddColumnMenu scope={scope} boardId={lane.board_id} />
            </div>

            {subjects.map((subject) => (
              <SubjectRowView
                key={subject.id}
                scope={scope}
                row={subject}
                columns={columns}
                gridTemplate={template}
                owners={owners}
                selected={selectedIds.has(subject.id)}
                bulkTargets={
                  selectedIds.has(subject.id) ? [...selectedIds] : null
                }
                onToggleSelect={onToggleSelect}
                onOpen={onOpenSubject}
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
              className="text-muted-foreground hover:text-foreground hover:bg-muted/40 focus-visible:ring-ring flex w-full items-center gap-1.5 px-3 py-1.5 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <Plus className="size-3.5" aria-hidden />
              Ajouter une publication
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function HeaderCell({
  scope,
  column,
  sort,
  onSortToggle,
  onResizePreview,
}: {
  scope: Scope;
  column: ColumnDef;
  sort: DateSort;
  onSortToggle: () => void;
  onResizePreview: (columnId: string, width: number | null) => void;
}) {
  const { run } = useCellAction();
  const isDate = column.builtin === "date";

  const menu = (
    <ColumnHeaderMenu
      scope={scope}
      column={column}
      onSortToggle={isDate ? onSortToggle : undefined}
      sorted={isDate && sort !== "position" ? sort : null}
    />
  );

  /**
   * La poignée de redimensionnement, au bord droit de l'en-tête.
   *
   * Pendant le drag, la largeur vit en local (onResizePreview) pour suivre le
   * pointeur sans aller-retour ; au relâchement, elle s'écrit en base et vaut
   * pour tout le monde.
   */
  const startResize = (event: React.PointerEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const cell = (event.currentTarget as HTMLElement).closest("[data-col]");
    const startWidth = cell ? cell.getBoundingClientRect().width : 120;
    let latest = Math.round(startWidth);

    const onMove = (move: PointerEvent) => {
      latest = Math.min(900, Math.max(60, Math.round(startWidth + move.clientX - startX)));
      onResizePreview(column.id, latest);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      run(() =>
        updateColumn(scope, { columnId: column.id, patch: { width: latest } }),
      );
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handle = (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={`Redimensionner la colonne ${column.label}`}
      title="Redimensionner la colonne"
      onPointerDown={startResize}
      className="hover:bg-brand absolute inset-y-0 -right-1 w-2 cursor-col-resize rounded opacity-0 transition-opacity hover:opacity-100"
    />
  );

  // La piste des retours suit celle du sujet : une cellule d'en-tête muette.
  if (column.builtin === "name") {
    return (
      <>
        <span data-col className="text-muted-foreground relative min-w-0">
          {menu}
          {handle}
        </span>
        <span aria-hidden />
      </>
    );
  }

  return (
    <span data-col className="text-muted-foreground relative min-w-0">
      {menu}
      {handle}
    </span>
  );
}

/**
 * Le tri de la colonne Date.
 *
 * `position` est l'ordre du tableau — celui dans lequel les lignes ont été
 * posées. Le tri par date range les publications datées et repousse les sans
 * date en fin, où on les retrouve au lieu de les perdre.
 */
function sortSubjects(subjects: SubjectRow[], sort: DateSort): SubjectRow[] {
  if (sort === "position") return subjects;

  return [...subjects].sort((a, b) => {
    if (a.scheduled_on === b.scheduled_on) return a.position - b.position;
    if (a.scheduled_on === null) return 1;
    if (b.scheduled_on === null) return -1;
    const compare = a.scheduled_on.localeCompare(b.scheduled_on);
    return sort === "asc" ? compare : -compare;
  });
}
