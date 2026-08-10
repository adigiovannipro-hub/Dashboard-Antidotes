"use client";

import { Trash2, X } from "lucide-react";

import {
  bulkDeleteSubjects,
  bulkUpdateSubjects,
  type EditableField,
} from "@/app/actions/planning";
import { ChipSelect, OwnerCell, useCellAction } from "@/components/planning/cells";
import type { Scope } from "@/components/planning/subject-row";
import type { ColumnDef } from "@/lib/planning/columns";
import type { PlanningOwner } from "@/lib/planning/types";

/**
 * La barre d'actions groupées — celle qui monte du bas de l'écran sur Monday
 * dès qu'une coche est posée.
 *
 * Trois gestes couvrent l'essentiel du travail par lot : changer le statut,
 * changer le type, réattribuer. La suppression est au bout, à l'écart, parce
 * qu'elle n'est pas un geste comme les autres.
 */
export function BulkBar({
  scope,
  selectedIds,
  columns,
  owners,
  onClear,
}: {
  scope: Scope;
  selectedIds: Set<string>;
  columns: ColumnDef[];
  owners: PlanningOwner[];
  onClear: () => void;
}) {
  const { run, pending } = useCellAction();

  if (selectedIds.size === 0) return null;

  const ids = [...selectedIds];
  const apply = (field: EditableField, value: unknown) =>
    run(async () => {
      const result = await bulkUpdateSubjects(scope, {
        subjectIds: ids,
        field,
        value,
      });
      if (result.ok) onClear();
      return result;
    });

  const labelsOf = (builtin: string) =>
    (columns.find((column) => column.builtin === builtin)?.labels ?? []).map(
      (label) => ({ value: label.id, label: label.label, color: label.color }),
    );

  return (
    <div
      role="toolbar"
      aria-label="Actions sur la sélection"
      className="border-border bg-background fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-xl border px-4 py-2.5 shadow-lg"
    >
      <span className="bg-brand flex size-6 items-center justify-center rounded-full text-xs font-bold text-white tabular-nums">
        {selectedIds.size}
      </span>
      <span className="text-sm">
        sélectionnée{selectedIds.size > 1 ? "s" : ""}
      </span>

      <span className="bg-border h-6 w-px" aria-hidden />

      <div className="w-36">
        <ChipSelect<string>
          value={null}
          options={labelsOf("status")}
          ariaLabel="Statut pour la sélection"
          onSelect={(next) => next && apply("status", next)}
          className="border-border border"
        />
      </div>

      <div className="w-32">
        <ChipSelect<string>
          value={null}
          options={labelsOf("format")}
          ariaLabel="Type pour la sélection"
          onSelect={(next) => next && apply("format", next)}
          className="border-border border"
        />
      </div>

      <OwnerCell
        owner={null}
        candidates={owners}
        onSelect={(ownerId) => apply("owner_id", ownerId)}
      />

      <span className="bg-border h-6 w-px" aria-hidden />

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          run(async () => {
            const result = await bulkDeleteSubjects(scope, { subjectIds: ids });
            if (result.ok) onClear();
            return result;
          })
        }
        className="text-muted-foreground hover:text-brand-red flex items-center gap-1 text-xs"
      >
        <Trash2 className="size-3.5" aria-hidden />
        Supprimer
      </button>

      <button
        type="button"
        onClick={onClear}
        aria-label="Vider la sélection"
        className="text-muted-foreground hover:text-foreground p-1"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
