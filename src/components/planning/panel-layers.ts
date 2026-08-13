"use client";

import { useEffect, useRef } from "react";

/**
 * Les panneaux qui glissent depuis la droite : leur empilement, et leur
 * fermeture au clic à côté.
 *
 * Deux peuvent être ouverts en même temps — la prévisualisation du feed, et
 * la publication qu'on vient d'y ouvrir. Le dernier demandé passe devant, ce
 * qui suppose de compter les ouvertures plutôt que de figer deux niveaux.
 */

/** Le plancher : au-dessus du tableau, sous la visionneuse plein écran. */
const PANEL_BASE_Z = 40;

export function panelZIndex(rank: number): number {
  return PANEL_BASE_Z + rank;
}

/**
 * Ce qui flotte au-dessus de la page et ne doit **jamais** faire fermer un
 * panneau : l'autre panneau, un menu, une boîte de dialogue, la visionneuse,
 * les toasts.
 *
 * L'inverse — énumérer ce qui ferme — reviendrait à lister toute la page, et
 * le moindre oubli refermerait un panneau au milieu d'un geste.
 */
const KEEPS_PANELS_OPEN = [
  "[data-panel]",
  "[data-lightbox]",
  '[role="menu"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  "[data-sonner-toaster]",
  '[data-slot="dropdown-menu-content"]',
].join(",");

/**
 * Ferme au clic en dehors — sur le tableau derrière, typiquement.
 *
 * `pointerdown` et non `click` : on ferme dès que le geste commence, comme
 * tout ce qui flotte. Et le clic qui a ouvert le panneau est déjà passé quand
 * l'écouteur se pose, il ne peut donc pas le refermer aussitôt.
 */
export function useDismissOnOutsideClick(
  active: boolean,
  onDismiss: () => void,
) {
  /**
   * Le rappel passe par une référence, et l'écouteur ne se réinscrit qu'au
   * changement d'`active`.
   *
   * Ce n'est pas de l'optimisation. Avec deux panneaux ouverts, le premier à
   * réagir referme le sien, React redessine dans la foulée — et un écouteur
   * réinscrit à chaque rendu se retrouve **désinscrit au milieu de la
   * propagation** : le second panneau ne recevait jamais l'événement et
   * restait ouvert. Un clic sur le tableau doit tout refermer, pas un sur
   * deux.
   */
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  });

  useEffect(() => {
    if (!active) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      // Un nœud déjà détaché — le contenu d'un menu qui vient de se fermer —
      // n'est plus « à côté » de quoi que ce soit.
      if (!target.isConnected) return;
      if (target.closest(KEEPS_PANELS_OPEN)) return;
      dismiss.current();
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [active]);
}
