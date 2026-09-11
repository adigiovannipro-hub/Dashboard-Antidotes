"use client";

import { useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";

import {
  createFaqCategory,
  deleteFaqCategory,
  renameFaqCategory,
  setFaqCategoryColor,
} from "@/app/actions/moderation";
import { ConfirmDialog } from "@/components/ds/confirm-dialog";
import { chipInk, useCellAction } from "@/components/planning/cells";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { LABEL_PALETTE } from "@/lib/planning/columns";
import type { FaqCategory } from "@/lib/moderation/types";

/**
 * Les thèmes de la FAQ — la colonne « Thème » du board Monday d'origine.
 *
 * La couleur se **choisit** depuis 20260912b. Avant, elle était déduite du nom
 * par empreinte : stable, mais subie — deux thèmes voisins tombaient sur la
 * même famille et « Livraison » ne pouvait pas prendre le vert qu'on lui
 * associe depuis Monday. Le hachage reste le repli des thèmes sans couleur :
 * aucune FAQ existante ne change d'aspect tant qu'on n'y touche pas.
 */

/* Palette de repli, celle de Monday : l'attribution par empreinte du nom rend
   la teinte stable pour toujours, sans écriture en base.

   Deux teintes ont été assombries d'un cran. Le rouge et le violet de Monday
   plafonnaient à 4,3:1 avec la meilleure des deux encres — relevé à l'audit,
   pas au papier : c'est le maximum atteignable sur ces fonds, l'encre n'y
   pouvait rien. La teinte est la même, la marge ne l'est plus. Un thème dont
   la couleur a été choisie à la main garde la sienne, elle vit en base. */
const FALLBACK_TONES = [
  "#c4c4c4",
  "#ffcb00",
  "#fdab3d",
  "#8e4ac4",
  "#579bfc",
  "#00c875",
  "#cd3550",
  "#66ccff",
  "#ff642e",
  "#7f5347",
];

export function themeColor(category: { name: string; color: string | null }): string {
  if (category.color) return category.color;

  const normalized = category.name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
  // « Général » garde le gris de Monday, quel que soit son rang de hachage.
  if (normalized === "general") return FALLBACK_TONES[0]!;
  let hash = 0;
  for (const char of normalized) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return FALLBACK_TONES[1 + (hash % (FALLBACK_TONES.length - 1))]!;
}

/** L'étiquette d'un thème, en lecture seule — ce que voit le client. */
export function ThemeChip({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-block max-w-full truncate rounded-sm px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase"
      style={{ backgroundColor: color, color: chipInk(color) }}
    >
      {name}
    </span>
  );
}

/**
 * L'éditeur de thèmes, ouvert depuis le sélecteur d'une cellule — le même
 * geste que « Modifier les étiquettes » du planning.
 *
 * Chaque ligne écrit tout de suite, sans bouton « Appliquer » : renommer au
 * blur, recolorer au clic, supprimer après confirmation. Un enregistrement
 * groupé obligerait à comparer l'avant et l'après pour retrouver ce qui a
 * changé, là où quatre actions à un champ le disent déjà.
 */
export function ThemeLabelsDialog({
  clientId,
  categories,
  open,
  onOpenChange,
}: {
  clientId: string;
  categories: FaqCategory[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { run, pending } = useCellAction();
  const [creating, setCreating] = useState("");
  const [toDelete, setToDelete] = useState<FaqCategory | null>(null);

  const add = () => {
    const name = creating.trim();
    if (!name) return;
    setCreating("");
    run(() =>
      createFaqCategory({
        clientId,
        name,
        color: LABEL_PALETTE[categories.length % LABEL_PALETTE.length]!,
      }),
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Thèmes</DialogTitle>
          </DialogHeader>

          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {categories.map((category) => (
              <li key={category.id} className="flex items-center gap-2">
                <ColorSwatch
                  color={themeColor(category)}
                  onSelect={(color) =>
                    run(() =>
                      setFaqCategoryColor({ clientId, categoryId: category.id, color }),
                    )
                  }
                />
                <Input
                  defaultValue={category.name}
                  aria-label={`Nom du thème ${category.name}`}
                  onBlur={(event) => {
                    const name = event.target.value.trim();
                    if (!name || name === category.name) return;
                    run(() =>
                      renameFaqCategory({ clientId, categoryId: category.id, name }),
                    );
                  }}
                  className="h-8 flex-1 uppercase"
                />
                <button
                  type="button"
                  aria-label={`Supprimer le thème ${category.name}`}
                  onClick={() => setToDelete(category)}
                  className="text-muted-foreground hover:text-danger-ink p-1"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <Input
              value={creating}
              aria-label="Nouveau thème"
              placeholder="Nouveau thème"
              onChange={(event) => setCreating(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  add();
                }
              }}
              className="h-8 flex-1"
            />
            <Button type="button" size="sm" onClick={add} disabled={pending}>
              <Plus className="size-3.5" aria-hidden />
              Ajouter
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(next) => {
          if (!next) setToDelete(null);
        }}
        title={`Supprimer le thème ${toDelete?.name ?? ""}`}
        description={`Les éléments de langage rangés sous « ${toDelete?.name ?? ""} » restent dans la FAQ, sans thème. Le thème lui-même part définitivement.`}
        confirmLabel="Supprimer le thème"
        onConfirm={async () => {
          const category = toDelete;
          setToDelete(null);
          if (category) {
            await run(() => deleteFaqCategory({ clientId, categoryId: category.id }));
          }
        }}
      />
    </>
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
        aria-label="Couleur du thème"
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
                <Check className="size-3" style={{ color: chipInk(candidate) }} aria-hidden />
              ) : null}
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
