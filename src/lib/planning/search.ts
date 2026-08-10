import type { MonthWithLanes } from "./types";

/**
 * La recherche du tableau — le ⌘F du planning.
 *
 * Fonctions pures : le filtrage se rejoue tel quel dans un test, et le
 * composant ne porte que l'état du champ. La casse et les accents sont pliés
 * des deux côtés — « éte » trouve « ÉTÉ » — parce qu'on cherche un wording de
 * mémoire, jamais à la lettre près.
 */

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function matchesSubject(
  subject: { name: string; wording: string | null },
  query: string,
): boolean {
  const needle = fold(query.trim());
  if (!needle) return true;
  return fold(`${subject.name}\n${subject.wording ?? ""}`).includes(needle);
}

/**
 * Les mois vus au travers de la recherche : seules les publications qui
 * répondent restent, et un couloir ou un mois vidé disparaît — l'écran ne
 * montre que là où il y a quelque chose à trouver.
 */
export function filterMonths(
  months: MonthWithLanes[],
  query: string,
): MonthWithLanes[] {
  if (!query.trim()) return months;

  return months
    .map((month) => ({
      ...month,
      lanes: month.lanes
        .map((lane) => ({
          ...lane,
          subjects: lane.subjects.filter((subject) =>
            matchesSubject(subject, query),
          ),
        }))
        .filter((lane) => lane.subjects.length > 0),
    }))
    .filter((month) => month.lanes.length > 0);
}

/** Le compteur « n résultats » du champ de recherche. */
export function countSubjects(months: MonthWithLanes[]): number {
  return months.reduce(
    (total, month) =>
      total + month.lanes.reduce((sum, lane) => sum + lane.subjects.length, 0),
    0,
  );
}
