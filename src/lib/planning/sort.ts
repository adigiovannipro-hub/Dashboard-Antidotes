import type { PlanningSort, SortableColumnKey } from "@/lib/ui-preferences";
import type { ColumnDef } from "./columns";
import type { SubjectRow } from "./types";

/**
 * Le tri d'un couloir depuis un en-tête de colonne.
 *
 * `position` est l'ordre du tableau — celui du drag & drop. La Date range en
 * chronologie ; une colonne à étiquettes suit l'**ordre de ses étiquettes**,
 * qui est l'ordre métier (POST avant REELS avant CARROUSEL si c'est leur ordre
 * déclaré) — un tri alphabétique mettrait CARROUSEL en tête sans rien vouloir
 * dire. Les lignes sans valeur finissent en bas, où on les retrouve au lieu
 * de les perdre, et l'ordre manuel départage les ex æquo.
 */

/** La clé de tri d'une colonne, ou `null` si elle ne se trie pas. */
export function sortableKey(column: ColumnDef): SortableColumnKey | null {
  switch (column.builtin) {
    case "date":
      return "date";
    case "status":
      return "status";
    case "format":
      return "format";
    case "objective":
      return "objective";
    case "ad_status":
      return "ad_status";
    default:
      return null;
  }
}

export function sortSubjects(
  subjects: SubjectRow[],
  sort: PlanningSort,
  columns: ColumnDef[],
): SubjectRow[] {
  if (sort === "position") return subjects;
  const direction = sort.direction === "asc" ? 1 : -1;

  if (sort.column === "date") {
    return [...subjects].sort((a, b) => {
      if (a.scheduled_on === b.scheduled_on) return a.position - b.position;
      if (a.scheduled_on === null) return 1;
      if (b.scheduled_on === null) return -1;
      return a.scheduled_on.localeCompare(b.scheduled_on) * direction;
    });
  }

  const column = columns.find((candidate) => candidate.builtin === sort.column);
  const rank = new Map(
    (column?.labels ?? []).map((label, index) => [label.id, index]),
  );

  const valueOf = (row: SubjectRow): string | null => {
    switch (sort.column) {
      case "status":
        // `idea` et `other` sont les valeurs « rien de choisi » : elles se
        // rangent avec les vides, pas comme une étiquette de plus.
        return row.status === "idea" ? null : row.status;
      case "format":
        return row.format === "other" ? null : row.format;
      case "objective":
        return row.ad_objective;
      default:
        return row.ad_status;
    }
  };

  return [...subjects].sort((a, b) => {
    const rankA = rank.get(valueOf(a) ?? "") ?? null;
    const rankB = rank.get(valueOf(b) ?? "") ?? null;
    if (rankA === rankB) return a.position - b.position;
    if (rankA === null) return 1;
    if (rankB === null) return -1;
    return (rankA - rankB) * direction;
  });
}
