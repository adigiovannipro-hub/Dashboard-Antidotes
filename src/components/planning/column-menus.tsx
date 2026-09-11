"use client";

import { useState } from "react";
import { Check, EyeOff, Pencil, Plus, Tags, Trash2 } from "lucide-react";

import {
  addColumn,
  removeColumn,
  updateColumn,
} from "@/app/actions/planning";
import { ConfirmDialog } from "@/components/ds/confirm-dialog";
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PendingLabel } from "@/components/ds/pending-label";
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
  align = "center",
}: {
  scope: Scope;
  column: ColumnDef;
  /** Aligné sur le contenu de la colonne, pas sur le milieu de la case. */
  align?: "start" | "center" | "end";
}) {
  const { run } = useCellAction();
  const [renaming, setRenaming] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
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
        {/* Clippé sans exception : un titre trop long se tronque dans sa
            colonne au lieu de déborder sur la voisine. Aligné comme son
            contenu, en revanche — « SUJET » centré au-dessus de titres calés à
            gauche, ou « SPONSORIS. » au-dessus de montants alignés à droite,
            c'est un décalage par colonne que l'œil paie à chaque ligne. */}
        <DropdownMenuTrigger
          aria-label={`Options de la colonne ${column.label}`}
          className={cn(
            "hover:bg-muted focus-visible:ring-brand flex w-full min-w-0 items-center gap-1 overflow-hidden rounded-sm px-1 py-0.5 text-[11px] font-medium tracking-wide uppercase outline-none focus-visible:ring-2",
            align === "start" && "justify-start text-left",
            align === "center" && "justify-center text-center",
            align === "end" && "justify-end text-right",
          )}
        >
          <span className="min-w-0 truncate">{column.label}</span>
        </DropdownMenuTrigger>

        {/* Le tri n'est plus une entrée de menu : c'est la flèche qui apparaît
            au survol de l'en-tête, comme sur Monday. */}
        <DropdownMenuContent className="w-52 min-w-52">
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
            <DropdownMenuItem onClick={() => setConfirmingRemove(true)}>
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

      {/* Une colonne emporte ses valeurs sur toutes les lignes du tableau, et
          il n'y a pas de corbeille pour ça. */}
      <ConfirmDialog
        open={confirmingRemove}
        onOpenChange={setConfirmingRemove}
        title={`Supprimer la colonne ${column.label}`}
        description={`La colonne ${column.label} part du tableau avec ce qu’elle porte sur chaque publication. Rien ne se restaure.`}
        confirmLabel="Supprimer la colonne"
        onConfirm={async () => {
          await run(() => removeColumn(scope, { columnId: column.id }));
        }}
      />
    </>
  );
}

/**
 * L'éditeur d'étiquettes — le panneau « Modifier les étiquettes » du board.
 *
 * « + Nouvelle étiquette » y crée des valeurs libres avec leur couleur, sur
 * toutes les colonnes à pastilles. Exporté : il s'ouvre depuis l'en-tête de
 * colonne comme depuis le sélecteur d'une cellule.
 */
export function LabelsDialog({
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

  // Les identifiants d'origine d'une colonne de base : renommables et
  // recolorables, mais pas supprimables — des lignes les portent peut-être.
  // Tout ce qui a été ajouté ensuite se retire librement.
  const protectedIds = new Set(
    column.removable ? [] : (column.labels ?? []).map((label) => label.id),
  );

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
              {!protectedIds.has(label.id) ? (
                <button
                  type="button"
                  aria-label={`Retirer ${label.label}`}
                  onClick={() =>
                    setLabels((current) => current.filter((_, i) => i !== index))
                  }
                  className="text-muted-foreground hover:text-danger-ink p-1"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>

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

        {!column.removable ? (
          <p className="text-muted-foreground text-xs">
            Les étiquettes d&apos;origine se renomment et se recolorent sans se
            supprimer — des publications les portent peut-être déjà.
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={save} disabled={pending}>
            <PendingLabel pending={pending} busy="Enregistrement…">
              Appliquer
            </PendingLabel>
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
        {/* `DropdownMenuGroup` obligatoire : depuis Base UI 1.6, un
            `GroupLabel` hors d'un groupe jette — et l'erreur faisait tomber
            la page entière au clic sur le « + ». */}
        {ADDABLE_TYPES.map((group, index) => (
          <DropdownMenuGroup key={group.group}>
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
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
