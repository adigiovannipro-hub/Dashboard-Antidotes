import type { Metadata } from "next";
import { CalendarCheck, FileClock, Hourglass, Repeat } from "lucide-react";

import { StatCard, StatGrid } from "@/components/ds/stat-card";
import { Panel, PanelBody, PanelHeader, SectionHeader } from "@/components/ds/surface";
import { EngagementList } from "@/components/billing/engagement-list";
import { ForecastChart } from "@/components/billing/forecast-chart";
import type { BoardRow, InstallmentLine } from "@/components/billing/installment-row";
import { NewEngagementDialog } from "@/components/billing/new-engagement-dialog";
import { StageGroup } from "@/components/billing/stage-group";
import { requireFinanceAccess } from "@/lib/finance/access";
import { formatTotals, monthLabel } from "@/lib/billing/format";
import {
  addMonths,
  addTotals,
  billingForecast,
  currentMonth,
  scheduleKpis,
  stageOf,
  stageOfInvoice,
  totalsOf,
} from "@/lib/billing/schedule";
import {
  listEngagements,
  listInstallments,
  listKnownClients,
  listUnmatchedInvoices,
} from "@/lib/billing/queries";
import type { BillingInstallment } from "@/lib/billing/types";

export const metadata: Metadata = { title: "Échéances de facturation · Mon entreprise" };

/**
 * L'écran Échéances — le remplaçant du board Monday, groupes compris.
 *
 * Deux sources se rejoignent dans les mêmes groupes : les mensualités des
 * devis saisis à la main, et les factures Airwallex que le module Finance
 * synchronise déjà — même sans devis correspondant, elles s'affichent, parce
 * que l'écran doit montrer la facturation réelle. Un devis signé se saisit
 * une fois ; ses mensualités traversent ensuite les groupes toutes seules :
 * « Devis confirmé » tant que le mois de prestation court, « À facturer »
 * dès le 1er du mois suivant (dérivé de la date, pas d'un traitement),
 * « Facturée » puis « Payée » au rythme du rapprochement Airwallex horaire,
 * l'archivage au bout de deux mois. Les boutons des lignes ne sont que le
 * filet manuel.
 */
