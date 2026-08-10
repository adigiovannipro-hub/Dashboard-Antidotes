import { redirect } from "next/navigation";

/**
 * Les Reçus n'ont plus de page à eux.
 *
 * Leur inbox à trois colonnes — filtres, détail, historique — répondait à une
 * question qu'on ne se pose jamais : « que contiennent mes reçus ? ». La seule
 * qui compte, « est-ce que j'envoie cette pièce ? », tient en une ligne et un
 * bouton, désormais dans un panneau de la page Finance, à côté des dépenses
 * que ces pièces justifient.
 *
 * La redirection reste : des liens et des signets pointent ici, et le retour
 * OAuth de la connexion Gmail y ramène avec ses paramètres.
 */
export default function ReceiptsPage() {
  redirect("/entreprise/finance");
}
