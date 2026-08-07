import { cookies } from "next/headers";
import type { Metadata } from "next";
import { CreditCard, ReceiptText, TriangleAlert } from "lucide-react";

import { StatCard, StatGrid } from "@/components/ds/stat-card";
import { Panel, PanelBody, PanelHeader, SectionHeader } from "@/components/ds/surface";
import { BalanceChart } from "@/components/finance/balance-chart";
import { CashStatCard } from "@/components/finance/cash-stat-card";
import { ExpensesTable, type DisplayExpense } from "@/components/finance/expenses-table";
import { InvoicesBlock, type UpcomingLine } from "@/components/finance/invoices-block";
import { SyncBanner } from "@/components/finance/sync-banner";
import { listEngagements, listInstallments } from "@/lib/billing/queries";
import { addMonths, currentMonth, scheduleKpis } from "@/lib/billing/schedule";
import { requireFinanceAccess } from "@/lib/finance/access";
import { resolveCategory } from "@/lib/finance/categories";
import { formatMoney } from "@/lib/finance/money";
import { parseExpenseParams } from "@/lib/finance/params";
import {
  getBalanceSeries,
  getExpenseSeries,
  getExpenseSummary,
  getSyncOverview,
  getTreasury,
  listCategories,
  listCategoryRules,
  listExpenses,
} from "@/lib/finance/queries";
import { CASH_HIDDEN_COOKIE } from "@/lib/ui-preferences";

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

  const [
    treasury,
    series,
    spentSeries,
    engagements,
    installments,
    categories,
    rules,
    expenses,
    sync,
    summary,
    cookieStore,
  ] = await Promise.all([
    getTreasury(context.orgId),
    getBalanceSeries(context.orgId),
    getExpenseSeries(context.orgId),
    listEngagements({ orgId: context.orgId }),
    /* Les échéances du module Échéances, pas les factures synchronisées
       d'Airwallex : leurs noms de clients ne correspondaient pas. */
    listInstallments({
      orgId: context.orgId,
      filters: { statuses: ["pending", "issued"] },
      limit: 300,
    }),
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
    cookies(),
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

  const kpis = scheduleKpis(installments);
  const hasTreasury = treasury.accounts.length > 0;

  /* Le bloc « Facturation à venir » montre les trois prochains mois : ce qui
     est dû, ce qui vient. Chaque ligne porte le nom de son engagement. */
  const engagementNames = new Map(
    engagements.map((engagement) => [
      engagement.id,
      { client: engagement.client_name, label: engagement.label },
    ]),
  );
  const upcomingHorizon = addMonths(currentMonth(), 3);
  const upcoming: UpcomingLine[] = installments
    .filter((line) => line.status === "pending" && line.issue_on < upcomingHorizon)
    .map((line) => ({
      ...line,
      client_name: engagementNames.get(line.engagement_id)?.client ?? "—",
      engagement_label: engagementNames.get(line.engagement_id)?.label ?? "",
    }));

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Finance"
        description="Facturation, trésorerie et dépenses."
        action={<SyncBanner lastRun={sync.last_run} />}
      />

      <StatGrid>
        <CashStatCard
          value={hasTreasury ? formatMoney(treasury.total_cents, "EUR") : null}
          accountCount={treasury.accounts.length}
          initialHidden={cookieStore.get(CASH_HIDDEN_COOKIE)?.value === "1"}
        />
        <StatCard
          label="À facturer ce mois"
          value={
            kpis.thisMonth.count > 0 ? formatTotals(kpis.thisMonth.totals) : null
          }
          context={
            kpis.thisMonth.count > 0
              ? `${kpis.thisMonth.count} échéance${kpis.thisMonth.count > 1 ? "s" : ""} ce mois-ci`
              : "aucune échéance enregistrée"
          }
          icon={ReceiptText}
        />
        <StatCard
          label="En retard"
          value={kpis.late.count > 0 ? formatTotals(kpis.late.totals) : "0 €"}
          context={
            kpis.late.count > 0 ? "jour d'émission dépassé" : "rien en retard"
          }
          tone={kpis.late.count > 0 ? "danger" : undefined}
          toneLabel={kpis.late.count > 0 ? "à émettre" : undefined}
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
            description="Les échéances des trois prochains mois, client par client."
          />
          <PanelBody>
            <InvoicesBlock lines={upcoming} />
          </PanelBody>
        </Panel>

        {/* La courbe a pris la place de la carte « Trésorerie EUR », qui
            occupait une demi-largeur pour répéter un total déjà affiché dans
            la bande de mesures. Le détail par wallet manque à qui en a plus
            d'un ; ce n'est pas le cas ici, et une carte qui redit le chiffre
            d'à côté ne mérite pas sa surface. */}
        <Panel>
          <PanelHeader
            title="Solde et dépenses"
            description="Le disponible en vert, ce qui en sort en rouge."
          />
          <PanelBody>
            <BalanceChart series={series} expenses={spentSeries} />
          </PanelBody>
        </Panel>
      </div>

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
function formatTotals(totals: Record<string, number>): string {
  const entries = Object.entries(totals).filter(([, cents]) => cents !== 0);
  if (entries.length === 0) return formatMoney(0, "EUR");
  return entries
    .map(([currency, cents]) => formatMoney(cents, currency))
    .join(" + ");
}

