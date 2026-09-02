import { cookies } from "next/headers";
import type { Metadata } from "next";
import { CreditCard, ReceiptText, TriangleAlert } from "lucide-react";

import { FilterPills, type FilterOption } from "@/components/ds/filter-pills";
import { StatCard, StatGrid } from "@/components/ds/stat-card";
import { Panel, PanelBody, PanelHeader, SectionHeader } from "@/components/ds/surface";
import { FlowsChart } from "@/components/finance/flows-chart";
import {
  ReceiptsArchive,
  ReceiptsPanel,
  type ReceiptRow,
} from "@/components/finance/receipts-panel";
import { CashStatCard } from "@/components/finance/cash-stat-card";
import { CategoryDonut } from "@/components/finance/category-donut";
import { ExpensesTable, type DisplayExpense } from "@/components/finance/expenses-table";
import { InvoicesBlock } from "@/components/finance/invoices-block";
import { SyncBadge } from "@/components/finance/sync-badge";
import { requireFinanceAccess } from "@/lib/finance/access";
import { getReceiptsContext } from "@/lib/recus/access";
import { senderDomain } from "@/lib/recus/heuristics";
import type { ReceiptDocument } from "@/lib/recus/types";
import {
  listDocuments,
  listForwardedDocuments,
  listMerchantRules,
} from "@/lib/recus/queries";
import { buildExpenseBreakdown } from "@/lib/finance/breakdown";
import { resolveCategory } from "@/lib/finance/categories";
import { invoiceKpis } from "@/lib/finance/invoices";
import { formatMoney } from "@/lib/finance/money";
import { parseExpenseParams } from "@/lib/finance/params";
import { merchantKey } from "@/lib/finance/merchant-logo";
import { retrievalCellState } from "@/lib/finance/retrieval";
import {
  getDailyFlows,
  getExpenseSummary,
  getMonthlyFlows,
  getLastSyncRun,
  getMerchantLogoUrls,
  getTreasury,
  listCategories,
  listCategoryRules,
  listExpenses,
  listExpensesForBreakdown,
  listInvoices,
  listRetrievalSources,
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
 * dit de quand elle date — et en relance une au chargement quand elle traîne,
 * le passage programmé étant un cron GitHub qui en laisse tomber un sur deux.
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
    breakdownRows,
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
    /* Toutes les lignes du mois observé, pas la page : la répartition somme
       la période entière, le tableau n'en montre que vingt-cinq. */
    listExpensesForBreakdown({ orgId: context.orgId, month: params.month ?? null }),
    getLastSyncRun(context.orgId),
    getExpenseSummary(context.orgId, params.month),
    cookies(),
  ]);

  const categoryNames = new Map(
    categories.map((category) => [category.id, category.name]),
  );

  /* Les logos de la page courante seulement — vingt-cinq URL signées au plus,
     pas une par marchand de la base. */
  const [logoUrls, retrievalSources] = await Promise.all([
    getMerchantLogoUrls(
      context.orgId,
      [...new Set(
        expenses.rows
          .map((transaction) => merchantKey(transaction.merchant ?? transaction.merchant_raw))
          .filter(Boolean),
      )],
    ),
    /* Les fiches de récupération de factures, une par marchand : chaque ligne
       lit celle de son marchand, et le mois courant se juge ici, côté
       serveur — pas au rendu client, où il pourrait différer d'une heure. */
    listRetrievalSources(context.orgId),
  ]);
  const now = new Date();

  const rows: DisplayExpense[] = expenses.rows.map((transaction) => {
    const resolved = transaction.category_id
      ? null
      : resolveCategory(
          {
            category_raw: transaction.category_raw,
            merchant: transaction.merchant ?? transaction.merchant_raw,
          },
          rules,
          categories,
        );
    return {
      ...transaction,
      category_label: transaction.category_id
        ? (categoryNames.get(transaction.category_id) ?? null)
        : (resolved?.name ?? transaction.category_raw),
      /* Ce que le sélecteur de la ligne affiche : le rangement effectif,
         manuel ou résolu — jamais « Sans catégorie » sur une ligne rangée. */
      category_effective_id: transaction.category_id ?? resolved?.id ?? null,
      logo_url:
        logoUrls[merchantKey(transaction.merchant ?? transaction.merchant_raw)] ??
        null,
      retrieval: retrievalCellState(
        retrievalSources[merchantKey(transaction.merchant ?? transaction.merchant_raw)] ??
          null,
        now,
      ),
    };
  });

  /* La répartition range avec exactement les mêmes règles que le tableau. */
  const breakdown = buildExpenseBreakdown(breakdownRows, rules, categories);
  const breakdownPeriodLabel = params.month
    ? `en ${monthName(params.month)}`
    : "toute la période";

  /* Les indicateurs de facturation lisent le miroir Airwallex, la réalité
     comptable — les noms de clients sont ceux des vraies factures. Le module
     Échéances, lié dans le bloc, porte le prévisionnel. */
  const kpis = invoiceKpis(invoices);
  const hasTreasury = treasury.accounts.length > 0;

  /* Les reçus vivaient sur une page à eux, avec inbox, filtres et détail. Ils
     tiennent ici en un panneau : on ne vient pas « consulter ses reçus », on
     vient répondre à « est-ce que j'envoie cette pièce ? ». Lecture séparée du
     `Promise.all` ci-dessus : sans boîte connectée, il n'y a rien à afficher
     et rien à interroger. */
  const receipts = await loadReceipts();

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Finance"
        description="Facturation, trésorerie et dépenses."
        action={
          <SyncBadge
            lastRunAt={sync?.started_at ?? null}
            lastRunStatus={sync?.status ?? null}
            canTrigger={context.canDecide}
          />
        }
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
        <Panel className="flex flex-col">
          <PanelHeader
            title="Entrées et sorties"
            description="Le solde du wallet en vert, ce qui en sort en rouge."
          />
          {/* `flex-1` : la Facturation d'en face décide de la hauteur de la
              rangée, la courbe remplit la sienne au lieu de flotter sur 280 px
              au-dessus d'un vide. */}
          <PanelBody className="min-h-0 flex-1">
            <FlowsChart months={monthlyFlows} days={dailyFlows} />
          </PanelBody>
        </Panel>
      </div>

      {/* Les Reçus n'ont pas besoin d'une pleine largeur — une ligne par
          pièce, souvent une seule — et la répartition se lisait mal étirée :
          les montants de la légende partaient à un écran des libellés. Les
          deux se partagent la rangée ; sans boîte connectée, la répartition
          la prend en entier. */}
      <div className="grid gap-5 lg:grid-cols-5">
        {receipts ? (
          <Panel className="lg:col-span-2">
            <PanelHeader
              title="Reçus"
              count={receipts.rows.length}
              description="Les justificatifs reçus par mail, à envoyer à Airwallex."
              action={<ReceiptsArchive rows={receipts.archives} />}
            />
            <PanelBody>
              <ReceiptsPanel
                rows={receipts.rows}
                autoForwardOpen={receipts.autoForwardOpen}
                canDecide={receipts.canDecide}
              />
            </PanelBody>
          </Panel>
        ) : null}

        {/* La répartition suit le mois des pastilles du panneau Dépenses —
            même paramètre d'URL, le filtre pilote les deux d'un clic. */}
        <Panel className={receipts ? "lg:col-span-3" : "lg:col-span-5"}>
          <PanelHeader
            title="Répartition des dépenses"
            description={`Additionnées par catégorie, ${breakdownPeriodLabel} — le mois se choisit sur le panneau Dépenses.`}
          />
          <PanelBody>
            <CategoryDonut
              entries={breakdown.entries}
              totalCents={breakdown.total_cents}
              periodLabel={breakdownPeriodLabel}
            />
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
            canDecide={context.canDecide}
          />
        </PanelBody>
      </Panel>
    </div>
  );
}

