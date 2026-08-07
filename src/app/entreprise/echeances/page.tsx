import type { Metadata } from "next";
import { CalendarClock, FileClock, Landmark, TriangleAlert } from "lucide-react";

import { StatCard, StatGrid } from "@/components/ds/stat-card";
import { Panel, PanelBody, PanelHeader, SectionHeader } from "@/components/ds/surface";
import { DueList } from "@/components/billing/due-list";
import { EngagementsPanel } from "@/components/billing/engagements-panel";
import { IssuedHistory } from "@/components/billing/issued-history";
import { UpcomingByMonth } from "@/components/billing/upcoming-by-month";
import { requireFinanceAccess } from "@/lib/finance/access";
import { formatMoney } from "@/lib/finance/money";
import {
  addMonths,
  currentMonth,
  isDue,
  scheduleKpis,
  totalsOf,
  type CurrencyTotals,
} from "@/lib/billing/schedule";
import {
  listEngagements,
  listInstallments,
  listRecentIssued,
} from "@/lib/billing/queries";

export const metadata: Metadata = { title: "Échéances de facturation · Mon entreprise" };

/**
 * L'écran Échéances de facturation — le remplaçant du board Monday.
 *
 * Un devis signé se saisit une fois et engendre ses lignes mensuelles ; chaque
 * mois, l'écran met devant les yeux ce qui doit partir — la règle maison :
 * une prestation du mois N se facture le lendemain de la fin du mois N.
 *
 * Trois zones, du plus urgent au plus froid : ce qui doit partir maintenant,
 * ce qui vient ensuite mois par mois, puis les engagements eux-mêmes et
 * l'historique des factures émises.
 */
export default async function EcheancesPage() {
  const context = await requireFinanceAccess();

  const [engagements, pending, recent] = await Promise.all([
    listEngagements({ orgId: context.orgId }),
    listInstallments({
      orgId: context.orgId,
      filters: { statuses: ["pending"] },
      limit: 500,
    }),
    listRecentIssued({ orgId: context.orgId }),
  ]);

  const now = new Date();
  const kpis = scheduleKpis(pending, now);
  const due = pending.filter((installment) => isDue(installment, now));
  const upcoming = pending.filter((installment) => !isDue(installment, now));

  const active = engagements.filter((engagement) => engagement.status === "active");
  const monthlyRecurring = totalsOf(
    active.map((engagement) => ({
      amount_cents: engagement.monthly_amount_cents,
      currency: engagement.currency,
    })),
  );

  /* Un objet et non une `Map` : ces noms traversent la frontière serveur →
     client, et seuls les types sérialisables passent. */
  const engagementNames = Object.fromEntries(
    engagements.map((engagement) => [
      engagement.id,
      { client: engagement.client_name, label: engagement.label },
    ]),
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Échéances de facturation"
        description="Chaque devis signé engendre ses factures mensuelles — émises le lendemain de la fin du mois de prestation."
      />

      <StatGrid>
        <StatCard
          label="À émettre"
          value={kpis.due.count > 0 ? formatTotals(kpis.due.totals) : "0"}
          context={
            kpis.due.count > 0
              ? `${kpis.due.count} facture${kpis.due.count > 1 ? "s" : ""} à envoyer`
              : "rien à envoyer aujourd'hui"
          }
          tone={kpis.late.count > 0 ? "danger" : undefined}
          toneLabel={
            kpis.late.count > 0
              ? `${kpis.late.count} en retard`
              : undefined
          }
          icon={FileClock}
        />
        <StatCard
          label={`Facturation de ${monthLabel(currentMonth(now))}`}
          value={kpis.thisMonth.count > 0 ? formatTotals(kpis.thisMonth.totals) : "0 €"}
          context={`${kpis.thisMonth.count} échéance${kpis.thisMonth.count > 1 ? "s" : ""} ce mois-ci`}
          icon={CalendarClock}
        />
        <StatCard
          label="Récurrent mensuel"
          value={active.length > 0 ? formatTotals(monthlyRecurring) : "0 €"}
          context={`${active.length} engagement${active.length > 1 ? "s" : ""} en cours`}
          icon={Landmark}
        />
        <StatCard
          label="Mois suivant"
          value={formatTotals(
            totalsOf(
              upcoming.filter((line) => line.issue_on < addMonths(currentMonth(now), 2) && line.issue_on >= addMonths(currentMonth(now), 1)),
            ),
          )}
          context={`émission au 1er ${monthLabel(addMonths(currentMonth(now), 1))}`}
          icon={TriangleAlert}
        />
      </StatGrid>

      <Panel>
        <PanelHeader
          title="À émettre maintenant"
          count={due.length}
          description="Le jour d'émission est arrivé. Marquer « émise » une fois la facture envoyée."
        />
        <DueList installments={due} names={engagementNames} canDecide={context.canDecide} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Prochaines échéances"
            description="Mois par mois, sur les six prochains mois."
          />
          <PanelBody>
            <UpcomingByMonth installments={upcoming} names={engagementNames} />
          </PanelBody>
        </Panel>

        <EngagementsPanel engagements={engagements} canDecide={context.canDecide} />
      </div>

      <Panel>
        <PanelHeader
          title="Émises récemment"
          count={recent.length}
          description="Marquer « payée » à l'encaissement — le dashboard Finance suit."
        />
        <IssuedHistory
          installments={recent}
          names={engagementNames}
          canDecide={context.canDecide}
        />
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

const MONTH = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  timeZone: "UTC",
});

function monthLabel(isoMonth: string): string {
  const date = new Date(`${isoMonth}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return isoMonth;
  return MONTH.format(date);
}
