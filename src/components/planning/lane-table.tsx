"use client";

import { useOptimistic, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Plus, Trash2 } from "lucide-react";

import {
  createSubject,
  deleteLane,
  moveSubject,
  renameLane,
  updateColumn,
} from "@/app/actions/planning";
import { ConfirmDialog } from "@/components/ds/confirm-dialog";
import { TextCell, useCellAction } from "@/components/planning/cells";
import { AddColumnMenu, ColumnHeaderMenu } from "@/components/planning/column-menus";
import { sortSubjects, sortableKey } from "@/lib/planning/sort";
import { PlatformIcon, platformColor } from "@/components/planning/platform-icon";
import {
  SUBJECT_DRAG_TYPE,
  SubjectRowView,
  type Scope,
} from "@/components/planning/subject-row";
import type { ColumnDef } from "@/lib/planning/columns";
import { gridTemplate } from "@/lib/planning/columns";
import type { LaneWithSubjects, PlanningOwner } from "@/lib/planning/types";
import { totalSponsoring } from "@/lib/planning/types";
import type { PlanningSort, SortableColumnKey } from "@/lib/ui-preferences";
import { cn } from "@/lib/utils";

/**
 * Un couloir : le réseau social et ses publications, sous un en-tête de
 * colonnes vivant — chaque titre est un menu, le « + » du bout ajoute une
 * colonne, la coche de tête sélectionne le couloir entier.
 *
 * C'est aussi une cible de dépôt : une ligne saisie par sa poignée s'intercale
 * entre deux lignes d'ici — qu'elle vienne de ce couloir, d'un autre réseau ou
 * d'un autre mois. L'index visé se calcule sur l'ordre affiché.
 */
