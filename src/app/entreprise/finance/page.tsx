import type { Metadata } from "next";

import { BalanceChart } from "@/components/finance/balance-chart";
import { ExpensesTable, type DisplayExpense } from "@/components/finance/expenses-table";
import { InvoicesBlock } from "@/components/finance/invoices-block";
import { SyncBanner } from "@/components/finance/sync-banner";
import { TreasuryBlock } from "@/components/finance/treasury-block";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireFinanceAccess } from "@/lib/finance/access";
import { resolveCategory } from "@/lib/finance/categories";
import { parseExpenseParams } from "@/lib/finance/params";
import {
  getBalanceSeries,
  getSyncOverview,
  getTreasury,
  listCategories,
  listCategoryRules,
  listExpenses,
  listInvoices,
} from "@/lib/finance/queries";

export const metadata: Metadata = { title: "Finance · Mon entreprise" };

type Search = Promise<Record<string, string | undefined>>;

/**
 * L'écran Finance : quatre blocs, une seule page.
 *
 * Tout est lu depuis Supabase — jamais d'appel Airwallex au rendu. Ce que
 * l'écran montre est ce que la dernière synchronisation a laissé, et la
 * bannière dit de quand elle date.
 */
export default async function FinancePage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const context = await requireFinanceAccess();
  const params = parseExpenseParams(await searchParams);

  const [treasury, series, invoices, categories, rules, expenses, sync] =
    await Promise.all([
      getTreasury(context.orgId),
      getBalanceSeries(context.orgId),
      listInvoices(context.orgId),
      listCategories(context.orgId),
      listCategoryRules(context.orgId),
      listExpenses({
        orgId: context.orgId,
        filters: params.filters,
        sort: params.sort,
        page: params.page,
      }),
      getSyncOverview(context.orgId),
    ]);

  const categoryNames = new Map(
    categories.map((category) => [category.id, category.name]),
  );
  const rows: DisplayExpense[] = expenses.rows.map((transaction) => ({
    ...transaction,
    category_label: transaction.category_id
      ? (categoryNames.get(transaction.category_id) ?? null)
      : (resolveCategory(transaction.category_raw, rules, categories)?.name ??
        transaction.category_raw),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl">Finance</h1>
          <p className="text-muted-foreground text-sm">
            Facturation, trésorerie et dépenses — miroir Airwallex.
          </p>
        </div>
        <SyncBanner lastRun={sync.last_run} canDecide={context.canDecide} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Facturation à venir</CardTitle>
          </CardHeader>
          <CardContent>
            <InvoicesBlock invoices={invoices} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trésorerie EUR</CardTitle>
          </CardHeader>
          <CardContent>
            <TreasuryBlock treasury={treasury} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Évolution du solde disponible</CardTitle>
        </CardHeader>
        <CardContent>
          <BalanceChart series={series} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dépenses</CardTitle>
        </CardHeader>
        <CardContent>
          <ExpensesTable
            rows={rows}
            total={expenses.total}
            page={expenses.page}
            pageCount={expenses.page_count}
            categories={categories}
          />
        </CardContent>
      </Card>
    </div>
  );
}
