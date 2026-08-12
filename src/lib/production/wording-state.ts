/**
 * Quand un sujet du planning attend-il son contenu ?
 *
 * Module minuscule et pur, mais partagé exprès : le compteur du bouton
 * (`queries.ts`) et le worker (`generate.ts`) doivent répondre la même chose.
 * S'ils divergent, la carte annonce « Rédiger les 4 contenus restants » et le
 * job en traite six — l'écart est invisible jusqu'à ce qu'il coûte cher.
 */

import { DONE_STATUSES, type PlanningStatus } from "@/lib/planning/types";

/**
 * Statuts pour lesquels la colonne Wording porte un **brief**, pas un livrable.
 *
 * C'est le pivot de la phase Content. Un sujet en « — » (posé par la
 * génération d'intentions) ou en « WORDING À FAIRE » peut contenir deux
 * phrases de cadrage écrites à la main : elles sont la matière de la
 * rédaction, et le texte final les remplace. Ailleurs — à valider, validé,
 * programmé — la colonne porte le texte publiable et ne se réécrit pas.
 */
export const WORDING_PENDING_STATUSES: PlanningStatus[] = ["idea", "wording_todo"];

/**
 * `true` si la phase Content doit écrire dans ce sujet.
 *
 * Publié : jamais. En attente de rédaction : toujours, brief ou pas. Ailleurs :
 * seulement si la cellule est vide.
 */
export function needsContent(subject: {
  status: string;
  hasWording: boolean;
}): boolean {
  if ((DONE_STATUSES as string[]).includes(subject.status)) return false;
  if ((WORDING_PENDING_STATUSES as string[]).includes(subject.status)) return true;
  return !subject.hasWording;
}
