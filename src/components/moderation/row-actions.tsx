"use client";

import { Archive, ArchiveRestore, Check, Mail } from "lucide-react";

import type { InboxGesture } from "@/app/actions/moderation";
import { cn } from "@/lib/utils";

/**
 * La vignette d'actions d'une ligne, en haut à droite.
 *
 * Deux boutons carrés empilés — lu au-dessus, archiver dessous — comme la
 * Boîte de réception Meta. Ils ne se révèlent qu'au survol et au focus
 * clavier : une liste dense où chaque ligne porte deux boutons visibles en
 * permanence devient un tableau de bord d'aiguillage, et on ne lit plus les
 * messages.
 *
 * Ils vivent **dans** la ligne, qui est un `button` : d'où le `div` en
 * position absolue plutôt que des boutons imbriqués — un bouton dans un
 * bouton n'est pas du HTML valide, et le navigateur défait l'imbrication en
 * silence.
 */
export function RowActions({
  unread,
  archived,
  pending,
  onGesture,
}: {
  unread: boolean;
  archived: boolean;
  pending: boolean;
  onGesture: (gesture: InboxGesture) => void;
}) {
  return (
    /* `z-10` comme la coche : le bouton d'ouverture de la ligne est
       positionné et déclaré après dans le DOM — sans niveau explicite, il
       passe **au-dessus** de la vignette et avale ses clics. La vignette se
       voyait au survol et ne réagissait pas. */
    <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 opacity-0 transition-opacity duration-(--motion-duration) ease-standard group-hover:opacity-100 group-focus-within:opacity-100">
      <RowButton
        label={unread ? "Marquer comme lu" : "Marquer comme non lu"}
        disabled={pending}
        onClick={() => onGesture(unread ? "lu" : "non-lu")}
      >
        {unread ? (
          <Check className="size-3.5" strokeWidth={1.75} aria-hidden />
        ) : (
          <Mail className="size-3.5" strokeWidth={1.75} aria-hidden />
        )}
      </RowButton>

      <RowButton
        label={archived ? "Sortir des archives" : "Archiver"}
        disabled={pending}
        onClick={() => onGesture(archived ? "restaurer" : "archiver")}
      >
        {archived ? (
          <ArchiveRestore className="size-3.5" strokeWidth={1.75} aria-hidden />
        ) : (
          <Archive className="size-3.5" strokeWidth={1.75} aria-hidden />
        )}
      </RowButton>
    </div>
  );
}

function RowButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={label}
      title={label}
      aria-disabled={disabled}
      onClick={(event) => {
        // Sans ça, le clic ouvre aussi la conversation sous la vignette.
        event.stopPropagation();
        if (!disabled) onClick();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        if (!disabled) onClick();
      }}
      className={cn(
        "focus-visible:ring-ring flex size-6 items-center justify-center rounded-md border border-border bg-surface text-text-secondary shadow-card transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "cursor-pointer hover:bg-surface-sunken hover:text-text-primary",
      )}
    >
      {children}
    </span>
  );
}
