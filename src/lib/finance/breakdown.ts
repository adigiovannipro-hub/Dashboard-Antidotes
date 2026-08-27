import { resolveCategory } from "./categories";
import type { FinanceCategory, FinanceCategoryRule } from "./types";

/**
 * Répartition des dépenses par catégorie, pour le camembert de l'écran.
 *
 * Module **pur** : les lignes, les règles et le plan de catégories entrent en
 * paramètres, rien n'est lu en base — c'est ce qui le rend testable, et ce qui
 * garantit que le camembert range chaque ligne **exactement comme le
 * tableau** : même `resolveCategory`, même priorité au rangement manuel
 * (`category_id`), même repli sur les règles puis les correspondances
 * embarquées. Deux résolutions divergentes montreraient deux vérités sur le
 * même écran.
 *
 * Seuls les débits **EUR** sont additionnés — même convention que la carte
 * « Dépensé » : le wallet est en euros, et additionner des devises entre
 * elles serait une invention (règle du repo : jamais de conversion).
 */

/** Ce qu'une ligne de dépense apporte à la répartition. */
export type BreakdownRow = {
  billing_amount_cents: number | null;
  billing_currency: string | null;
  category_id: string | null;
  category_raw: string | null;
  merchant: string | null;
  merchant_raw: string | null;
};

export type BreakdownEntry = {
  label: string;
  cents: number;
  /** Part du total, dans [0, 1]. */
  share: number;
};

export type ExpenseBreakdown = {
  /** Total EUR débité de la période. */
  total_cents: number;
  /** Toutes les catégories, triées de la plus grosse à la plus petite. */
  entries: BreakdownEntry[];
};

export const UNCATEGORIZED_LABEL = "Sans catégorie";

export function buildExpenseBreakdown(
  rows: readonly BreakdownRow[],
  rules: readonly FinanceCategoryRule[],
  categories: readonly FinanceCategory[],
): ExpenseBreakdown {
  const nameById = new Map(categories.map((category) => [category.id, category.name]));

  const byLabel = new Map<string, number>();
  let total = 0;

  for (const row of rows) {
    if (row.billing_currency !== "EUR") continue;
    const cents = row.billing_amount_cents ?? 0;
    if (cents === 0) continue;

    // La priorité est celle de l'affichage : le rangement manuel d'abord,
    // puis règles → nom → correspondances embarquées, puis l'aveu.
    const label =
      (row.category_id ? nameById.get(row.category_id) : null) ??
      resolveCategory(
        {
          category_raw: row.category_raw,
          merchant: row.merchant ?? row.merchant_raw,
        },
        rules,
        categories,
      )?.name ??
      UNCATEGORIZED_LABEL;

    byLabel.set(label, (byLabel.get(label) ?? 0) + cents);
    total += cents;
  }

  const entries = [...byLabel.entries()]
    .map(([label, cents]) => ({
      label,
      cents,
      share: total > 0 ? cents / total : 0,
    }))
    .sort((a, b) => b.cents - a.cents);

  return { total_cents: total, entries };
}
