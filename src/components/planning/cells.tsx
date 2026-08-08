"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Loader2, Paperclip, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import type { PlanningResult } from "@/app/actions/planning";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PlanningOwner, ResolvedVisual } from "@/lib/planning/types";
import { isImagePath } from "@/lib/planning/storage";
import { cn } from "@/lib/utils";

/**
 * Cellules éditables du tableau.
 *
 * Chaque cellule écrit directement en base, sans bouton « enregistrer » : c'est
 * ce qu'on attend d'un tableur, et c'est ce que fait Monday. Les champs texte
 * n'envoient qu'à la sortie du champ, et seulement si la valeur a changé —
 * sinon un simple passage au clavier déclencherait une écriture par colonne.
 */

/** Lance une action et signale l'échec. Le succès, lui, se voit à l'écran. */
export function useCellAction() {
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<PlanningResult>) => {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error);
    });
  };

  return { run, pending };
}

export function CellSpinner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <Loader2
      className="text-muted-foreground size-3 shrink-0 animate-spin"
      aria-label="Enregistrement"
    />
  );
}

// --- Texte -------------------------------------------------------------------

export function TextCell({
  value,
  onCommit,
  placeholder,
  className,
  ariaLabel,
}: {
  value: string;
  onCommit: (next: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel: string;
}) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);

  // Une écriture venue d'ailleurs — revalidation, autre onglet — doit reprendre
  // la main. Pas pendant qu'on tape, en revanche : `draft === synced` dit
  // précisément que le champ n'a pas été touché depuis la dernière écriture.
  if (value !== synced && draft === synced) {
    setSynced(value);
    setDraft(value);
  }

  function commit() {
    const next = draft.trim();
    if (next === synced) return;
    setSynced(next);
    onCommit(next);
  }

  return (
    <input
      value={draft}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(synced);
          event.currentTarget.blur();
        }
      }}
      className={cn(
        "focus-visible:ring-brand w-full rounded-sm bg-transparent px-1.5 py-1 text-sm outline-none focus-visible:ring-2",
        className,
      )}
    />
  );
}

export function NumberCell({
  value,
  onCommit,
  ariaLabel,
}: {
  value: number | null;
  onCommit: (next: number | null) => void;
  ariaLabel: string;
}) {
  const incoming = value === null ? "" : String(value);
  const [draft, setDraft] = useState(incoming);
  const [synced, setSynced] = useState(incoming);

  if (incoming !== synced && draft === synced) {
    setSynced(incoming);
    setDraft(incoming);
  }

  function commit() {
    if (draft === synced) return;
    setSynced(draft);
    const trimmed = draft.trim().replace(",", ".");
    if (trimmed === "") return onCommit(null);
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error("Montant invalide.");
      setDraft(value === null ? "" : String(value));
      return;
    }
    onCommit(parsed);
  }

  return (
    <input
      inputMode="decimal"
      value={draft}
      aria-label={ariaLabel}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      className="focus-visible:ring-brand w-full rounded-sm bg-transparent px-1.5 py-1 text-right text-sm tabular-nums outline-none focus-visible:ring-2"
    />
  );
}

export function DateCell({
  value,
  onCommit,
}: {
  value: string | null;
  onCommit: (next: string | null) => void;
}) {
  return (
    <input
      type="date"
      value={value ?? ""}
      aria-label="Date de publication"
      onChange={(event) => onCommit(event.target.value || null)}
      className="focus-visible:ring-brand w-full rounded-sm bg-transparent px-1.5 py-1 text-sm tabular-nums outline-none focus-visible:ring-2"
    />
  );
}

// --- Pastilles ----------------------------------------------------------------

export type ChipOption<T extends string> = {
  value: T;
  label: string;
  color: string;
};

const INK_DARK = "#1a1a1a";
const INK_LIGHT = "#ffffff";

