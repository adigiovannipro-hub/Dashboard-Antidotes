"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * L'aplat qui glisse derrière un groupe de pastilles.
 *
 * Onglets d'un espace client (Contexte / Planning / Reporting), filtres de
 * l'accueil : jusqu'ici la pastille active était un fond posé sur le lien, et
 * changer d'onglet faisait **disparaître** l'aplat d'un côté pour le faire
 * **apparaître** de l'autre. Deux événements sans rapport, là où il n'y en a
 * qu'un : la sélection s'est déplacée. Un seul aplat qui parcourt la distance
 * le raconte, et occupe l'œil exactement pendant l'attente de la page.
 *
 * ── Trois choses à ne pas casser ────────────────────────────────────────────
 *
 * 1. **Le premier rendu reste celui d'avant.** Le serveur ne connaît pas les
 *    largeurs : il ne peut pas placer l'aplat. Tant que rien n'est mesuré,
 *    c'est donc le lien actif qui porte son fond, comme avant — `measured`
 *    vaut faux, l'indicateur n'existe pas. La mesure se fait en
 *    `useLayoutEffect`, donc **avant la première peinture** : le passage d'un
 *    régime à l'autre n'est jamais visible, et sans JavaScript l'écran est
 *    exactement celui d'aujourd'hui.
 *
 * 2. **Les polices arrivent après.** Inter et Montserrat sont chargées en
 *    `swap` : les libellés changent de largeur une fois la police échangée,
 *    et un aplat mesuré trop tôt se retrouve décalé. D'où le `ResizeObserver`
 *    sur le conteneur **et sur chaque pastille**.
 *
 * 3. **`offsetLeft` se lit dans son parent positionné.** Le conteneur doit
 *    porter `relative`, sans quoi les mesures se calent sur un ancêtre
 *    quelconque et l'aplat part ailleurs sur la page.
 */

export type PillBox = { x: number; width: number };

/**
 * Mesure la pastille active et suit ses déplacements.
 *
 * `activeKey` est la valeur du `data-pill` à suivre — celle que la liste
 * considère active *maintenant*, y compris de façon optimiste : c'est ce qui
 * permet à l'aplat de partir au clic sans attendre la réponse du serveur.
 */
export function usePillIndicator<T extends HTMLElement>(activeKey: string) {
  const listRef = useRef<T | null>(null);
  const [box, setBox] = useState<PillBox | null>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const measure = () => {
      const target = list.querySelector<HTMLElement>(
        `[data-pill="${CSS.escape(activeKey)}"]`,
      );
      // Aucune pastille active — un filtre sur une valeur inconnue, un onglet
      // retiré : pas d'aplat, plutôt qu'un aplat au hasard.
      if (!target) {
        setBox(null);
        return;
      }
      setBox((current) => {
        const next = { x: target.offsetLeft, width: target.offsetWidth };
        // Éviter un rendu pour une mesure identique : le `ResizeObserver` se
        // déclenche aussi pour des changements qui ne bougent rien.
        return current && current.x === next.x && current.width === next.width
          ? current
          : next;
      });
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(list);
    for (const child of Array.from(list.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [activeKey]);

  return { listRef, box, measured: box !== null };
}

/**
 * L'aplat. Posé en fond du conteneur, sous les libellés — les pastilles
 * doivent donc porter `relative` pour rester au-dessus.
 *
 * `transform` et non `left` : un déplacement en `left` repasse par la mise en
 * page à chaque image. La largeur, elle, n'a pas d'équivalent en
 * transformation — un `scaleX` déformerait les rayons. Elle est donc animée
 * telle quelle, ce qui reste tenable sur un élément de cette taille et à
 * raison d'une transition par clic.
 */
export function PillIndicator({
  box,
  variant = "pill",
  className,
}: {
  box: PillBox | null;
  /**
   * `pill` : l'aplat plein des onglets de section et des filtres.
   * `underline` : le filet du niveau juste en dessous — les tableaux d'un
   * planning. Deux rangées de pastilles identiques donneraient le même poids
   * à deux niveaux de navigation différents ; le mouvement, lui, peut être le
   * même, c'est la même idée qui se déplace.
   */
  variant?: "pill" | "underline";
  className?: string;
}) {
  if (!box) return null;

  return (
    <span
      aria-hidden
      className={cn(
        "absolute left-0",
        variant === "pill"
          ? "inset-y-1 rounded-pill bg-primary"
          : "-bottom-px h-0.5 rounded-pill bg-text-primary",
        "transition-[transform,width] duration-(--motion-duration-slow) ease-exit",
        "motion-reduce:transition-none",
        className,
      )}
      style={{ transform: `translateX(${box.x}px)`, width: box.width }}
    />
  );
}

/**
 * Sélection optimiste : la pastille cliquée devient active **avant** que le
 * serveur ne réponde, et rend la main dès que la route confirme.
 *
 * Sans cela, l'aplat ne part qu'à l'arrivée de la nouvelle page — c'est-à-dire
 * précisément après le moment où il aurait servi à quelque chose.
 *
 * `settled` est la vérité du routeur (le segment courant). Quand elle change,
 * le choix local est oublié : une navigation annulée, un retour arrière ou un
 * lien ouvert ailleurs ramènent l'aplat où il doit être.
 */
export function useOptimisticPill(settled: string) {
  const [clicked, setClicked] = useState<string | null>(null);
  const [seen, setSeen] = useState(settled);

  // Ajusté pendant le rendu plutôt que dans un effet : le pattern « adjusting
  // state when props change » de React, déjà employé dans les cellules du
  // Planning. Un effet ferait clignoter l'aplat d'un tour de rendu.
  if (seen !== settled) {
    setSeen(settled);
    setClicked(null);
  }

  return { active: clicked ?? settled, select: setClicked };
}
