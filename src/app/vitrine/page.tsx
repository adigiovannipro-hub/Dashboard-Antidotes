import type { Metadata } from "next";

/**
 * L'accueil de `antidotes.agency`, que le proxy sert à la place de « / » sur
 * le domaine de la vitrine (`src/lib/domains.ts`).
 *
 * Volontairement noire : le domaine est réservé, la landing viendra ici. Pas
 * d'indexation tant qu'elle n'existe pas — un moteur qui range une page vide
 * sous le nom de l'agence ne rend service à personne.
 */
export const metadata: Metadata = {
  title: { absolute: "Antidotes" },
  robots: { index: false, follow: false },
};

export default function VitrinePage() {
  return <div aria-hidden className="fixed inset-0 bg-black" />;
}
