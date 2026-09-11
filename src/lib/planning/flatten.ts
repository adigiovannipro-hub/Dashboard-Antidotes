import type { PlanningView } from "@/lib/ui-preferences";
import type { ColumnDef } from "./columns";
import { sortSubjects } from "./sort";
import type { MonthWithLanes } from "./types";

/**
 * L'ordre visuel du tableau, mis à plat.
 *
 * Le Shift+clic coche « tout ce qu'il y a entre les deux », et ce « entre »
 * n'existe nulle part dans le code : l'ordre de l'écran est reconstruit à
 * trois étages — les mois filtrés par la recherche, leurs couloirs, puis
 * `sortSubjects` rejoué **dans** chaque couloir. Une plage calculée sur les
 * données brutes engloberait des lignes repliées, invisibles, et le premier
 * clic dans une cellule les réécrirait toutes en base (`bulkTargets`). D'où
 * cette liste, qui ne contient que ce que l'œil voit.
 *
 * Module pur : la règle se rejoue dans un test, et le composant ne porte que
 * l'ancre du dernier clic.
 */

export type VisibleSubjectsOptions = {
  /**
   * Les mois **déjà passés par `filterMonths`** : une recherche vide les
   * couloirs et les mois qui ne répondent pas, et ceux-là ne sont pas à
   * l'écran.
   */
  months: MonthWithLanes[];
  /** Les colonnes effectives — le tri par étiquettes suit leur ordre. */
  columns: ColumnDef[];
  /** Tri, mois ouverts, couloirs repliés : l'état de lecture du tableau. */
  view: PlanningView;
  /** Le mois ouvert tant que le cookie n'a jamais été touché. */
  currentMonthKey: string;
  /** Une recherche en cours déplie les mois — mais jamais les couloirs. */
  searching: boolean;
  /** Le calendrier ne rend aucune case à cocher : rien n'y est sélectionnable. */
  calendar: boolean;
};

/**
 * Un mois est-il déplié ?
 *
 * Reprise mot pour mot de la règle du tableau : `months === null` vaut « jamais
 * touché », donc le seul mois en cours — une liste **vide**, elle, vaut « tout
 * replié », et confondre les deux rouvrirait le mois courant. La recherche
 * force l'ouverture, un résultat caché n'existant pas.
 */
function monthIsOpen(
  month: MonthWithLanes,
  view: PlanningView,
  currentMonthKey: string,
  searching: boolean,
): boolean {
  if (searching) return true;
  return view.months === null
    ? month.month === currentMonthKey
    : view.months.includes(month.month.slice(0, 7));
}

/** Les publications affichées, dans l'ordre exact de l'écran. */
export function visibleSubjectIds(options: VisibleSubjectsOptions): string[] {
  if (options.calendar) return [];

  const ids: string[] = [];
  for (const month of options.months) {
    if (!monthIsOpen(month, options.view, options.currentMonthKey, options.searching)) {
      continue;
    }
    for (const lane of month.lanes) {
      // `forceOpen` s'arrête aux mois : un couloir replié le reste, recherche
      // ou pas, et ses lignes ne sont donc pas à l'écran.
      if (options.view.closedLanes.includes(lane.id)) continue;
      for (const subject of sortSubjects(lane.subjects, options.view.sort, options.columns)) {
        ids.push(subject.id);
      }
    }
  }
  return ids;
}

/**
 * La tranche entre deux lignes, bornes comprises et quel que soit le sens du
 * geste — on étend une sélection vers le bas comme vers le haut.
 *
 * Une borne absente de la liste rend `[]` : l'ancre a pu être repliée,
 * filtrée par la recherche ou supprimée depuis le clic qui l'a posée, et
 * deviner une plage à partir d'un seul point cocherait n'importe quoi.
 */
export function rangeBetween(
  ids: string[],
  anchorId: string,
  targetId: string,
): string[] {
  const anchor = ids.indexOf(anchorId);
  const target = ids.indexOf(targetId);
  if (anchor === -1 || target === -1) return [];
  const start = Math.min(anchor, target);
  const end = Math.max(anchor, target);
  return ids.slice(start, end + 1);
}
