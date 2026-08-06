import type { Metadata } from "next";
import { CreditCard, Landmark, ReceiptText, TriangleAlert } from "lucide-react";

import { StatCard, StatGrid } from "@/components/ds/stat-card";
import { Panel, PanelBody, PanelHeader, SectionHeader } from "@/components/ds/surface";
import { BalanceChart } from "@/components/finance/balance-chart";
import { ExpensesTable, type DisplayExpense } from "@/components/finance/expenses-table";
import { InvoicesBlock } from "@/components/finance/invoices-block";
import { SyncBanner } from "@/components/finance/sync-banner";
import { TreasuryBlock } from "@/components/finance/treasury-block";
import { requireFinanceAccess } from "@/lib/finance/access";
import { resolveCategory } from "@/lib/finance/categories";
import { invoiceKpis } from "@/lib/finance/invoices";
import { formatMoney } from "@/lib/finance/money";
import { parseExpenseParams } from "@/lib/finance/params";
import {
  getBalanceSeries,
  getExpenseSummary,
  getSyncOverview,
  getTreasury,
  listCategories,
  listCategoryRules,
  listExpenses,
  listInvoices,
} from "@/lib/finance/queries";
import type { CurrencyTotals } from "@/lib/finance/invoices";

export const metadata: Metadata = { title: "Finance · Mon entreprise" };

type Search = Promise<Record<string, string | undefined>>;

/**
 * L'écran Finance.
 *
 * Une bande de mesures répond aux quatre questions qu'on se pose en ouvrant la
 * page — combien j'ai, combien doit rentrer, qui est en retard, combien j'ai
 * dépensé — puis les panneaux donnent le détail. Les indicateurs vivaient
 * auparavant à l'intérieur des blocs, où il fallait les chercher.
 *
 * Tout est lu depuis Supabase — jamais d'appel Airwallex au rendu. Ce que
 * l'écran montre est ce que la dernière synchronisation a laissé, et l'en-tête
 * dit de quand elle date.
 */
export default async function FinancePage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const context = await requireFinanceAccess();
  const params = parseExpenseParams(await searchParams);

  const [treasury, series, invoices, categories, rules, expenses, sync, summary] =
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
      getExpenseSummary(context.orgId),
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

  const kpis = invoiceKpis(invoices);
  const overdueCents = sumOf(kpis.overdue);
  const hasTreasury = treasury.accounts.length > 0;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Finance"
        description="Facturation, trésorerie et dépenses — miroir Airwallex."
        action={<SyncBanner lastRun={sync.last_run} canDecide={context.canDecide} />}
      />

      <StatGrid>
        <StatCard
          label="Disponible"
          value={hasTreasury ? formatMoney(treasury.total_cents, "EUR") : null}
          context={
            hasTreasury
              ? `${treasury.accounts.length} wallet${treasury.accounts.length > 1 ? "s" : ""} EUR`
              : "aucun compte synchronisé"
          }
          icon={Landmark}
        />
        <StatCard
          label="Attendu ce mois"
          value={
            invoices.length > 0 ? formatTotals(kpis.expected_this_month) : null
          }
          context={
            invoices.length > 0
              ? "factures émises, échéance ce mois"
              : "aucune facture synchronisée"
          }
          icon={ReceiptText}
        />
        <StatCard
          label="En retard"
          value={invoices.length > 0 ? formatTotals(kpis.overdue) : null}
          context={overdueCents > 0 ? "échéance dépassée" : "rien d'échu"}
          tone={overdueCents > 0 ? "danger" : undefined}
          toneLabel={overdueCents > 0 ? "à relancer" : undefined}
          icon={TriangleAlert}
        />
        <StatCard
          label="Dépensé ce mois"
          value={formatMoney(summary.month_billed_cents, "EUR")}
          context={`${summary.month_count} dépense${summary.month_count > 1 ? "s" : ""}`}
          tone={summary.missing_receipts > 0 ? "warning" : undefined}
          toneLabel={
            summary.missing_receipts > 0
              ? `${summary.missing_receipts} sans reçu`
              : undefined
          }
          icon={CreditCard}
        />
      </StatGrid>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Facturation à venir"
            description="Encours client par client, du plus proche au plus lointain."
          />
          <PanelBody>
            <InvoicesBlock invoices={invoices} />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Trésorerie EUR"
            description="Seuls les wallets en euros se totalisent."
          />
          <PanelBody>
            <TreasuryBlock treasury={treasury} />
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Évolution du solde disponible"
          description="Un instantané par heure, laissé par chaque passage de la synchronisation."
        />
        <PanelBody>
          <BalanceChart series={series} />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          title="Dépenses"
          count={expenses.total}
          description="Montant facturé par le commerçant, et ce qui a réellement quitté le wallet."
        />
        <PanelBody>
          <ExpensesTable
            rows={rows}
            total={expenses.total}
            page={expenses.page}
            pageCount={expenses.page_count}
            categories={categories}
          />
        </PanelBody>
      </Panel>
    </div>
  );
}

/* Une somme par devise, jointes par « + » : additionner des euros et des
   dollars dans un seul nombre serait une invention. */
function formatTotals(totals: CurrencyTotals): string {
  const entries = Object.entries(totals).filter(([, cents]) => cents !== 0);
  if (entries.length === 0) return formatMoney(0, "EUR");
  return entries
    .map(([currency, cents]) => formatMoney(cents, currency))
    .join(" + ");
}

function sumOf(totals: CurrencyTotals): number {
  return Object.values(totals).reduce((sum, cents) => sum + cents, 0);
}
