/**
 * Branchement direct des réseaux — neutralisé le temps de la bascule Composio.
 *
 * Antidotes portait ses propres applications OAuth : une app Meta (Facebook
 * Login, Pages, Instagram, comptes publicitaires) et un aller-retour Google
 * pour YouTube. Chacune demandait sa console, ses portées, sa validation —
 * et pour LinkedIn et TikTok, une entité juridique et un audit d'interface,
 * soit des semaines avant la première ligne de code utile.
 *
 * Composio porte ces applications à notre place. Deux chemins de branchement
 * qui cohabitent, ce sont deux jeux de jetons pour le même compte, et rien
 * pour dire lequel fait autorité : le premier relevé qui tombe sur le mauvais
 * échoue sans qu'on sache pourquoi. On ferme donc le chemin direct **avant**
 * d'ouvrir l'autre, plutôt que de les laisser se marcher dessus.
 *
 * Ce que la neutralisation fait, concrètement :
 *
 *   • les boutons « Brancher Meta » et « Brancher YouTube » disparaissent ;
 *   • les quatre routes `/api/social/*​/connexion` répondent 404 ;
 *   • les écrans qui renvoyaient vers ces boutons disent la bascule au lieu
 *     de donner une consigne devenue fausse.
 *
 * Ce qu'elle ne fait pas : rien n'est supprimé. Les tables, les affectations
 * déjà faites et les connecteurs restent en place — notamment le connecteur
 * Meta Ads, dont on ne sait pas encore si une passerelle orientée action sait
 * rendre les Insights au grain jour avec ventilations et `action_values`
 * (voir `docs/composio-setup.md`). S'il faut le rallumer, c'est cette
 * constante qui le fait, d'un seul geste.
 *
 * La décision est **ici, en clair et versionnée**, comme celle de l'accès
 * ouvert : un chemin fermé parce qu'on l'a écrit et un chemin fermé parce
 * qu'une variable manque ne se relisent pas de la même façon.
 *
 * Pas de variable d'environnement, contrairement à `access-mode.ts` : ce
 * module est lu des deux côtés de la frontière, et `process.env` n'existe pas
 * dans le navigateur. Une lecture d'environnement rendrait `true` au serveur
 * et `false` au client, ce qui est exactement l'incohérence qu'on veut éviter.
 */
const BRANCHEMENT_DIRECT = false;

/**
 * Le type de retour explicite est nécessaire : sans lui, TypeScript réduit la
 * constante à son littéral et déclare mort tout le code de la branche encore
 * utile — celui qu'on rallumera.
 */
export function isDirectConnectEnabled(): boolean {
  return BRANCHEMENT_DIRECT;
}

/**
 * La phrase unique, pour que les cinq écrans concernés disent la même chose.
 * Un message par endroit, ce sont cinq vérités qui divergent au premier
 * changement.
 */
export const COMPOSIO_TRANSITION_NOTE =
  "Les branchements directs sont retirés : les connexions passent désormais par Composio, qui n'est pas encore raccordé. Aucun compte ne peut être connecté d'ici pour l'instant.";