export function LaneTable({
  scope,
  lane,
  columns,
  owners,
  sort,
  onSort,
  selectedIds,
  onToggleSelect,
  onToggleLane,
  onOpenSubject,
  onEditLabels,
  onResizePreview,
  defaultOpen,
  onOpenChange,
  canGenerateWording,
}: {
  scope: Scope;
  lane: LaneWithSubjects;
  columns: ColumnDef[];
  owners: PlanningOwner[];
  sort: PlanningSort;
  /** Un clic sur la flèche d'un en-tête : chrono, inverse, puis ordre manuel. */
  onSort: (column: SortableColumnKey) => void;
  selectedIds: Set<string>;
  onToggleSelect: (subjectId: string, extendRange?: boolean) => void;
  onToggleLane: (subjectIds: string[], selected: boolean) => void;
  onOpenSubject: (subjectId: string, focusRetours?: boolean) => void;
  onEditLabels: (column: ColumnDef) => void;
  /** Largeur en cours de drag, avant l'écriture en base. */
  onResizePreview: (columnId: string, width: number | null) => void;
  /** Ouvert sauf si le cookie dit le contraire. */
  defaultOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Le stylo de génération, réservé à l'agence. */
  canGenerateWording: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [dropTarget, setDropTarget] = useState<{
    subjectId: string;
    after: boolean;
  } | null>(null);
  const { run, pending } = useCellAction();
  // Lignes en cours de création : affichées par avance, résorbées d'elles-
  // mêmes quand la revalidation apporte les vraies (voir le rendu plus bas).
  const [creatingCount, showCreating] = useOptimistic(0, (count: number) => count + 1);

  const toggle = (next: boolean) => {
    setOpen(next);
    onOpenChange(next);
  };

  const template = gridTemplate(columns);
  const subjects = sortSubjects(lane.subjects, sort, columns);
  const live = subjects.filter((subject) => subject.status !== "dropped");
  const sponsoring = totalSponsoring(subjects);

  const allSelected =
    subjects.length > 0 && subjects.every((subject) => selectedIds.has(subject.id));

  /** L'index de dépôt dans le couloir, à partir de la ligne survolée. */
  const dropIndex = (subjectId: string, after: boolean) => {
    const index = subjects.findIndex((subject) => subject.id === subjectId);
    if (index === -1) return subjects.length;
    return after ? index + 1 : index;
  };

  const drop = (draggedId: string, index: number) => {
    setDropTarget(null);
    // L'index est compté sur la liste affichée, qui contient encore la ligne
    // saisie : en descendant dans son propre couloir, elle se retire d'abord.
    const from = subjects.findIndex((subject) => subject.id === draggedId);
    const adjusted = from !== -1 && from < index ? index - 1 : index;
    run(() =>
      moveSubject(scope, { subjectId: draggedId, laneId: lane.id, index: adjusted }),
    );
  };

  return (
    <section
      className="border-border-strong relative overflow-hidden rounded-md border bg-background"
      aria-label={lane.name}
      // Un liseré aux couleurs du réseau court sur toute la hauteur du
      // couloir : à trois réseaux empilés dans un mois, c'est ce qui dit d'un
      // coup d'œil où l'on se trouve, sans relire les en-têtes.
      style={{ borderLeftColor: platformColor(lane.platform), borderLeftWidth: 3 }}
    >
      {/* L'en-tête du couloir porte la couleur du réseau sur son bord gauche :
          c'est le repère qui rattache les lignes à leur plateforme, comme la
          barre de groupe de Monday.

          Il reste **blanc** alors que la ligne d'en-têtes de colonnes juste
          en dessous est grise : deux bandes grises collées formaient un bloc
          de 60 px où le nom du réseau se noyait dans « SUJET · STATUT · … ».
          Alterner surface et creux fait ressortir l'emboîtement mois → réseau
          → colonnes. */}
      <header
        className="border-border-strong bg-surface flex cursor-pointer items-center gap-2 border-b px-2 py-2"
        // Toute la barre plie et déplie le couloir, pas seulement le chevron.
        // La garde est indispensable : la barre porte le nom du réseau en
        // champ éditable et la poubelle, qu'un handler posé à l'aveugle
        // avalerait.
        onClick={(event) => {
          if (
            (event.target as HTMLElement).closest(
              "button, input, a, select, textarea, [role=menuitem]",
            )
          ) {
            return;
          }
          toggle(!open);
        }}
        onDragOver={(event) => {
          if (![...event.dataTransfer.types].includes(SUBJECT_DRAG_TYPE)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          if (!open) toggle(true);
        }}
        onDrop={(event) => {
          const draggedId = event.dataTransfer.getData(SUBJECT_DRAG_TYPE);
          if (!draggedId) return;
          event.preventDefault();
          drop(draggedId, 0);
        }}
      >
        <button
          type="button"
          onClick={() => toggle(!open)}
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

        {/* 7 rem et non 10 : le champ est un `input`, dont la largeur naturelle
            (une vingtaine de caractères) éloignait le compteur du nom. Fixe
            plutôt qu'ajustée au texte, pour que les compteurs de deux couloirs
            empilés tombent l'un sous l'autre. */}
        <div className="w-28 shrink-0">
          <TextCell
            value={lane.name}
            ariaLabel="Nom du réseau"
            className="text-text-primary text-xs font-bold tracking-wider uppercase"
            onCommit={(next) =>
              run(() => renameLane(scope, { laneId: lane.id, name: next }))
            }
          />
        </div>

        {/* Encre primaire et non secondaire : sur le gris de `border-strong`,
            l'encre secondaire tombait à 3,9:1, mesuré au navigateur. */}
        <span className="bg-border-strong text-text-primary rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums">
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
          onClick={() => setConfirmingDelete(true)}
          aria-label={`Supprimer le réseau ${lane.name}`}
          className="text-muted-foreground hover:text-danger-ink focus-visible:ring-ring ml-auto rounded p-1 focus-visible:ring-2 focus-visible:outline-none"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      </header>

      {/* La suppression d'un couloir emporte ses publications en cascade, et
          sans corbeille : c'est ce que la boîte dit avant le clic. */}
      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Supprimer ${lane.name}`}
        description={
          lane.subjects.length > 0
            ? `Le réseau ${lane.name} part définitivement, avec ses ${lane.subjects.length} publication${lane.subjects.length > 1 ? "s" : ""} et leurs visuels. Rien ne se restaure.`
            : `Le réseau ${lane.name} part définitivement de ce mois.`
        }
        confirmLabel="Supprimer le réseau"
        onConfirm={async () => {
          await run(() => deleteLane(scope, { laneId: lane.id }));
        }}
      />

      {open ? (
        // Le tableau déborde à droite plutôt que d'écraser ses colonnes : le
        // conteneur défile, la page ne bouge pas.
        <div className="overflow-x-auto">
          <div className="min-w-fit">
            {/* Mêmes filets verticaux que les lignes (`[&>*+*]`), même padding
                par cellule : en-tête et lignes restent alignés au pixel. */}
            <div
              className="border-border-strong bg-surface-sunken [&>*+*]:border-border-strong grid border-b px-2 [&>*+*]:border-l"
              style={{ gridTemplateColumns: template }}
            >
              <span className="flex items-center justify-center py-1">
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
                  onSort={onSort}
                  onResizePreview={onResizePreview}
                />
              ))}

              <span className="flex items-center justify-center py-1">
                <AddColumnMenu scope={scope} boardId={lane.board_id} />
              </span>
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
                canGenerateWording={canGenerateWording}
                bulkTargets={
                  selectedIds.has(subject.id) ? [...selectedIds] : null
                }
                onToggleSelect={onToggleSelect}
                onOpen={onOpenSubject}
                onEditLabels={onEditLabels}
                dropIndicator={
                  dropTarget?.subjectId === subject.id
                    ? dropTarget.after
                      ? "apres"
                      : "avant"
                    : null
                }
                onRowDragOver={(subjectId, after) =>
                  setDropTarget((current) =>
                    current?.subjectId === subjectId && current.after === after
                      ? current
                      : { subjectId, after },
                  )
                }
                onRowDragLeave={() => setDropTarget(null)}
                onRowDrop={(subjectId, after, draggedId) =>
                  drop(draggedId, dropIndex(subjectId, after))
                }
              />
            ))}

            {/* La ligne fantôme : le clic sur « Ajouter » répond tout de
                suite, pendant que le serveur crée la vraie ligne — sans elle,
                rien ne bougeait à l'écran le temps de l'aller-retour et on
                recliquait. `useOptimistic` la retire de lui-même quand la
                revalidation apporte la ligne réelle. */}
            {Array.from({ length: creatingCount }).map((_, index) => (
              <div
                key={`fantome-${index}`}
                aria-hidden
                className="border-border-strong flex h-10 animate-pulse items-center gap-2 border-b px-9"
              >
                <span className="bg-muted h-3 w-44 rounded" />
              </div>
            ))}

            {/* Le pied du couloir : ajouter, ou déposer en fin de liste. */}
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  // Avant tout `await` : un état optimiste ne se pose que
                  // dans la partie synchrone d'une transition.
                  showCreating(null);
                  return createSubject(scope, {
                    laneId: lane.id,
                    monthId: lane.month_id,
                    boardId: lane.board_id,
                  });
                })
              }
              onDragOver={(event) => {
                if (![...event.dataTransfer.types].includes(SUBJECT_DRAG_TYPE)) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                const draggedId = event.dataTransfer.getData(SUBJECT_DRAG_TYPE);
                if (!draggedId) return;
                event.preventDefault();
                drop(draggedId, subjects.length);
              }}
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

/**
 * L'alignement d'un en-tête suit celui de son contenu : du texte se cale à
 * gauche, un nombre à droite, une étiquette pleine largeur reste centrée.
 */
function headerAlign(column: ColumnDef): "start" | "center" | "end" {
  // « Sponso » et « Last update » se centrent : leurs cellules sont courtes et
  // centrées, un en-tête calé au bord flottait à côté de son contenu.
  if (column.builtin === "sponsoring" || column.builtin === "updated") return "center";
  if (column.type === "number") return "end";
  // Le sujet est l'ancre de la ligne : lui seul se cale à gauche. Wording et
  // Date sont centrés dans leur colonne, cellule comme en-tête.
  if (column.builtin === "name" || column.type === "text") return "start";
  return "center";
}

function HeaderCell({
  scope,
  column,
  sort,
  onSort,
  onResizePreview,
}: {
  scope: Scope;
  column: ColumnDef;
  sort: PlanningSort;
  onSort: (column: SortableColumnKey) => void;
  onResizePreview: (columnId: string, width: number | null) => void;
}) {
  const { run } = useCellAction();
  const sortKey = sortableKey(column);
  const sorted =
    sort !== "position" && sortKey !== null && sort.column === sortKey
      ? sort.direction
      : null;

  const menu = (
    <ColumnHeaderMenu scope={scope} column={column} align={headerAlign(column)} />
  );

  /**
   * La flèche de tri, au survol de l'en-tête — le geste Monday. Invisible au
   * repos, visible dès que la souris entre dans la case, permanente quand le
   * tri est actif. Le clic cycle : croissant, décroissant, puis retour à
   * l'ordre manuel du tableau.
   */
  const sortButton = sortKey ? (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      aria-label={`Trier par ${column.label}`}
      aria-pressed={sorted !== null}
      title="Trier"
      className={cn(
        "focus-visible:ring-brand absolute top-1/2 right-1 z-10 flex size-5 shrink-0 -translate-y-1/2 items-center justify-center rounded-full outline-none transition-opacity focus-visible:ring-2 focus-visible:opacity-100",
        sorted
          ? // `primary`, jamais du blanc sur `accent-ink` : en sombre l'encre
            // d'accent devient un vert clair et la flèche disparaissait.
            "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground opacity-0 group-hover/head:opacity-100",
      )}
    >
      {sorted === "asc" ? (
        <ArrowUp className="size-3" aria-hidden />
      ) : sorted === "desc" ? (
        <ArrowDown className="size-3" aria-hidden />
      ) : (
        <ArrowUpDown className="size-3" aria-hidden />
      )}
    </button>
  ) : null;

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
      className="hover:bg-brand absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize rounded opacity-0 transition-opacity hover:opacity-100"
    />
  );

  // La piste des retours suit celle du sujet : une cellule d'en-tête muette.
  if (column.builtin === "name") {
    return (
      <>
        <span
          data-col
          className="text-text-secondary group/head relative flex min-w-0 items-center px-1 py-1.5"
        >
          {menu}
          {handle}
        </span>
        <span aria-hidden />
      </>
    );
  }

  return (
    <span
      data-col
      className={cn(
        "text-text-secondary group/head relative flex min-w-0 items-center py-1.5",
        // Padding symétrique quand la colonne se trie : la flèche vit dans le
        // padding droit, le libellé reste centré sur la vraie largeur.
        sortKey ? "px-6" : "px-1",
      )}
    >
      {menu}
      {sortButton}
      {handle}
    </span>
  );
}
