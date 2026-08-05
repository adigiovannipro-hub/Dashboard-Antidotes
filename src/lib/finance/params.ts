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
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
  if (query.categorie) filters.categoryId = query.categorie;
  if (query.justificatif === "manquant") filters.missingReceipt = true;

  const field =
    SORT_FIELDS[(query.tri ?? "date") as keyof typeof SORT_FIELDS] ??
    "occurred_at";
  const direction = query.sens === "asc" ? "asc" : "desc";

  const parsedPage = Number.parseInt(query.page ?? "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  return { filters, sort: { field, direction }, page };
}
