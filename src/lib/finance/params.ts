import type { ExpenseFilters, ExpenseSort } from "./queries";

/**
 * Lecture des paramètres d'URL du tableau des dépenses.
 *
 * Partagée entre la page et la route d'export : le CSV doit contenir
 * exactement ce que l'écran filtre, et deux lectures distinctes de l'URL
 * finiraient par se contredire sur un cas limite.
 *
 * Tout paramètre illisible retombe sur le défaut plutôt que d'échouer : une
 * URL bricolée à la main doit dégrader l'affichage, pas le casser.
 */

export type ExpenseParams = {
  filters: ExpenseFilters;
  sort: ExpenseSort;
  page: number;
  /** Mois sélectionné (`AAAA-MM`), quand le filtre vient des pastilles de
      mois plutôt que des bornes libres. Pilote aussi la carte « Dépensé ». */
  month: string | null;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

/** Dernier jour d'un mois `AAAA-MM`, en UTC. */
function monthEnd(isoMonth: string): string {
  const [year, month] = isoMonth.split("-").map(Number);
  return new Date(Date.UTC(year!, month!, 0)).toISOString().slice(0, 10);
}

const SORT_FIELDS = {
  date: "occurred_at",
  montant: "billing",
  marchand: "merchant",
} as const;

export function parseExpenseParams(
  query: Record<string, string | undefined>,
): ExpenseParams {
  const filters: ExpenseFilters = {};

  if (query.du && DATE_PATTERN.test(query.du)) filters.from = query.du;
  if (query.au && DATE_PATTERN.test(query.au)) filters.to = query.au;

  /* Le mois est un raccourci sur les mêmes bornes : `?mois=2026-06` vaut
     `?du=2026-06-01&au=2026-06-30`. Des bornes explicites l'emportent — elles
     sont le geste le plus précis. */
  let month: string | null = null;
  if (
    query.mois &&
    MONTH_PATTERN.test(query.mois) &&
    !filters.from &&
    !filters.to
  ) {
    month = query.mois;
    filters.from = `${query.mois}-01`;
    filters.to = monthEnd(query.mois);
  }

  if (query.categorie) filters.categoryId = query.categorie;
  if (query.justificatif === "manquant") filters.missingReceipt = true;

  const field =
    SORT_FIELDS[(query.tri ?? "date") as keyof typeof SORT_FIELDS] ??
    "occurred_at";
  const direction = query.sens === "asc" ? "asc" : "desc";

  const parsedPage = Number.parseInt(query.page ?? "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  return { filters, sort: { field, direction }, page, month };
}
