"use client";

import { useState } from "react";
import { Archive, Copy, FolderInput, Trash2, X } from "lucide-react";

import {
  bulkArchiveSubjects,
  bulkDeleteSubjects,
  bulkDuplicateSubjects,
  bulkUpdateSubjects,
  type EditableField,
} from "@/app/actions/planning";
import { ConfirmDialog } from "@/components/ds/confirm-dialog";
import { BodyPortal } from "@/components/planning/body-portal";
import {
  ChipSelect,
  DateCell,
  OwnerCell,
  useCellAction,
} from "@/components/planning/cells";
import type { Scope } from "@/components/planning/subject-row";
import type { ColumnDef } from "@/lib/planning/columns";
import type { PlanningOwner } from "@/lib/planning/types";
import { cn } from "@/lib/utils";

/**
 * La barre d'actions groupées — celle qui monte du bas de l'écran sur Monday
 * dès qu'une coche est posée.
 *
 * Une modification **ne vide pas la sélection** : on enchaîne statut puis
 * date puis objectif sur les mêmes lignes, et la barre reste. Seules la
 * suppression — plus rien à sélectionner — et la croix la ferment.
 *
 * Chaque sélecteur porte son nom en guise de valeur vide : une rangée de
 * tirets ne disait pas ce que la barre savait faire. La suppression reste au
 * bout, à l'écart — ce n'est pas un geste comme les autres.
 */
export function BulkBar({
  scope,
  selectedIds,
  columns,
  owners,
  onClear,
  onRequestMove,
}: {
  scope: Scope;
  selectedIds: Set<string>;
  columns: ColumnDef[];
  owners: PlanningOwner[];
  onClear: () => void;
  /** Ouvre « Choisir un nouveau parent » — la boîte vit au niveau du tableau. */
  onRequestMove: () => void;
}) {
  const { run, pending } = useCellAction();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (selectedIds.size === 0) return null;

  const ids = [...selectedIds];
  const apply = (field: EditableField, value: unknown) =>
    run(() => bulkUpdateSubjects(scope, { subjectIds: ids, field, value }));

  const labelsOf = (builtin: string) =>
    (columns.find((column) => column.builtin === builtin)?.labels ?? []).map(
      (label) => ({ value: label.id, label: label.label, color: label.color }),
    );

  const pickers: {
    builtin: string;
    field: EditableField;
    placeholder: string;
    width: string;
  }[] = [
    {
      builtin: "status",
      field: "status",
      placeholder: "Statut",
      width: "w-28",
    },
    { builtin: "format", field: "format", placeholder: "Type", width: "w-24" },
    {
      builtin: "objective",
      field: "ad_objective",
      placeholder: "Objectif",
      width: "w-28",
    },
    {
      builtin: "ad_status",
      field: "ad_status",
      placeholder: "Ads",
      width: "w-20",
    },
  ];

  // Dans un portail : rendue dans la page, la barre héritait du contexte
  // d'empilement du contenu, et le rail passait devant son début quel que
  // soit son `z-index`.
  return (
    <BodyPortal>
      <div
        role="toolbar"
        aria-label="Actions sur la sélection"
        // Un plateau qui se détache du tableau, comme sur Monday : plus haut,
        // ombré, et d'un gris propre en sombre — à `bg-background`, il se
        // confondait avec la page noire et l'on ne voyait pas qu'une sélection
        // était en cours. `z-40` : centré sur la fenêtre, il passe au-dessus du
        // rail (z-30) plutôt que dessous.
        className="border-board-line bg-bulk-bar text-text-primary fixed bottom-6 left-1/2 z-40 flex max-w-[95vw] -translate-x-1/2 items-center gap-3 overflow-x-auto rounded-lg border py-3 pr-3 pl-4 shadow-2xl"
      >
        <span className="flex shrink-0 items-center gap-3">
          <span className="bg-selection-count flex size-9 items-center justify-center rounded-full text-base font-semibold text-white tabular-nums">
            {selectedIds.size}
          </span>
          <span className="type-h3 whitespace-nowrap">
            {selectedIds.size > 1 ? "sélectionnées" : "sélectionnée"}
          </span>
        </span>

        <span className="bg-board-line h-10 w-px shrink-0" aria-hidden />

        {pickers.map((picker) => (
          <div key={picker.field} className={`${picker.width} shrink-0`}>
            <ChipSelect<string>
              value={null}
              options={labelsOf(picker.builtin)}
              ariaLabel={`${picker.placeholder} pour la sélection`}
              placeholder={picker.placeholder}
              onSelect={(next) => next && apply(picker.field, next)}
              className="border-board-line h-9 border"
            />
          </div>
        ))}

        <div className="w-24 shrink-0">
          <DateCell
            value={null}
            onCommit={(next) => apply("scheduled_on", next)}
          />
        </div>

        <OwnerCell
          owner={null}
          candidates={owners}
          onSelect={(ownerId) => apply("owner_id", ownerId)}
        />

        <span className="bg-board-line h-10 w-px shrink-0" aria-hidden />

        <BarAction
          icon={Copy}
          label="Dupliquer"
          disabled={pending}
          onClick={() =>
            run(() => bulkDuplicateSubjects(scope, { subjectIds: ids }))
          }
        />
        <BarAction
          icon={FolderInput}
          label="Déplacer"
          disabled={pending}
          onClick={onRequestMove}
        />
        <BarAction
          icon={Archive}
          label="Archiver"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const result = await bulkArchiveSubjects(scope, {
                subjectIds: ids,
              });
              if (result.ok) onClear();
              return result;
            })
          }
        />
        <BarAction
          icon={Trash2}
          label="Supprimer"
          danger
          disabled={pending}
          onClick={() => setConfirmingDelete(true)}
        />

        <ConfirmDialog
          open={confirmingDelete}
          onOpenChange={setConfirmingDelete}
          title={`Supprimer ${ids.length} publication${ids.length > 1 ? "s" : ""}`}
          description={`${ids.length} publication${ids.length > 1 ? "s" : ""} ${
            ids.length > 1 ? "partent" : "part"
          } à la corbeille. Restaurable${ids.length > 1 ? "s" : ""} depuis la corbeille de l’en-tête.`}
          confirmLabel="Supprimer"
          onConfirm={async () => {
            const result = await run(() =>
              bulkDeleteSubjects(scope, { subjectIds: ids }),
            );
            if (result.ok) onClear();
          }}
        />

        <span className="bg-board-line h-10 w-px shrink-0" aria-hidden />

        <button
          type="button"
          onClick={onClear}
          aria-label="Vider la sélection"
          className="text-text-secondary hover:bg-muted hover:text-text-primary flex size-10 shrink-0 items-center justify-center rounded-md transition-colors duration-(--motion-duration) ease-standard"
        >
          <X className="size-5" strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </BodyPortal>
  );
}

/** Une action de la barre : l'icône au-dessus du mot, comme sur Monday. */
function BarAction({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: React.ComponentType<{
    className?: string;
    strokeWidth?: number;
    "aria-hidden"?: boolean;
  }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "type-caption text-text-secondary hover:bg-muted flex shrink-0 flex-col items-center gap-1 rounded-md px-2 py-1.5 transition-colors duration-(--motion-duration) ease-standard disabled:opacity-50",
        danger ? "hover:text-danger-ink" : "hover:text-text-primary",
      )}
    >
      <Icon className="size-5" strokeWidth={1.75} aria-hidden />
      {label}
    </button>
  );
}
