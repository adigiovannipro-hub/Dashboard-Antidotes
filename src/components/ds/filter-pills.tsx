"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Groupe de filtres en pastilles, posé dans une gouttière creuse.
 *
 * Les liens plutôt que des boutons : le filtre vit dans l'URL en français
 * (`?periode=semaine`), comme partout ailleurs dans l'application. Un filtre
 * choisi se partage et survit au retour arrière.
 *
 * La pastille active est en encre pleine et non en vert : c'est une sélection,
 * pas un état favorable, et l'écran ne porte qu'un seul aplat d'accent.
 */

export type FilterOption = { value: string; label: string; href: string };

export function FilterPills({
  options,
  current,
  ariaLabel,
  className,
}: {
  options: FilterOption[];
  current: string;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1 rounded-pill bg-surface-sunken p-1",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === current;
        return (
          <Link
            key={option.value}
            href={option.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "type-caption focus-visible:ring-ring rounded-pill px-3 py-1.5 font-medium transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
              active
                ? "bg-primary text-primary-foreground"
                : "text-text-secondary hover:text-text-primary",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}
