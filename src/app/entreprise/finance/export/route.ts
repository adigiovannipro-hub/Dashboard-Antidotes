import { getFinanceContext } from "@/lib/finance/access";
import { resolveCategory } from "@/lib/finance/categories";
import { buildExpensesCsv } from "@/lib/finance/csv";
import { parseExpenseParams } from "@/lib/finance/params";
import {
  listCategories,
  listCategoryRules,
  listExpensesForExport,
} from "@/lib/finance/queries";

/**
 * Export CSV du tableau des dépenses — mêmes filtres que l'écran, lus par le
 * même parseur : le fichier contient ce que l'utilisateur regardait, ni plus
 * ni moins.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const context = await getFinanceContext();
  // 404 et non 403 : même posture que les pages du module.
  if (!context) return new Response(null, { status: 404 });

  const url = new URL(request.url);
  const { filters, sort } = parseExpenseParams(
    Object.fromEntries(url.searchParams),
  );

  const [transactions, categories, rules] = await Promise.all([
    listExpensesForExport({ orgId: context.orgId, filters, sort }),
    listCategories(context.orgId),
    listCategoryRules(context.orgId),
  ]);

  const byId = new Map(categories.map((category) => [category.id, category.name]));
  const rows = transactions.map((transaction) => ({
    ...transaction,
    category_name: transaction.category_id
      ? (byId.get(transaction.category_id) ?? null)
      : (resolveCategory(
          {
            category_raw: transaction.category_raw,
            merchant: transaction.merchant ?? transaction.merchant_raw,
          },
          rules,
          categories,
        )?.name ?? null),
  }));

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(buildExpensesCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="depenses-${stamp}.csv"`,
    },
  });
}
