"use client";

import { useState } from "react";
import {
  ArrowLeftRight,
  Check,
  EyeOff,
  Pencil,
  Plus,
  Tags,
  Trash2,
} from "lucide-react";

import {
  addColumn,
  removeColumn,
  updateColumn,
} from "@/app/actions/planning";
import { useCellAction } from "@/components/planning/cells";
import type { Scope } from "@/components/planning/subject-row";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  ADDABLE_TYPES,
  LABEL_PALETTE,
  type ColumnDef,
  type ColumnLabel,
} from "@/lib/planning/columns";
import { cn } from "@/lib/utils";

/**
 * Les menus qui font du tableau un tableau *à construire* : l'en-tête de
 * colonne se renomme, se masque, se déplace, retouche ses étiquettes ; le « + »
 * en bout d'en-tête ajoute une colonne typée, groupée comme sur Monday.
 */

export function ColumnHeaderMenu({
  scope,
  column,
  onSortToggle,
  sorted,
}: {
  scope: Scope;
  column: ColumnDef;
  /** Présent uniquement sur la colonne Date : le tri chrono / inverse. */
  onSortToggle?: () => void;
  sorted?: "asc" | "desc" | null;
}) {
  const { run } = useCellAction();
  const [renaming, setRenaming] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [draft, setDraft] = useState(column.label);

  const commitRename = () => {
    setRenaming(false);
    const next = draft.trim();
    if (next && next !== column.label) {
      run(() => updateColumn(scope, { columnId: column.id, patch: { label: next } }));
    } else {
      setDraft(column.label);
    }
  };

  if (renaming) {
    return (
      <input
        autoFocus
        value={draft}
        aria-label="Renommer la colonne"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitRename}
        onKeyDown={(event) => {
          if (event.key === "Enter") commitRename();
          if (event.key === "Escape") {
            setDraft(column.label);
            setRenaming(false);
          }
        }}
        className="focus-visible:ring-brand w-full rounded-sm bg-transparent px-1 text-[11px] font-medium tracking-wide uppercase outline-none focus-visible:ring-2"
      />
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Options de la colonne ${column.label}`}
          className={cn(
            "hover:bg-muted focus-visible:ring-brand flex w-full items-center justify-center gap-1 truncate rounded-sm px-1 py-0.5 text-[11px] font-medium tracking-wide uppercase outline-none focus-visible:ring-2",
            column.builtin === "name" || column.type === "text"
              ? "justify-start"
              : "justify-center",
          )}
        >
          <span className="truncate">{column.label}</span>
          {sorted ? (
            <span aria-hidden className="text-brand">
              {sorted === "asc" ? "↑" : "↓"}
            </span>
          ) : null}
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-52 min-w-52">
          {onSortToggle ? (
            <>
              <DropdownMenuItem onClick={onSortToggle}>
                <ArrowLeftRight className="size-3.5" aria-hidden />
                {sorted === "asc"
                  ? "Trier du plus récent au plus ancien"
                  : "Trier du plus ancien au plus récent"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : null}

          <DropdownMenuItem onClick={() => setRenaming(true)}>
            <Pencil className="size-3.5" aria-hidden />
            Renommer
          </DropdownMenuItem>

          {column.labels ? (
            <DropdownMenuItem onClick={() => setLabelsOpen(true)}>
              <Tags className="size-3.5" aria-hidden />
              Modifier les étiquettes
            </DropdownMenuItem>
          ) : null}

          {column.builtin !== "name" ? (
            <DropdownMenuItem
              onClick={() =>
                run(() =>
                  updateColumn(scope, {
                    columnId: column.id,
                    patch: { hidden: true },
                  }),
                )
              }
            >
              <EyeOff className="size-3.5" aria-hidden />
              Masquer
            </DropdownMenuItem>
          ) : null}

          {column.removable ? (
            <DropdownMenuItem
              onClick={() => run(() => removeColumn(scope, { columnId: column.id }))}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Supprimer
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {column.labels ? (
        <LabelsDialog
          scope={scope}
          column={column}
          open={labelsOpen}
          onOpenChange={setLabelsOpen}
        />
      ) : null}
    </>
  );
}

/**
 * L'éditeur d'étiquettes — le panneau « Modifier les étiquettes » du board.
 *
 * Sur une colonne de base, la liste est fermée : libellé et couleur seulement,
 * parce que les valeurs sont un enum du modèle. Sur une colonne ajoutée, tout
 * est permis, y compris « + Nouvelle étiquette ».
 */
function LabelsDialog({
  scope,
  column,
  open,
  onOpenChange,
}: {
  scope: Scope;
  column: ColumnDef;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { run, pending } = useCellAction();
  const [labels, setLabels] = useState<ColumnLabel[]>(column.labels ?? []);

  const set = (index: number, patch: Partial<ColumnLabel>) => {
    setLabels((current) =>
      current.map((label, i) => (i === index ? { ...label, ...patch } : label)),
    );
  };

  const save = () => {
    run(async () => {
      const result = await updateColumn(scope, {
        columnId: column.id,
        patch: { labels },
      });
      if (result.ok) onOpenChange(false);
      return result;
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next) setLabels(column.labels ?? []);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Étiquettes — {column.label}</DialogTitle>
        </DialogHeader>

        <ul className="max-h-80 space-y-2 overflow-y-auto">
          {labels.map((label, index) => (
            <li key={label.id} className="flex items-center gap-2">
              <ColorSwatch
                color={label.color}
                onSelect={(color) => set(index, { color })}
              />
              <Input
                value={label.label}
                aria-label={`Libellé de l'étiquette ${index + 1}`}
                onChange={(event) => set(index, { label: event.target.value })}
                className="h-8 flex-1 uppercase"
              />
              {column.removable ? (
                <button
                  type="button"
                  aria-label={`Retirer ${label.label}`}
                  onClick={() =>
                    setLabels((current) => current.filter((_, i) => i !== index))
                  }
                  className="text-muted-foreground hover:text-brand-red p-1"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>

        {column.removable ? (
          <button
            type="button"
            onClick={() =>
              setLabels((current) => [
                ...current,
                {
                  id: `etiquette-${Date.now()}`,
                  label: "NOUVELLE",
                  color: LABEL_PALETTE[current.length % LABEL_PALETTE.length]!,
                },
              ])
            }
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs"
          >
            <Plus className="size-3.5" aria-hidden />
            Nouvelle étiquette
          </button>
        ) : (
          <p className="text-muted-foreground text-xs">
            Les valeurs de cette colonne sont fixes : le libellé et la couleur se
            retouchent, la liste ne s&apos;allonge pas.
          </p>
        )}

        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={save} disabled={pending}>
            {pending ? "Enregistrement…" : "Appliquer"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ColorSwatch({
  color,
  onSelect,
}: {
  color: string;
  onSelect: (color: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Couleur de l'étiquette"
        className="focus-visible:ring-brand size-7 shrink-0 rounded-md outline-none focus-visible:ring-2"
        style={{ backgroundColor: color }}
      />
      <DropdownMenuContent className="w-44 min-w-44 p-2">
        <div className="grid grid-cols-7 gap-1">
          {LABEL_PALETTE.map((candidate) => (
            <button
              key={candidate}
              type="button"
              aria-label={candidate}
              onClick={() => onSelect(candidate)}
              className="flex size-5 items-center justify-center rounded"
              style={{ backgroundColor: candidate }}
            >
              {candidate === color ? (
                <Check className="size-3 text-white" aria-hidden />
              ) : null}
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Le « + » en bout d'en-tête : ajouter une colonne, groupé comme Monday. */
export function AddColumnMenu({
  scope,
  boardId,
}: {
  scope: Scope;
  boardId: string;
}) {
  const { run } = useCellAction();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Ajouter une colonne"
        className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-brand flex size-6 items-center justify-center justify-self-center rounded-md outline-none focus-visible:ring-2"
      >
        <Plus className="size-3.5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 min-w-52">
        {ADDABLE_TYPES.map((group, index) => (
          <div key={group.group}>
            {index > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel className="text-muted-foreground text-[11px] uppercase">
              {group.group}
            </DropdownMenuLabel>
            {group.entries.map((entry) => (
              <DropdownMenuItem
                key={entry.type}
                onClick={() =>
                  run(() =>
                    addColumn(scope, {
                      boardId,
                      type: entry.type,
                      label: entry.label,
                    }),
                  )
                }
              >
                {entry.label}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