export default async function EcheancesPage() {
  const context = await requireFinanceAccess();

  const [engagements, living, archived, orphanInvoices, knownClients] = await Promise.all([
    listEngagements({ orgId: context.orgId }),
    listInstallments({ orgId: context.orgId }),
    listInstallments({ orgId: context.orgId, filters: { archived: true }, limit: 500 }),
    listUnmatchedInvoices({ orgId: context.orgId }),
    listKnownClients({ orgId: context.orgId }),
  ]);

  /* Les échéances s'aplatissent avec leur devis : le nom du client et le
     projet voyagent sur chaque ligne, plus de dictionnaire à trimballer. */
  const engagementById = new Map(engagements.map((engagement) => [engagement.id, engagement]));
  const toLine = (installment: BillingInstallment): InstallmentLine => ({
    ...installment,
    client: engagementById.get(installment.engagement_id)?.client_name ?? "—",
    project: engagementById.get(installment.engagement_id)?.label ?? "",
  });
  const lines = living.map(toLine);
  const archivedLines = archived.map(toLine);

  const now = new Date();

  const groups = {
    to_invoice: [] as BoardRow[],
    invoiced: [] as BoardRow[],
    paid: [] as BoardRow[],
    confirmed: [] as BoardRow[],
    archived: archivedLines.map<BoardRow>((line) => ({ kind: "installment", line })),
  };
  for (const line of lines) {
    const stage = stageOf(line, now);
    if (stage in groups) {
      groups[stage as keyof typeof groups].push({ kind: "installment", line });
    }
  }
  for (const invoice of orphanInvoices) {
    const stage = stageOfInvoice(invoice, now);
    if (stage) groups[stage].push({ kind: "invoice", invoice });
  }
  groups.invoiced.sort(byBoardDate);
  groups.paid.sort(byBoardDate);
  groups.archived.sort(byBoardDate);

  /* « Devis confirmé » montre le proche utile — les mensualités qui basculent
     dans les trois prochains mois — et compte le reste en pied de groupe. */
  const horizon = addMonths(currentMonth(now), 3);
  const confirmedLines = lines.filter((line) => stageOf(line, now) === "confirmed");
  const confirmedSoon = groups.confirmed.filter(
    (row) => row.kind === "installment" && row.line.issue_on <= horizon,
  );
  const confirmedLater = confirmedLines.filter((line) => line.issue_on > horizon);
  const lastPlanned = confirmedLines.at(-1);

  /* Les cartes du haut comptent les deux sources : ce qui attend un règlement
     et ce qui est entré ce mois-ci incluent les factures hors devis. */
  const kpis = scheduleKpis(living, now);
  const month = currentMonth(now).slice(0, 7);
  const orphanAwaiting = orphanInvoices.filter(
    (invoice) => stageOfInvoice(invoice, now) === "invoiced",
  );
  const orphanPaidThisMonth = orphanInvoices.filter(
    (invoice) => invoice.status === "paid" && invoice.paid_at?.slice(0, 7) === month,
  );
  const awaitingTotals = addTotals(kpis.awaitingPayment.totals, totalsOf(orphanAwaiting));
  const awaitingCount = kpis.awaitingPayment.count + orphanAwaiting.length;
  const paidMonthTotals = addTotals(kpis.paidThisMonth.totals, totalsOf(orphanPaidThisMonth));
  const paidMonthCount = kpis.paidThisMonth.count + orphanPaidThisMonth.length;

  const activeEngagements = engagements.filter((engagement) => engagement.status === "active");
  const monthlyRecurring = totalsOf(
    activeEngagements.map((engagement) => ({
      amount_cents: engagement.monthly_amount_cents,
      currency: engagement.currency,
    })),
  );

  /* Le détail d'un devis montre toute sa vie, mois archivés compris. */
  const linesByEngagement: Record<string, InstallmentLine[]> = {};
  for (const line of [...lines, ...archivedLines].sort((a, b) =>
    a.service_month.localeCompare(b.service_month),
  )) {
    (linesByEngagement[line.engagement_id] ??= []).push(line);
  }

  const nextSwitch = monthLabel(addMonths(currentMonth(now), 1));

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Échéances de facturation"
        description="Chaque devis signé engendre ses mensualités — et les factures Airwallex s'affichent même sans devis : l'écran montre la facturation réelle."
        action={
          context.canDecide ? <NewEngagementDialog knownClients={knownClients} /> : undefined
        }
      />

      <StatGrid>
        <StatCard
          label="À facturer"
          value={kpis.toInvoice.count > 0 ? formatTotals(kpis.toInvoice.totals) : "0 €"}
          context={
            kpis.toInvoice.count > 0
              ? `${kpis.toInvoice.count} facture${kpis.toInvoice.count > 1 ? "s" : ""} à émettre en HT`
              : "rien à émettre aujourd'hui"
          }
          tone={kpis.late.count > 0 ? "danger" : undefined}
          toneLabel={kpis.late.count > 0 ? `${kpis.late.count} en retard` : undefined}
          icon={FileClock}
        />
        <StatCard
          label="En attente de paiement"
          value={awaitingCount > 0 ? formatTotals(awaitingTotals) : "0 €"}
          context={`${awaitingCount} facture${awaitingCount > 1 ? "s" : ""} émise${awaitingCount > 1 ? "s" : ""}, Airwallex compris`}
          icon={Hourglass}
        />
        <StatCard
          label={`Encaissé en ${monthLabel(currentMonth(now)).split(" ")[0]}`}
          value={paidMonthCount > 0 ? formatTotals(paidMonthTotals) : "0 €"}
          context={`${paidMonthCount} paiement${paidMonthCount > 1 ? "s" : ""} reçu${paidMonthCount > 1 ? "s" : ""} ce mois-ci`}
          icon={CalendarCheck}
        />
        <StatCard
          label="Récurrent mensuel"
          value={activeEngagements.length > 0 ? formatTotals(monthlyRecurring) : "0 €"}
          context={`${activeEngagements.length} devis en cours, mensualité HT`}
          icon={Repeat}
        />
      </StatGrid>

      <Panel>
        <PanelHeader
          title="Prévisionnel"
          description="La facturation à venir, tirée des mensualités des devis signés — la courbe bouge à chaque devis ajouté ou ajusté, jamais avec les factures libres."
        />
        <PanelBody>
          <ForecastChart points={billingForecast(living, { months: 12, now })} />
        </PanelBody>
      </Panel>

      <StageGroup
        title="À facturer"
        tone="warning"
        description="Le mois de prestation est terminé : ces factures doivent partir. « Facturée » se coche seul dès qu'Airwallex voit la facture."
        stage="to_invoice"
        rows={groups.to_invoice}
        canDecide={context.canDecide}
        emptyText={`Rien à facturer aujourd'hui. La prochaine bascule aura lieu le 1er ${nextSwitch}.`}
      />

      <StageGroup
        title="Facturée"
        tone="info"
        description="Émises dans Airwallex — mensualités de devis ou factures libres — en attente du règlement client."
        stage="invoiced"
        rows={groups.invoiced}
        canDecide={context.canDecide}
        emptyText="Aucune facture en attente de règlement."
      />

      <StageGroup
        title="Payée"
        tone="positive"
        description="Encaissées ces deux derniers mois — ensuite, l'archivage descend les lignes tout seul."
        stage="paid"
        rows={groups.paid}
        canDecide={context.canDecide}
        emptyText="Aucun paiement récent."
        collapsible
      />

      <StageGroup
        title="Devis confirmé"
        tone="neutral"
        description="Les mensualités à venir : chacune passera « À facturer » le 1er du mois suivant sa prestation."
        stage="confirmed"
        rows={confirmedSoon}
        canDecide={context.canDecide}
        emptyText="Aucune mensualité planifiée. « Ajouter un devis » génère les prochaines."
        footnote={
          confirmedLater.length > 0 && lastPlanned
            ? `+ ${confirmedLater.length} mensualité${confirmedLater.length > 1 ? "s" : ""} planifiée${confirmedLater.length > 1 ? "s" : ""} jusqu'en ${monthLabel(lastPlanned.service_month)} — le détail vit dans chaque devis.`
            : undefined
        }
      />

      <EngagementList
        engagements={engagements}
        linesByEngagement={linesByEngagement}
        canDecide={context.canDecide}
      />

      {groups.archived.length > 0 ? (
        <StageGroup
          title="Archivé"
          tone="neutral"
          description="Payées et classées — les soixante jours passés, tout descend ici."
          stage="archived"
          rows={groups.archived}
          canDecide={context.canDecide}
          emptyText=""
          collapsible
          capped
        />
      ) : null}
    </div>
  );
}

/** La date de référence d'une rangée : jour prévu d'une mensualité, jour
    d'émission d'une facture — le board se lit dans l'ordre du calendrier. */
function boardDateOf(row: BoardRow): string {
  if (row.kind === "installment") return row.line.issue_on;
  return row.invoice.issued_on ?? row.invoice.paid_at?.slice(0, 10) ?? "9999-12-31";
}

function byBoardDate(a: BoardRow, b: BoardRow): number {
  return boardDateOf(a).localeCompare(boardDateOf(b));
}
