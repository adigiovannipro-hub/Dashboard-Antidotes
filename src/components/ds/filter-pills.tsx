"use client";

import Link from "next/link";

import {
  PillIndicator,
  useOptimisticPill,
  usePillIndicator,
} from "@/components/ds/pill-indicator";
import { LinkPending } from "@/components/ds/route-progress";
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
 *
 * Elle **glisse** d'une option à l'autre et part au clic : un filtre relance
 * une page rendue côté serveur, et sans ce déplacement rien ne bougeait entre
 * le clic et la réponse. Voir `ds/pill-indicator.tsx`.
 */

export type FilterOption = {
  value: string;
  label: string;
  href: string;
  /** Compteur affiché après le libellé — masqué à zéro, un zéro ne crie rien. */
  count?: number;
};

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
  const { active, select } = useOptimisticPill(current);
  const { listRef, box, measured } = usePillIndicator<HTMLElement>(active);

  return (
    <nav
      ref={listRef}
      aria-label={ariaLabel}
      className={cn(
        "relative inline-flex items-center gap-1 rounded-pill bg-surface-sunken p-1",
        className,
      )}
    >
      <PillIndicator box={box} />

      {options.map((option) => {
        const selected = active === option.value;
        return (
          <Link
            key={option.value}
            href={option.href}
            data-pill={option.value}
            // Le choix réel, pas l'optimiste : rien n'annonce une page où l'on
            // n'est pas encore.
            aria-current={option.value === current ? "page" : undefined}
            onClick={() => select(option.value)}
            className={cn(
              "type-caption focus-visible:ring-ring relative rounded-pill px-3 py-1.5 font-medium transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
              selected
                ? // Repli sans mesure : le fond reste sur le lien, exactement
                  // comme avant l'indicateur glissant.
                  cn("text-primary-foreground", !measured && "bg-primary")
                : "text-text-secondary hover:text-text-primary",
            )}
          >
            <LinkPending />
            {option.label}
            {option.count ? (
              // `currentColor` à 15 % : le badge suit l'encre de sa pastille —
              // blanc translucide sur la sélection pleine, gris doux ailleurs
              // — et le chiffre garde le contraste du libellé qui le porte.
              <span className="ml-1.5 inline-block rounded-pill bg-current/15 px-1.5 tabular-nums">
                {option.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