/** Luminance relative WCAG d'un `#rrggbb`, `null` si la chaîne n'en est pas un. */
function relativeLuminance(color: string): number | null {
  const hex = color.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  const channel = (start: number) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/**
 * L'encre d'une pastille, déduite de son fond.
 *
 * Les couleurs viennent du board Monday et ne se négocient pas — mais du blanc
 * posé sur « EN BROUILLON » (#9cd326) tombe à 1,79:1, illisible. Plutôt que de
 * retoucher la palette du client, on choisit l'encre.
 *
 * On **compare les deux contrastes** au lieu de trancher sur un seuil de
 * luminance. Le seuil qui vivait ici, 0,45, était mal calé : la bascule réelle
 * est vers 0,20, et tout ce qui tombait entre les deux recevait du blanc alors
 * que le sombre était meilleur. « PUBLIÉ » (#00c875) sortait ainsi à 2,21:1 au
 * lieu de 7,88:1, et « WORDING À FAIRE » (#ff6d3b) à 2,82:1 au lieu de 6,19:1.
 * Un calcul ne se dérègle pas ; une constante, si.
 */
function chipInk(color: string): string {
  const background = relativeLuminance(color);
  if (background === null) return INK_LIGHT;

  const contrast = (ink: number) =>
    ink > background
      ? (ink + 0.05) / (background + 0.05)
      : (background + 0.05) / (ink + 0.05);

  const dark = relativeLuminance(INK_DARK) ?? 0;
  return contrast(dark) >= contrast(1) ? INK_DARK : INK_LIGHT;
}

/**
 * Pastille colorée avec sélecteur, à la manière des colonnes « status » de
 * Monday. Les couleurs sont celles du board d'origine : l'équipe les lit depuis
 * des mois, et un orange qui ne veut plus dire « en cours » coûterait plus cher
 * qu'une palette repensée.
 */
export function ChipSelect<T extends string>({
  value,
  options,
  onSelect,
  ariaLabel,
  allowClear,
  className,
}: {
  value: T | null;
  options: ChipOption<T>[];
  onSelect: (next: T | null) => void;
  ariaLabel: string;
  allowClear?: boolean;
  className?: string;
}) {
  const current = options.find((option) => option.value === value) ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        className={cn(
          "focus-visible:ring-brand flex h-7 w-full items-center justify-center rounded-sm px-2 text-[11px] font-semibold tracking-wide uppercase outline-none focus-visible:ring-2",
          className,
        )}
        style={{
          backgroundColor: current?.color ?? "transparent",
          color: current ? chipInk(current.color) : undefined,
        }}
      >
        <span className={cn("truncate", !current && "text-muted-foreground")}>
          {current?.label ?? "—"}
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-56 min-w-56 p-1.5">
        <div className="grid grid-cols-2 gap-1">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(option.value)}
              className="focus-visible:ring-ring flex h-8 items-center justify-center rounded-md px-2 text-[11px] font-semibold tracking-wide uppercase outline-none focus-visible:ring-2"
              style={{ backgroundColor: option.color, color: chipInk(option.color) }}
            >
              <span className="truncate">{option.label}</span>
              {option.value === value ? (
                <Check className="ml-1 size-3 shrink-0" aria-hidden />
              ) : null}
            </button>
          ))}
        </div>
        {allowClear ? (
          <DropdownMenuItem onClick={() => onSelect(null)} className="mt-1">
            Vider
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Sélecteur textuel sans couleur — les objectifs publicitaires. */
export function TextSelect({
  value,
  options,
  onSelect,
  ariaLabel,
}: {
  value: string | null;
  options: string[];
  onSelect: (next: string | null) => void;
  ariaLabel: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        className="hover:bg-muted/60 focus-visible:ring-brand flex h-7 w-full items-center rounded-sm px-1.5 text-left text-sm outline-none focus-visible:ring-2"
      >
        <span className={cn("truncate", !value && "text-muted-foreground")}>
          {value ?? "—"}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48 min-w-48">
        {options.map((option) => (
          <DropdownMenuItem key={option} onClick={() => onSelect(option)}>
            {option}
            {option === value ? <Check className="ml-auto size-3.5" /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onClick={() => onSelect(null)}>Vider</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// --- Propriétaire ---------------------------------------------------------------

export function OwnerCell({
  owner,
  candidates,
  onSelect,
}: {
  owner: PlanningOwner | null;
  candidates: PlanningOwner[];
  onSelect: (ownerId: string | null) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Propriétaire"
        className="focus-visible:ring-brand flex w-full items-center justify-center rounded-sm outline-none focus-visible:ring-2"
      >
        <OwnerAvatar owner={owner} />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 min-w-56">
        {candidates.length === 0 ? (
          <DropdownMenuItem disabled>Aucun compte disponible</DropdownMenuItem>
        ) : null}
        {candidates.map((candidate) => (
          <DropdownMenuItem
            key={candidate.id}
            onClick={() => onSelect(candidate.id)}
            className="gap-2"
          >
            <OwnerAvatar owner={candidate} />
            <span className="truncate">
              {candidate.full_name ?? candidate.email}
            </span>
            {candidate.id === owner?.id ? (
              <Check className="ml-auto size-3.5" />
            ) : null}
          </DropdownMenuItem>
        ))}
        {owner ? (
          <DropdownMenuItem onClick={() => onSelect(null)}>Retirer</DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function OwnerAvatar({ owner }: { owner: PlanningOwner | null }) {
  if (!owner) {
    return (
      <span
        aria-hidden
        className="border-border text-muted-foreground flex size-6 items-center justify-center rounded-full border border-dashed text-[10px]"
      >
        ?
      </span>
    );
  }

  const label = owner.full_name ?? owner.email;
  const initials = label
    .split(/[\s.@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

  return (
    <Avatar className="size-6" title={label}>
      {owner.avatar_url ? <AvatarImage src={owner.avatar_url} alt={label} /> : null}
      <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
    </Avatar>
  );
}

// --- Wording ---------------------------------------------------------------------

export function WordingCell({
  value,
  subjectName,
  onCommit,
}: {
  value: string | null;
  subjectName: string;
  onCommit: (next: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  function save() {
    const next = draft.trim();
    if (next !== (value ?? "").trim()) onCommit(next || null);
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft(value ?? "");
      }}
    >
      <DialogTrigger
        aria-label={`Wording de ${subjectName || "la publication"}`}
        className="hover:bg-muted/60 focus-visible:ring-brand block w-full truncate rounded-sm px-1.5 py-1 text-left text-sm outline-none focus-visible:ring-2"
      >
        <span className={cn(!value && "text-muted-foreground")}>
          {value ? value.replace(/\s+/g, " ") : "—"}
        </span>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{subjectName || "Wording"}</DialogTitle>
        </DialogHeader>

        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={16}
          aria-label="Wording"
          placeholder="La caption publiable, ou l'intention en phase de planning."
          className="border-input bg-background focus-visible:ring-brand w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />

        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={save}>
            Enregistrer
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setOpen(false)}
          >
            Annuler
          </Button>
          <span className="text-muted-foreground ml-auto text-xs tabular-nums">
            {draft.length} caractères
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Visuels ------------------------------------------------------------------------

export function VisualsCell({
  visuals,
  subjectName,
  uploading,
  onUpload,
  onRemove,
  className,
}: {
  visuals: ResolvedVisual[];
  subjectName: string;
  uploading: boolean;
  onUpload: (file: File) => void;
  onRemove: (path: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const first = visuals[0];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        aria-label={`Visuels de ${subjectName || "la publication"} (${visuals.length})`}
        className={cn(
          "hover:bg-muted/60 focus-visible:ring-brand flex w-full items-center justify-center gap-1 rounded-sm px-1 py-1 outline-none focus-visible:ring-2",
          className,
        )}
      >
        {first ? (
          <>
            {isImagePath(first.path) && first.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL signée
              <img
                src={first.url}
                alt=""
                className="size-6 rounded object-cover"
                loading="lazy"
              />
            ) : (
              <Paperclip className="text-muted-foreground size-3.5" aria-hidden />
            )}
            {visuals.length > 1 ? (
              <span className="text-muted-foreground text-[11px] tabular-nums">
                +{visuals.length - 1}
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Visuels — {subjectName || "publication"}</DialogTitle>
        </DialogHeader>

        {visuals.length === 0 ? (
          <p className="text-muted-foreground text-sm">Aucun visuel pour l&apos;instant.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-3">
            {visuals.map((visual) => (
              <li key={visual.path} className="group relative">
                <a
                  href={visual.url || undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-card block aspect-square overflow-hidden rounded-md"
                >
                  {isImagePath(visual.path) && visual.url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- URL signée
                    <img
                      src={visual.url}
                      alt={visual.name}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-muted-foreground flex size-full items-center justify-center p-2 text-center text-[11px] break-all">
                      {visual.name}
                    </span>
                  )}
                </a>
                <button
                  type="button"
                  onClick={() => onRemove(visual.path)}
                  aria-label={`Retirer ${visual.name}`}
                  className="bg-background/90 absolute top-1 right-1 rounded-full p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept="image/*,video/mp4,video/quicktime,application/pdf"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "Envoi…" : "Ajouter un visuel"}
          </Button>
          <span className="text-muted-foreground text-xs">
            Images, MP4, MOV ou PDF — 50 Mo maximum.
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Suppression de ligne -------------------------------------------------------

export function DeleteRowButton({
  label,
  onDelete,
}: {
  label: string;
  onDelete: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onDelete}
      aria-label={`Supprimer ${label}`}
      className="text-muted-foreground hover:text-danger-ink focus-visible:ring-ring rounded p-1 opacity-0 transition group-hover/row:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
    >
      <Trash2 className="size-3.5" aria-hidden />
    </button>
  );
}
