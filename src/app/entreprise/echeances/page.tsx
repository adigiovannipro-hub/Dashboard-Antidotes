import type { Metadata } from "next";
import { FileClock, Repeat, Send, TriangleAlert } from "lucide-react";

import { StatCard, StatGrid } from "@/components/ds/stat-card";
import { Panel, PanelBody, PanelHeader, SectionHeader } from "@/components/ds/surface";
import { EngagementList } from "@/components/billing/engagement-list";
import { ForecastChart } from "@/components/billing/forecast-chart";
import type { BoardRow, InstallmentLine } from "@/components/billing/installment-row";
import { NewEngagementDialog } from "@/components/billing/new-engagement-dialog";
import { StageGroup } from "@/components/billing/stage-group";
import { requireFinanceAccess } from "@/lib/finance/access";
import { isOverdue } from "@/lib/finance/invoices";
import { formatMoney } from "@/lib/finance/money";
import { formatTotals, monthLabel } from "@/lib/billing/format";
import {
  addMonths,
  addTotals,
  billingForecast,
  currentMonth,
  forecastAverage,
  isPaymentOverdue,
  scheduleKpis,
  stageOf,
  stageOfInvoice,
  totalsOf,
  wasIssuedInMonth,
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
  /* « Facturée » se lit dans l'ordre d'émission — les premières parties en
     premier — et les retards de paiement descendent en bas du groupe. */
  groups.invoiced.sort((a, b) => {
    const lateGap = Number(isRowOverdue(a, now)) - Number(isRowOverdue(b, now));
    if (lateGap !== 0) return lateGap;
    return issuedDateOf(a).localeCompare(issuedDateOf(b));
  });
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

  /* Les cartes du haut : ce qui doit partir, ce qui est parti ce mois-ci face
     au prévu, ce qui traîne, et le loyer moyen des devis confirmés. */
  const kpis = scheduleKpis(living, now);
  const month = currentMonth(now).slice(0, 7);
  const forecast = billingForecast(living, { months: 12, now });

  const issuedMonthLines = lines.filter((line) => wasIssuedInMonth(line, month));
  const issuedMonthInvoices = orphanInvoices.filter(
    (invoice) => invoice.issued_on?.slice(0, 7) === month,
  );
  const issuedMonthTotals = addTotals(
    totalsOf(issuedMonthLines),
    totalsOf(issuedMonthInvoices),
  );
  const issuedMonthCount = issuedMonthLines.length + issuedMonthInvoices.length;
  const plannedThisMonth = forecast[0]?.amount_cents ?? 0;

  /* Le retard a deux visages : ce que je n'ai pas encore émis, et ce que le
     client n'a pas encore réglé — mensualités rapprochées et factures libres
     confondues, c'est le même argent qui manque. */
  const overdueInvoices = orphanInvoices.filter((invoice) => isOverdue(invoice, now));
  const overdueLines = lines.filter((line) => isPaymentOverdue(line, now));
  const lateTotals = addTotals(
    kpis.late.totals,
    addTotals(totalsOf(overdueInvoices), totalsOf(overdueLines)),
  );
  const unpaidCount = overdueInvoices.length + overdueLines.length;
  const lateCount = kpis.late.count + unpaidCount;

  const averageMonthly = forecastAverage(forecast);
  const forecastMonths = forecast.filter((point) => point.count > 0).length;

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
        description="Chaque devis signé engendre ses mensualités — et les factures émises hors devis s'affichent aussi : l'écran montre la facturation réelle."
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
          icon={FileClock}
        />
        <StatCard
          label={`Facturé en ${monthLabel(currentMonth(now)).split(" ")[0]}`}
          value={issuedMonthCount > 0 ? formatTotals(issuedMonthTotals) : "0 €"}
          context={
            plannedThisMonth > 0
              ? `sur ${formatMoney(plannedThisMonth, "EUR")} prévus aux devis ce mois-ci`
              : `${issuedMonthCount} facture${issuedMonthCount > 1 ? "s" : ""} émise${issuedMonthCount > 1 ? "s" : ""} ce mois-ci`
          }
          icon={Send}
        />
        <StatCard
          label="En retard"
          value={lateCount > 0 ? formatTotals(lateTotals) : "0 €"}
          valueTone={lateCount > 0 ? "warning" : undefined}
          context={
            lateCount > 0
              ? `${kpis.late.count} à émettre · ${unpaidCount} impayée${unpaidCount > 1 ? "s" : ""} échue${unpaidCount > 1 ? "s" : ""}`
              : "rien ne traîne"
          }
          icon={TriangleAlert}
        />
        <StatCard
          label="Récurrent mensuel"
          value={averageMonthly > 0 ? formatMoney(averageMonthly, "EUR") : "0 €"}
          context={
            forecastMonths > 0
              ? `moyenne HT des ${forecastMonths} prochains mois aux devis`
              : "aucun devis confirmé à venir"
          }
          icon={Repeat}
        />
      </StatGrid>

      <Panel>
        <PanelHeader
          title="Prévisionnel"
          description="La facturation à venir, tirée des mensualités des devis signés — la courbe bouge à chaque devis ajouté ou ajusté, jamais avec les factures libres."
        />
        <PanelBody>
          <ForecastChart points={forecast} />
        </PanelBody>
      </Panel>

      <StageGroup
        title="À facturer"
        description="Le mois de prestation est terminé : ces factures doivent partir. « Facturée » se coche seule à la synchronisation suivante."
        stage="to_invoice"
        rows={groups.to_invoice}
        canDecide={context.canDecide}
        emptyText={`Rien à facturer aujourd'hui. La prochaine bascule aura lieu le 1er ${nextSwitch}.`}
        defaultOpen
      />

      <StageGroup
        title="Facturée"
        description="Émises, en attente du règlement client — les premières parties en premier, les retards de paiement en bas."
        stage="invoiced"
        rows={groups.invoiced}
        canDecide={context.canDecide}
        emptyText="Aucune facture en attente de règlement."
        defaultOpen
      />

      <StageGroup
        title="Payée"
        description="Encaissées ces deux derniers mois — ensuite, l'archivage descend les lignes tout seul."
        stage="paid"
        rows={groups.paid}
        canDecide={context.canDecide}
        emptyText="Aucun paiement récent."
      />

      <StageGroup
        title="Devis confirmé"
        description="Les mensualités à venir : chacune passera « À facturer » le 1er du mois suivant sa prestation."
        stage="confirmed"
        rows={confirmedSoon}
        canDecide={context.canDecide}
        emptyText="Aucune mensualité planifiée. « Ajouter un devis » génère les prochaines."
        defaultOpen
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
          description="Payées et classées — les soixante jours passés, tout descend ici."
          stage="archived"
          rows={groups.archived}
          canDecide={context.canDecide}
          emptyText=""
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

/** La date d'émission réelle quand elle existe, le jour prévu sinon. */
function issuedDateOf(row: BoardRow): string {
  if (row.kind === "installment") {
    return row.line.issued_at?.slice(0, 10) ?? row.line.issue_on;
  }
  return row.invoice.issued_on ?? "9999-12-31";
}

/* Le retard de règlement se lit sur l'échéance de la facture : celle de la
   facture libre, ou celle que la mensualité rapprochée a rapatriée. */
function isRowOverdue(row: BoardRow, now: Date): boolean {
  return row.kind === "invoice"
    ? isOverdue(row.invoice, now)
    : isPaymentOverdue(row.line, now);
}
