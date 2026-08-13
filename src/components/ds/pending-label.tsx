import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Le libellé d'un bouton qui attend le serveur.
 *
 * Onze boutons de l'application écrivaient `{pending ? "Enregistrement…" :
 * "Appliquer"}`. Deux défauts dans cette ligne, et le second est le pire :
 *
 *   1. **Le bouton change de largeur** au moment précis du clic. « Créer le
 *      devis et ses mensualités » devient « Création… » : le bouton se
 *      rétracte de moitié, et dans une boîte de dialogue tout ce qui l'entoure
 *      se réaligne. Le geste qu'on vient de faire déplace la cible qu'on
 *      venait de viser.
 *   2. **Le texte se remplace d'un coup**, sans rien qui relie les deux états.
 *      Un mot qui en devient un autre se lit comme un rechargement, pas comme
 *      « c'est parti ».
 *
 * Les deux libellés sont donc empilés dans la **même cellule de grille** : la
 * boîte se dimensionne sur le plus large des deux et ne bouge plus jamais,
 * quel que soit l'état. C'est le seul moyen d'avoir une largeur stable sans
 * renoncer au libellé d'attente, qui dit quelque chose d'utile — ce n'est pas
 * la même chose d'enregistrer et de créer.
 *
 * Une conséquence assumée : au repos, le bouton est aussi large que son
 * libellé d'attente. C'est le prix d'une cible qui ne bouge pas, et il est
 * moins cher que l'inverse.
 *
 * Accessibilité : `aria-hidden` sur la couche inactive, sinon un lecteur
 * d'écran annonce les deux libellés à la suite. Le bouton porte déjà
 * `disabled` pendant l'attente, ce qui est le signal attendu.
 */
export function PendingLabel({
  pending,
  busy,
  spinner = true,
  children,
}: {
  pending: boolean;
  /**
   * Le libellé d'attente. Absent, seul le témoin tourne et le libellé ne
   * change pas — ce qu'on veut sur un bouton étroit, où « Envoi… » n'aurait
   * de toute façon pas la place.
   */
  busy?: string;
  /**
   * À couper quand le bouton porte **déjà** une icône qui tourne : la flèche
   * de « Régénérer » se met à tourner d'elle-même pendant la consolidation.
   * Deux témoins côte à côte ne disent pas deux fois mieux la même chose.
   */
  spinner?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className="grid place-items-center">
      <span
        aria-hidden={pending}
        className={cn(
          "col-start-1 row-start-1 transition-opacity duration-(--motion-duration) ease-standard motion-reduce:transition-none",
          pending ? "opacity-0" : "opacity-100",
        )}
      >
        {children}
      </span>

      <span
        aria-hidden={!pending}
        className={cn(
          "col-start-1 row-start-1 flex items-center gap-1.5 whitespace-nowrap transition-opacity duration-(--motion-duration) ease-standard motion-reduce:transition-none",
          pending ? "opacity-100" : "opacity-0",
        )}
      >
        {spinner ? (
          <Loader2
            aria-hidden
            strokeWidth={1.75}
            // `animate-spin` tourne en permanence, y compris sous la couche
            // invisible : la mettre en pause coûterait un rendu de plus pour
            // un élément à opacité nulle, que personne ne voit tourner.
            className="size-3.5 shrink-0 animate-spin"
          />
        ) : null}
        {busy ?? children}
      </span>
    </span>
  );
}
