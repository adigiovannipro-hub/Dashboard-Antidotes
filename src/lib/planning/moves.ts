import type { SubjectRow } from "./types";

/**
 * Un déplacement de ligne posé à l'écran avant que le serveur ne l'écrive.
 *
 * `index` est compté comme le serveur le compte : sur la liste du couloir
 * d'arrivée **sans** la ligne déplacée. `row` voyage avec le déplacement, parce
 * qu'un couloir d'arrivée ne connaît pas la ligne d'un couloir voisin.
 */
export type PendingMove = { subjectId: string; laneId: string; index: number; row: SubjectRow };

/**
 * Les lignes d'un couloir, déplacements en attente appliqués dans l'ordre :
 * la ligne quitte son couloir d'origine et se pose dans celui d'arrivée, au
 * rang visé. Pur : c'est ce qui rend le glisser-déposer instantané sans
 * attendre l'aller-retour serveur.
 */
export function applyMoves(
  laneId: string,
  subjects: SubjectRow[],
  moves: readonly PendingMove[],
): SubjectRow[] {
  if (moves.length === 0) return subjects;
  let list = subjects;
  for (const move of moves) {
    const without = list.filter((subject) => subject.id !== move.subjectId);
    if (move.laneId !== laneId) {
      list = without;
      continue;
    }
    const index = Math.max(0, Math.min(move.index, without.length));
    list = [
      ...without.slice(0, index),
      { ...move.row, lane_id: laneId },
      ...without.slice(index),
    ];
  }
  return list;
}
