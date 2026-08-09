import type { Metadata } from "next";
import { CalendarCheck, FileClock, Hourglass, Repeat } from "lucide-react";

import { StatCard, StatGrid } from "@/components/ds/stat-card";
import { SectionHeader } from "@/components/ds/surface";
import { EngagementList } from "@/components/billing/engagement-list";
import type { InstallmentLine } from "@/components/billing/installment-row";
import { NewEngagementDialog } from "@/components/billing/new-engagement-dialog";
import { StageGroup } from "@/components/billing/stage-group";
import { requireFinanceAccess } from "@/lib/finance/access";
import { formatTotals, monthLabel } from "@/lib/billing/format";
import {
  addMonths,
  currentMonth,
  scheduleKpis,
  stageOf,
  totalsOf,
} from "@/lib/billing/schedule";
import {
  listEngagements,
  listInstallments,
  listKnownClients,
} from "@/lib/billing/queries";
import type { BillingInstallment } from "@/lib/billing/types";

export const metadata: Metadata = { title: "Échéances de facturation · Mon entreprise" };

/**
 * L'écran Échéances — le remplaçant du board Monday, groupes compris.
 *
 * Un devis signé se saisit une fois ; ses mensualités traversent ensuite les
 * groupes toutes seules : « Devis confirmé » tant que le mois de prestation
 * court, « À facturer » dès le 1er du mois suivant (dérivé de la date, pas
 * d'un traitement), « Facturée » puis « Payée » au rythme du rapprochement
 * Airwallex horaire, l'archivage au bout de deux mois. Les boutons des
 * lignes ne sont que le filet manuel.
 */
export default async function EcheancesPage() {
  const context = await requireFinanceAccess();

  const [engagements, living, archived, knownClients] = await Promise.all([
    listEngagements({ orgId: context.orgId }),
    listInstallments({ orgId: context.orgId }),
    listInstallments({ orgId: context.orgId, filters: { archived: true }, limit: 100 }),
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
    to_invoice: [] as InstallmentLine[],
    invoiced: [] as InstallmentLine[],
    paid: [] as InstallmentLine[],
    confirmed: [] as InstallmentLine[],
  };
  for (const line of lines) {
    const stage = stageOf(line, now);
    if (stage in groups) groups[stage as keyof typeof groups].push(line);
  }

  /* « Devis confirmé » montre le proche utile — les mensualités qui basculent
     dans les trois prochains mois — et compte le reste en pied de groupe. */
  const horizon = addMonths(currentMonth(now), 3);
  const confirmedSoon = groups.confirmed.filter((line) => line.issue_on <= horizon);
  const confirmedLater = groups.confirmed.filter((line) => line.issue_on > horizon);
  const lastPlanned = groups.confirmed.at(-1);

  const kpis = scheduleKpis(living, now);
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
        description="Chaque devis signé engendre ses mensualités — à facturer le 1er du mois suivant la prestation, avancées par Airwallex."
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
          value={
            kpis.awaitingPayment.count > 0
              ? formatTotals(kpis.awaitingPayment.totals)
              : "0 €"
          }
          context={`${kpis.awaitingPayment.count} facture${kpis.awaitingPayment.count > 1 ? "s" : ""} émise${kpis.awaitingPayment.count > 1 ? "s" : ""}, en HT`}
          icon={Hourglass}
        />
        <StatCard
          label={`Encaissé en ${monthLabel(currentMonth(now)).split(" ")[0]}`}
          value={
            kpis.paidThisMonth.count > 0 ? formatTotals(kpis.paidThisMonth.totals) : "0 €"
          }
          context={`${kpis.paidThisMonth.count} paiement${kpis.paidThisMonth.count > 1 ? "s" : ""} reçu${kpis.paidThisMonth.count > 1 ? "s" : ""} ce mois-ci, en HT`}
          icon={CalendarCheck}
        />
        <StatCard
          label="Récurrent mensuel"
          value={activeEngagements.length > 0 ? formatTotals(monthlyRecurring) : "0 €"}
          context={`${activeEngagements.length} devis en cours, mensualité HT`}
          icon={Repeat}
        />
      </StatGrid>

      <StageGroup
        title="À facturer"
        tone="warning"
        description="Le mois de prestation est terminé : ces factures doivent partir. « Facturée » se coche seul dès qu'Airwallex voit la facture."
        stage="to_invoice"
        lines={groups.to_invoice}
        canDecide={context.canDecide}
        emptyText={`Rien à facturer aujourd'hui. La prochaine bascule aura lieu le 1er ${nextSwitch}.`}
      />

      <StageGroup
        title="Facturée"
        tone="info"
        description="Émises, en attente du règlement client — elles passeront « Payée » quand Airwallex le verra."
        stage="invoiced"
        lines={groups.invoiced}
        canDecide={context.canDecide}
        emptyText="Aucune facture en attente de règlement."
      />

      <StageGroup
        title="Payée"
        tone="positive"
        description="Encaissées ces deux derniers mois — ensuite, l'archivage descend les lignes tout seul."
        stage="paid"
        lines={groups.paid}
        canDecide={context.canDecide}
        emptyText="Aucun paiement récent."
        collapsible
      />

      <StageGroup
        title="Devis confirmé"
        tone="neutral"
        description="Les mensualités à venir : chacune passera « À facturer » le 1er du mois suivant sa prestation."
        stage="confirmed"
        lines={confirmedSoon}
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

      {archivedLines.length > 0 ? (
        <StageGroup
          title="Archivé"
          tone="neutral"
          description="Payées et classées — les soixante jours passés, tout descend ici."
          stage="archived"
          lines={archivedLines}
          canDecide={context.canDecide}
          emptyText=""
          collapsible
          capped
        />
      ) : null}
    </div>
  );
}
