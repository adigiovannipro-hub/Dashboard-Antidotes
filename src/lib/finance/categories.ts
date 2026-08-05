/**
 * Résolution d'une catégorie Airwallex vers le plan de catégories d'Antidotes.
 *
 * Deux étages, dans cet ordre :
 *
 *   1. les règles de correspondance (`finance_category_rules`), éditées depuis
 *      l'écran — c'est la volonté explicite ;
 *   2. l'égalité de nom avec une catégorie du plan — le cas où le plan reprend
 *      simplement le vocabulaire d'Airwallex ne mérite pas une règle.
 *
 * Aucune correspondance : `null`. La ligne garde alors son libellé brut à
 * l'affichage — mieux vaut montrer « Transports » non mappé que d'inventer un
 * rangement.
 */

import type { FinanceCategory, FinanceCategoryRule } from "./types";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function resolveCategory(
  rawLabel: string | null,
  rules: readonly FinanceCategoryRule[],
  categories: readonly FinanceCategory[],
): FinanceCategory | null {
  if (!rawLabel) return null;
  const needle = normalize(rawLabel);
  if (needle === "") return null;

  const rule = rules.find((candidate) => normalize(candidate.matcher) === needle);
  if (rule) {
    return categories.find((category) => category.id === rule.category_id) ?? null;
  }

  return (
    categories.find((category) => normalize(category.name) === needle) ?? null
  );
}
