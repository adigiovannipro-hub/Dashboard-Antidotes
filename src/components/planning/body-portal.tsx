"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

/**
 * Portail vers `<body>` pour tout ce qui flotte au-dessus de la page.
 *
 * Montés dans la page, les panneaux et la visionneuse héritent du contexte
 * d'empilement du contenu : la barre collante du shell (z-20) passait devant
 * leur en-tête — croix et sujet invisibles. Même correction que le panneau
 * FAQ, mais gardée au montage : le panneau d'une publication peut être rendu
 * dès l'arrivée (`?sujet=` d'un lien de retours), et `createPortal` n'existe
 * pas côté serveur — il apparaît à l'hydratation, pas avant.
 */
const subscribeNever = () => () => {};

export function BodyPortal({ children }: { children: React.ReactNode }) {
  // `false` au rendu serveur, `true` dès l'hydratation — sans effet ni état.
  const mounted = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  return createPortal(children, document.body);
}
