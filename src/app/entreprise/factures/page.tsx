import type { Metadata } from "next";
import { FileClock, Repeat, Send, TriangleAlert } from "lucide-react";

import { StatCard, StatGrid } from "@/components/ds/stat-card";
import { Panel, PanelBody, PanelHeader, SectionHeader } from "@/components/ds/surface";
import { EngagementList } from "@/components/billing/engagement-list";
import { ForecastChart } from "@/components/billing/forecast-chart";
import type { BoardRow, InstallmentLine } from "@/components/billing/installment-row";
import { NewEngagementDialog } from "@/components/billing/new-engagement-dialog";
import { StageGroup } from "@/components/billing/stage-group";
import { SyncBadge } from "@/components/finance/sync-badge";
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
  listInvoiceEmails,
  listKnownClients,
  listUnmatchedInvoices,
} from "@/lib/billing/queries";
import { getLastSyncRun } from "@/lib/finance/queries";
import type { BillingInstallment } from "@/lib/billing/types";

export const metadata: Metadata = { title: "Factures · Mon entreprise" };

/**
 * L'écran Factures — le remplaçant du board Monday, groupes compris.
 *
 * Deux sources se rejoignent dans les mêmes groupes : les mensualités des
 * devis saisis à la main, et les factures Airwallex que le module Finance
 * synchronise déjà — même sans devis correspondant, elles s'affichent, parce
 * que l'écran doit montrer la facturation réelle. Un devis signé se saisit
 * une fois ; ses mensualités traversent ensuite les groupes toutes seules :
 * « Facture confirmée » tant que le mois de prestation court, « À facturer »
 * dès le 1er du mois suivant (dérivé de la date, pas d'un traitement),
 * « Facturée » puis « Payée » au rythme du rapprochement Airwallex — que le
 * chargement de cette page relance quand il traîne, le passage programmé
 * étant un cron GitHub qui en laisse tomber près d'un sur deux.
 * Les boutons des lignes ne sont que le filet manuel.
 *
 * Depuis le 03/09/2026, l'écran n'observe plus : dès qu'un devis porte une
 * adresse de destinataire, sa facture se crée chez Airwallex au passage du
 * 1er, part au client avec son PDF, et se relance à J+31, J+46 et J+61 tant
 * qu'elle n'est pas payée (`src/lib/billing/envoi.ts`). Ce qui est parti se
 * lit sous le nom du client, sur la ligne.
 */
export default async function FacturesPage() {
  const context = await requireFinanceAccess();

  const [engagements, living, orphanInvoices, knownClients, emailsByInstallment, sync] =
    await Promise.all([
    listEngagements({ orgId: context.orgId }),
    listInstallments({ orgId: context.orgId }),
    listUnmatchedInvoices({ orgId: context.orgId }),
    listKnownClients({ orgId: context.orgId }),
    /* Ce qui est déjà parti chez les clients : la ligne le dit, sinon un
       client relancé trois fois et un client jamais contacté se ressemblent. */
    listInvoiceEmails({ orgId: context.orgId }),
    /* Le même journal que Finance, et c'est le point : les deux écrans lisent
       la même chaîne Airwallex — les factures rapprochées ici sortent de
       l'étape `invoices` de là-bas. Synchroniser d'un côté met les deux à
       jour. */
    getLastSyncRun(context.orgId),
  ]);

  /* Les échéances s'aplatissent avec leur devis : le nom du client et le
     projet voyagent sur chaque ligne, plus de dictionnaire à trimballer. */
  const engagementById = new Map(engagements.map((engagement) => [engagement.id, engagement]));
  const toLine = (installment: BillingInstallment): InstallmentLine => ({
    ...installment,
    client: engagementById.get(installment.engagement_id)?.client_name ?? "—",
    project: engagementById.get(installment.engagement_id)?.label ?? "",
    emails: emailsByInstallment[installment.id] ?? [],
  });
  const lines = living.map(toLine);

  const now = new Date();

  const groups = {
    to_invoice: [] as BoardRow[],
    invoiced: [] as BoardRow[],
    paid: [] as BoardRow[],
    confirmed: [] as BoardRow[],
  };
  for (const line of lines) {
    const stage = stageOf(line, now);
    if (stage in groups) {
      groups[stage as keyof typeof groups].push({ kind: "installment", line });
    }
  }
  for (const invoice of orphanInvoices) {
    const stage = stageOfInvoice(invoice);
    if (stage) groups[stage].push({ kind: "invoice", invoice });
  }
  /* « Facturée » se lit dans l'ordre d'émission — les premières parties en
     premier — et les retards de paiement descendent en bas du groupe. */
  groups.invoiced.sort((a, b) => {
    const lateGap = Number(isRowOverdue(a, now)) - Number(isRowOverdue(b, now));
    if (lateGap !== 0) return lateGap;
    return issuedDateOf(a).localeCompare(issuedDateOf(b));
  });
  /* Les payées, du plus récent au plus ancien : cent dix lignes d'histoire
     se lisent du dernier encaissement vers le premier. */
  groups.paid.sort((a, b) => byBoardDate(b, a));


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

  /* Le détail d'un devis montre toute sa vie, du premier mois au dernier. */
  const linesByEngagement: Record<string, InstallmentLine[]> = {};
  for (const line of [...lines].sort((a, b) =>
    a.service_month.localeCompare(b.service_month),
  )) {
    (linesByEngagement[line.engagement_id] ??= []).push(line);
  }

  const nextSwitch = monthLabel(addMonths(currentMonth(now), 1));

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Factures"
        description="Chaque devis signé engendre ses factures mensuelles : elles partent seules au client, se relancent tant qu'elles ne sont pas payées, et les factures émises hors devis s'affichent aussi."
        action={
          <div className="flex items-center gap-3">
            <SyncBadge
              lastRunAt={sync?.started_at ?? null}
              lastRunStatus={sync?.status ?? null}
              canTrigger={context.canDecide}
            />
            {context.canDecide ? (
              <NewEngagementDialog knownClients={knownClients} />
            ) : null}
          </div>
        }
      />

      <StatGrid>
        <StatCard
          label="À facturer"
          value={kpis.toInvoice.count > 0 ? formatTotals(kpis.toInvoice.totals) : "0 €"}
          context={
            kpis.toInvoice.count > 0
              ? `${kpis.toInvoice.count} facture${kpis.toInvoice.count > 1 ? "s" : ""} à émettre`
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
              ? `moyenne des ${forecastMonths} prochains mois aux devis`
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
        description="Tout ce qui est encaissé, du plus récent au plus ancien."
        stage="paid"
        rows={groups.paid}
        canDecide={context.canDecide}
        emptyText="Aucun paiement récent."
      />

      <StageGroup
        title="Facture confirmée"
        description="Les mensualités à venir : chacune passera « À facturer » le 1er du mois suivant sa prestation."
        stage="confirmed"
        rows={groups.confirmed}
        canDecide={context.canDecide}
        emptyText="Aucune mensualité planifiée. « Ajouter un devis » génère les prochaines."
        defaultOpen
      />

      <EngagementList
        engagements={engagements}
        linesByEngagement={linesByEngagement}
        canDecide={context.canDecide}
      />
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
