"use client";

import { Archive, ArchiveRestore, Check, Mail, Trash2, X } from "lucide-react";

import type { InboxGesture } from "@/app/actions/moderation";
import { cn } from "@/lib/utils";

/**
 * La barre d'actions groupées de l'inbox — verticale, flottante à gauche du
 * panneau, comme celle du Planning l'est en bas du tableau.
 *
 * À gauche et non en bas : la liste occupe le volet de gauche, une barre au
 * centre bas se serait posée sur le fil, c'est-à-dire sur ce qu'on est en
 * train de lire. Elle n'apparaît qu'avec une sélection, et une action ne la
 * vide pas — sauf celles qui font disparaître les lignes de la vue.
 *
 * Les gestes sont exactement ceux de la vignette d'une ligne : même action
 * serveur, même vocabulaire. Rien ici ne touche à Meta — c'est notre boîte
 * qu'on range, le commentaire reste en ligne.
 */
export function SelectionBar({
  count,
  pending,
  onGesture,
  onClear,
}: {
  count: number;
  pending: boolean;
  onGesture: (gesture: InboxGesture) => void;
  onClear: () => void;
}) {
  if (count === 0) return null;

  return (
    <div
      role="toolbar"
      aria-label="Actions sur la sélection"
      /* Deux positions, une seule barre. En grand écran elle se pose **hors**
         du panneau, à sa gauche : posée à cheval sur le bord, elle masquait
         les coches des lignes qu'elle sert. En dessous, la place manque à
         gauche du contenu — elle repasse en bas, horizontale et centrée,
         comme celle du Planning. */
      className="fixed bottom-4 left-1/2 z-30 flex max-w-[95vw] -translate-x-1/2 flex-row items-center gap-1 overflow-x-auto rounded-pill border border-border bg-surface px-2 py-1.5 shadow-lg lg:absolute lg:top-1/2 lg:bottom-auto lg:left-0 lg:-translate-x-[calc(100%+0.5rem)] lg:-translate-y-1/2 lg:flex-col lg:px-1 lg:py-2"
    >
      <span
        className="type-caption flex size-6 shrink-0 items-center justify-center rounded-pill bg-primary font-bold text-primary-foreground tabular-nums lg:mb-0.5"
        aria-label={`${count} conversation${count > 1 ? "s" : ""} sélectionnée${count > 1 ? "s" : ""}`}
      >
        {count}
      </span>

      <BarButton
        label="Marquer comme lues"
        disabled={pending}
        onClick={() => onGesture("lu")}
      >
        <Check className="size-4" strokeWidth={1.75} aria-hidden />
      </BarButton>

      <BarButton
        label="Marquer comme non lues"
        disabled={pending}
        onClick={() => onGesture("non-lu")}
      >
        <Mail className="size-4" strokeWidth={1.75} aria-hidden />
      </BarButton>

      <BarButton label="Archiver" disabled={pending} onClick={() => onGesture("archiver")}>
        <Archive className="size-4" strokeWidth={1.75} aria-hidden />
      </BarButton>

      <BarButton
        label="Sortir des archives"
        disabled={pending}
        onClick={() => onGesture("restaurer")}
      >
        <ArchiveRestore className="size-4" strokeWidth={1.75} aria-hidden />
      </BarButton>

      <span aria-hidden className="mx-0.5 h-5 w-px bg-border lg:mx-0 lg:my-0.5 lg:h-px lg:w-5" />

      <BarButton
        label="Supprimer de l'inbox"
        disabled={pending}
        danger
        onClick={() => onGesture("supprimer")}
      >
        <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
      </BarButton>

      <BarButton label="Vider la sélection" disabled={false} onClick={onClear}>
        <X className="size-4" strokeWidth={1.75} aria-hidden />
      </BarButton>
    </div>
  );
}

function BarButton({
  label,
  disabled,
  danger,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "focus-visible:ring-ring flex size-8 shrink-0 items-center justify-center rounded-pill transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        danger
          ? "text-text-secondary hover:bg-danger-subtle hover:text-danger-ink"
          : "text-text-secondary hover:bg-surface-sunken hover:text-text-primary",
      )}
    >
      {children}
    </button>
  );
}
