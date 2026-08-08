import { cookies } from "next/headers";
import type { Metadata } from "next";
import { CreditCard, ReceiptText, TriangleAlert } from "lucide-react";

import { FilterPills, type FilterOption } from "@/components/ds/filter-pills";
import { StatCard, StatGrid } from "@/components/ds/stat-card";
import { Panel, PanelBody, PanelHeader, SectionHeader } from "@/components/ds/surface";
import { FlowsChart } from "@/components/finance/flows-chart";
import { CashStatCard } from "@/components/finance/cash-stat-card";
import { ExpensesTable, type DisplayExpense } from "@/components/finance/expenses-table";
import { InvoicesBlock } from "@/components/finance/invoices-block";
import { SyncBanner } from "@/components/finance/sync-banner";
import { requireFinanceAccess } from "@/lib/finance/access";
import { resolveCategory } from "@/lib/finance/categories";
import { invoiceKpis } from "@/lib/finance/invoices";
import { formatMoney } from "@/lib/finance/money";
import { parseExpenseParams } from "@/lib/finance/params";
import { merchantKey } from "@/lib/finance/merchant-logo";
import {
  getDailyFlows,
  getExpenseSummary,
  getMonthlyFlows,
  getMerchantLogoUrls,
  getSyncOverview,
  getTreasury,
  listCategories,
  listCategoryRules,
  listExpenses,
  listInvoices,
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

  /* La trésorerie d'abord, seule : la courbe du solde est ancrée sur le
     disponible réel, elle ne peut pas se calculer avant de le connaître. */
  const treasury = await getTreasury(context.orgId);

  const [
    monthlyFlows,
    dailyFlows,
    invoices,
    categories,
    rules,
    expenses,
    sync,
    summary,
    cookieStore,
  ] = await Promise.all([
    getMonthlyFlows({
      orgId: context.orgId,
      balanceNowCents: treasury.total_cents,
    }),
    getDailyFlows({
      orgId: context.orgId,
      balanceNowCents: treasury.total_cents,
    }),
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
    getExpenseSummary(context.orgId, params.month),
    cookies(),
  ]);

  const categoryNames = new Map(
    categories.map((category) => [category.id, category.name]),
  );

  /* Les logos de la page courante seulement — vingt-cinq URL signées au plus,
     pas une par marchand de la base. */
  const logoUrls = await getMerchantLogoUrls(
    context.orgId,
    [...new Set(
      expenses.rows
        .map((transaction) => merchantKey(transaction.merchant ?? transaction.merchant_raw))
        .filter(Boolean),
    )],
  );

  const rows: DisplayExpense[] = expenses.rows.map((transaction) => ({
    ...transaction,
    category_label: transaction.category_id
      ? (categoryNames.get(transaction.category_id) ?? null)
      : (resolveCategory(
          {
            category_raw: transaction.category_raw,
            merchant: transaction.merchant ?? transaction.merchant_raw,
          },
          rules,
          categories,
        )?.name ?? transaction.category_raw),
    logo_url:
      logoUrls[merchantKey(transaction.merchant ?? transaction.merchant_raw)] ??
      null,
  }));

  /* Les indicateurs de facturation lisent le miroir Airwallex, la réalité
     comptable — les noms de clients sont ceux des vraies factures. Le module
     Échéances, lié dans le bloc, porte le prévisionnel. */
  const kpis = invoiceKpis(invoices);
  const hasTreasury = treasury.accounts.length > 0;

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
          label="Facturé ce mois"
          value={
            kpis.issued_this_month_count > 0
              ? formatTotals(kpis.issued_this_month)
              : formatMoney(0, "EUR")
          }
          context={
            kpis.issued_this_month_count > 0
              ? `${kpis.issued_this_month_count} facture${kpis.issued_this_month_count > 1 ? "s" : ""} émise${kpis.issued_this_month_count > 1 ? "s" : ""}`
              : "aucune facture émise ce mois-ci"
          }
          icon={ReceiptText}
        />
        {/* Orange et non rouge : une facture en retard attend une action de
            ma part — une relance — ce n'est pas encore un échec. */}
        <StatCard
          label="En retard"
          value={
            kpis.overdue_count > 0 ? formatTotals(kpis.overdue) : formatMoney(0, "EUR")
          }
          context={
            kpis.overdue_count > 0
              ? `${kpis.overdue_count} facture${kpis.overdue_count > 1 ? "s" : ""} impayée${kpis.overdue_count > 1 ? "s" : ""}, échéance dépassée`
              : "rien d'échu"
          }
          tone={kpis.overdue_count > 0 ? "warning" : undefined}
          toneLabel={kpis.overdue_count > 0 ? "à relancer" : undefined}
          valueTone={kpis.overdue_count > 0 ? "warning" : undefined}
          icon={TriangleAlert}
        />
        <StatCard
          label={`Dépensé en ${monthName(params.month ?? currentMonthParam())}`}
          value={formatMoney(summary.month_billed_cents, "EUR")}
          context={`${summary.month_count} dépense${summary.month_count > 1 ? "s" : ""}`}
          tone={summary.missing_receipts > 0 ? "danger" : undefined}
          toneLabel={
            summary.missing_receipts > 0
              ? `${summary.missing_receipts} sans reçu`
              : undefined
          }
          valueTone="danger"
          icon={CreditCard}
        />
      </StatGrid>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Facturation"
            description="L'encours réel Airwallex, client par client."
          />
          <PanelBody>
            <InvoicesBlock invoices={invoices} />
          </PanelBody>
        </Panel>

        {/* Le grand livre Airwallex remonte six mois d'historique dès la
            première synchronisation — contrairement à l'ancienne courbe du
            solde, qui ne pouvait se dessiner qu'au fil des instantanés
            horaires et restait vide des semaines. */}
        <Panel>
          <PanelHeader
            title="Entrées et sorties"
            description="Le solde du wallet en vert, ce qui en sort en rouge."
          />
          <PanelBody>
            <FlowsChart months={monthlyFlows} days={dailyFlows} />
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Dépenses"
          count={expenses.total}
          description="Montant facturé par le commerçant, et ce qui a réellement quitté le wallet."
          action={
            <FilterPills
              ariaLabel="Mois observé"
              options={monthOptions()}
              current={params.month ?? ""}
            />
          }
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

/* --- Sélecteur de mois ------------------------------------------------------
   Les trois derniers mois en pastilles, plus « Tout ». Le filtre vit dans
   l'URL (`?mois=2026-06`) : il se partage par lien et survit au retour
   arrière. Les pastilles effacent les bornes libres — deux filtres de période
   concurrents mentiraient sur ce que le tableau montre. */

function currentMonthParam(): string {
  return new Date().toISOString().slice(0, 7);
}

function monthOptions(): FilterOption[] {
  const now = new Date();
  const options: FilterOption[] = [];

  for (let back = 2; back >= 0; back -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const value = date.toISOString().slice(0, 7);
    options.push({
      value,
      label: monthName(value),
      href: `/entreprise/finance?mois=${value}`,
    });
  }

  options.push({ value: "", label: "Tout", href: "/entreprise/finance" });
  return options;
}

const MONTH_NAME = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  timeZone: "UTC",
});

function monthName(isoMonth: string): string {
  const date = new Date(`${isoMonth}-01T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return isoMonth;
  return MONTH_NAME.format(date);
}
