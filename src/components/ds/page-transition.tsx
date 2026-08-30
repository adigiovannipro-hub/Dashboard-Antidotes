"use client";

import { usePathname } from "next/navigation";

/**
 * Le fondu d'arrivée d'une page, rejoué à chaque changement de route.
 *
 * La classe seule ne suffirait pas : le shell vit dans le layout et ne se
 * remonte pas quand la page change — l'animation ne jouerait qu'une fois par
 * session. La clé sur le chemin force le remontage au bon moment, et sur lui
 * seul : changer un filtre (`?statut=`) garde le même chemin et ne fait pas
 * clignoter l'écran. `enter-fade` et non `enter-rise` — le contenu porte des
 * graphiques, un déplacement leur coûterait un recalcul de mise en page.
 * Sous `prefers-reduced-motion`, la classe est neutralisée dans globals.css.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="enter-fade">
      {children}
    </div>
  );
}
