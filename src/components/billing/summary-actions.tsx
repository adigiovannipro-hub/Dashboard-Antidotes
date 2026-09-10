"use client";

import { cn } from "@/lib/utils";

/**
 * Des commandes posées **sur la ligne** d'un disclosure, dans son `<summary>`.
 *
 * Un clic n'importe où dans un `<summary>` replie ou déplie son `<details>` :
 * sans garde, ouvrir la fiche d'un devis refermerait son détail dans le même
 * geste. C'est `preventDefault` qui annule cette bascule et non
 * `stopPropagation` — le repli est l'action **par défaut** du summary, pas un
 * écouteur qu'on pourrait court-circuiter.
 *
 * La garde ne vaut que pour un clic né dans cette barre : un panneau ouvert
 * par l'un de ces boutons vit dans un portail, hors de ce sous-arbre du DOM,
 * mais ses clics remontent quand même l'arbre React — les annuler
 * empêcherait ses propres formulaires de partir. D'où le `contains`.
 *
 * Corollaire : n'y mettre que des boutons `type="button"`. Un bouton de
 * soumission verrait son envoi annulé par la même ligne de code.
 */
export function SummaryActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      onClick={(event) => {
        if (event.currentTarget.contains(event.target as Node)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </div>
  );
}
