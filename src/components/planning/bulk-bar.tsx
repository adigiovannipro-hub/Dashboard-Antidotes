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
import {
  ChipSelect,
  DateCell,
  OwnerCell,
  useCellAction,
} from "@/components/planning/cells";
import type { Scope } from "@/components/planning/subject-row";
import type { ColumnDef } from "@/lib/planning/columns";
import type { PlanningOwner } from "@/lib/planning/types";

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
    { builtin: "status", field: "status", placeholder: "Statut", width: "w-32" },
    { builtin: "format", field: "format", placeholder: "Type", width: "w-28" },
    {
      builtin: "objective",
      field: "ad_objective",
      placeholder: "Objectif",
      width: "w-32",
    },
    { builtin: "ad_status", field: "ad_status", placeholder: "Ads", width: "w-24" },
  ];

  return (
    <div
      role="toolbar"
      aria-label="Actions sur la sélection"
      className="border-border bg-background fixed bottom-4 left-1/2 z-30 flex max-w-[95vw] -translate-x-1/2 items-center gap-2.5 overflow-x-auto rounded-xl border px-4 py-2.5 shadow-lg"
    >
      <span className="bg-brand flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white tabular-nums">
        {selectedIds.size}
      </span>
      <span className="shrink-0 text-sm">
        sélectionnée{selectedIds.size > 1 ? "s" : ""}
      </span>

      <span className="bg-border h-6 w-px shrink-0" aria-hidden />

      {pickers.map((picker) => (
        <div key={picker.field} className={`${picker.width} shrink-0`}>
          <ChipSelect<string>
            value={null}
            options={labelsOf(picker.builtin)}
            ariaLabel={`${picker.placeholder} pour la sélection`}
            placeholder={picker.placeholder}
            onSelect={(next) => next && apply(picker.field, next)}
            className="border-border border"
          />
        </div>
      ))}

      <div className="w-32 shrink-0">
        <DateCell value={null} onCommit={(next) => apply("scheduled_on", next)} />
      </div>

      <OwnerCell
        owner={null}
        candidates={owners}
        onSelect={(ownerId) => apply("owner_id", ownerId)}
      />

      <span className="bg-border h-6 w-px shrink-0" aria-hidden />

      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => bulkDuplicateSubjects(scope, { subjectIds: ids }))}
        className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1 text-xs"
      >
        <Copy className="size-3.5" aria-hidden />
        Dupliquer
      </button>

      <button
        type="button"
        disabled={pending}
        onClick={onRequestMove}
        className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1 text-xs"
      >
        <FolderInput className="size-3.5" aria-hidden />
        Déplacer
      </button>

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          run(async () => {
            const result = await bulkArchiveSubjects(scope, { subjectIds: ids });
            if (result.ok) onClear();
            return result;
          })
        }
        className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1 text-xs"
      >
        <Archive className="size-3.5" aria-hidden />
        Archiver
      </button>

      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirmingDelete(true)}
        className="text-muted-foreground hover:text-danger-ink flex shrink-0 items-center gap-1 text-xs"
      >
        <Trash2 className="size-3.5" aria-hidden />
        Supprimer
      </button>

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

      <button
        type="button"
        onClick={onClear}
        aria-label="Vider la sélection"
        className="text-muted-foreground hover:text-foreground shrink-0 p-1"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