/**
 * Les pièces qui demandent un geste, et de quoi les décider.
 *
 * `null` quand aucune boîte n'est connectée : le panneau disparaît alors,
 * plutôt que d'afficher une liste vide qui n'apprend rien.
 */
async function loadReceipts(): Promise<{
  rows: ReceiptRow[];
  archives: ReceiptDocument[];
  autoForwardOpen: boolean;
  canDecide: boolean;
} | null> {
  const context = await getReceiptsContext();
  if (!context || context.sources.length === 0) return null;

  const [documents, archives, merchantRules] = await Promise.all([
    listDocuments({ orgId: context.orgId, filters: { actionableOnly: true } }),
    listForwardedDocuments({ orgId: context.orgId, limit: 50 }),
    listMerchantRules(context.orgId),
  ]);

  const automated = new Set(
    merchantRules.filter((rule) => rule.auto_forward).map((rule) => rule.sender_domain),
  );

  return {
    rows: documents.map((document) => {
      const domain = senderDomain(document.from_email);
      return {
        ...document,
        sender_domain: domain,
        merchant_automated: automated.has(domain),
      };
    }),
    archives,
    autoForwardOpen: context.sources.some(
      (source) => source.settings.auto_forward.enabled,
    ),
    canDecide: context.canDecide,
  };
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
