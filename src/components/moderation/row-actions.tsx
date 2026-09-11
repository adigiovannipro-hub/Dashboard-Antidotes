"use client";

import { Archive, ArchiveRestore, CheckCheck, ExternalLink, Mail } from "lucide-react";

import type { InboxGesture } from "@/app/actions/moderation";
import { cn } from "@/lib/utils";

/**
 * La vignette d'actions d'une ligne, en haut à droite.
 *
 * Trois boutons carrés empilés — traitée, lu, ranger — comme la Boîte de
 * réception Meta, plus l'ouverture de la publication commentée quand on en a
 * le lien : c'est le geste qu'on fait le plus souvent avant de répondre, et il
 * demandait jusqu'ici d'ouvrir le fil pour le trouver.
 *
 * Ils ne se révèlent qu'au survol et au focus clavier : une liste dense où
 * chaque ligne porte quatre boutons visibles en permanence devient un tableau
 * d'aiguillage, et on ne lit plus les messages.
 *
 * Ils vivent **dans** la ligne, qui est un `button` : d'où le `div` en
 * position absolue plutôt que des boutons imbriqués — un bouton dans un
 * bouton n'est pas du HTML valide, et le navigateur défait l'imbrication en
 * silence.
 */
export function RowActions({
  unread,
  archived,
  postPermalink,
  pending,
  onGesture,
}: {
  unread: boolean;
  archived: boolean;
  /** La publication commentée, quand la plateforme en rend le lien. */
  postPermalink: string | null;
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
        label="Marquer traitée"
        disabled={pending}
        // Le geste principal de la boîte : régler le fil. Il porte l'aplat,
        // comme la coche verte de la Boîte de réception Meta.
        emphasis
        onClick={() => onGesture("traitee")}
      >
        <CheckCheck className="size-4" strokeWidth={1.75} aria-hidden />
      </RowButton>

      <RowButton
        label={unread ? "Marquer comme lu" : "Marquer comme non lu"}
        disabled={pending}
        onClick={() => onGesture(unread ? "lu" : "non-lu")}
      >
        <Mail className="size-4" strokeWidth={1.75} aria-hidden />
      </RowButton>

      <RowButton
        label={archived ? "Sortir des archives" : "Ignorer"}
        disabled={pending}
        onClick={() => onGesture(archived ? "restaurer" : "archiver")}
      >
        {archived ? (
          <ArchiveRestore className="size-4" strokeWidth={1.75} aria-hidden />
        ) : (
          <Archive className="size-4" strokeWidth={1.75} aria-hidden />
        )}
      </RowButton>

      {postPermalink ? (
        <a
          href={postPermalink}
          target="_blank"
          rel="noreferrer"
          aria-label="Ouvrir la publication"
          title="Ouvrir la publication"
          onClick={(event) => event.stopPropagation()}
          className="focus-visible:ring-ring flex size-8 items-center justify-center rounded-md border border-border bg-surface text-text-secondary shadow-card transition-colors duration-(--motion-duration) ease-standard hover:bg-surface-sunken hover:text-text-primary focus-visible:ring-2 focus-visible:outline-none"
        >
          <ExternalLink className="size-4" strokeWidth={1.75} aria-hidden />
        </a>
      ) : null}
    </div>
  );
}

function RowButton({
  label,
  disabled,
  emphasis,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  /** Le geste principal se voit en aplat — les autres restent sobres. */
  emphasis?: boolean;
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
        "focus-visible:ring-ring flex size-8 items-center justify-center rounded-md border shadow-card transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
        emphasis
          ? // `bg-primary` et jamais `--accent-ink` : l'encre d'accent
            // s'inverse en sombre et le glyphe blanc y tombe à 1,39:1.
            "border-transparent bg-primary text-primary-foreground hover:opacity-90"
          : "border-border bg-surface text-text-secondary hover:bg-surface-sunken hover:text-text-primary",
        disabled && "cursor-not-allowed opacity-50",
        !disabled && "cursor-pointer",
      )}
    >
      {children}
    </span>
  );
}
