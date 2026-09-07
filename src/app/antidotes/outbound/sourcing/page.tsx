import Link from "next/link";
import type { Metadata } from "next";
import { Building2, MailCheck, Radar, UserSearch } from "lucide-react";

import { CampaignLaunch } from "@/components/antidotes/campaign-launch";
import { NewCampaignDialog } from "@/components/antidotes/new-campaign-dialog";
import { RunFunnel } from "@/components/antidotes/run-funnel";
import { EmptyState } from "@/components/ds/empty-state";
import { StatCard, StatGrid } from "@/components/ds/stat-card";
import { StatusPill } from "@/components/ds/status-pill";
import { Panel, PanelRows, SectionHeader } from "@/components/ds/surface";
import { requireAntidotesAccess } from "@/lib/antidotes/access";
import { listCampaigns } from "@/lib/antidotes/queries";
import { campaignReadiness, resolveCampaignConfig } from "@/lib/antidotes/sourcing/config";
import { completeRunStats } from "@/lib/antidotes/sourcing/funnel";
import { CAMPAIGN_ENGINE_LABELS } from "@/lib/antidotes/types";

export const metadata: Metadata = { title: "Sourcing · Antidotes" };

/**
 * Les campagnes de sourcing : un jeu de filtres nommé chacune, son dernier
 * passage et son taux de survie. La bande de mesures additionne les derniers
 * passages de toutes les campagnes — c'est le rendement de la machine, pas
 * celui d'une campagne.
 */
export default async function SourcingPage() {
  const context = await requireAntidotesAccess();
  const campaigns = await listCampaigns({ orgId: context.orgId });

  const totals = campaigns.reduce(
    (sum, campaign) => {
      const stats = completeRunStats(campaign.latest_run?.stats ?? campaign.stats);
      return {
        sourced: sum.sourced + stats.sourced,
        qualified: sum.qualified + stats.qualified + stats.to_review,
        contacts: sum.contacts + stats.contact_found,
        emails: sum.emails + stats.email_valid,
      };
    },
    { sourced: 0, qualified: 0, contacts: 0, emails: 0 },
  );
  const active = campaigns.filter((campaign) => campaign.is_active).length;

  return (
    <div className="space-y-6">
      <SectionHeader title="Sourcing" count={campaigns.length} action={<NewCampaignDialog />} />

      <StatGrid>
        <StatCard
          label="Sourcés"
          value={totals.sourced}
          context={`${active} campagne${active > 1 ? "s" : ""} active${active > 1 ? "s" : ""}`}
          icon={Radar}
        />
        <StatCard
          label="Qualifiés"
          value={totals.qualified}
          context={totals.sourced > 0 ? `${Math.round((totals.qualified / totals.sourced) * 100)} % des sourcés` : "derniers passages"}
          icon={Building2}
        />
        <StatCard
          label="Décideur trouvé"
          value={totals.contacts}
          context={totals.qualified > 0 ? `${Math.round((totals.contacts / totals.qualified) * 100)} % des qualifiés` : "derniers passages"}
          icon={UserSearch}
        />
        <StatCard
          label="Emails valides"
          value={totals.emails}
          context={totals.contacts > 0 ? `${Math.round((totals.emails / totals.contacts) * 100)} % des décideurs` : "derniers passages"}
          valueTone={totals.emails > 0 ? "accent" : undefined}
          icon={MailCheck}
        />
      </StatGrid>

      {campaigns.length === 0 ? (
        <EmptyState icon={Radar} message="Aucune campagne. La première se crée en trois choix." />
      ) : (
        <Panel>
          <PanelRows>
            {campaigns.map((campaign) => {
              const missing = campaignReadiness(resolveCampaignConfig(campaign));
              return (
                <div key={campaign.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/antidotes/outbound/sourcing/${campaign.id}`}
                        className="type-label focus-visible:ring-ring truncate rounded-sm text-text-primary hover:underline focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {campaign.name}
                      </Link>
                      <StatusPill tone="neutral" dot={false}>
                        {CAMPAIGN_ENGINE_LABELS[campaign.engine]}
                      </StatusPill>
                      {!campaign.is_active ? <StatusPill tone="neutral">Inactive</StatusPill> : null}
                    </div>
                    <p className="type-caption mt-1 text-text-secondary">
                      {campaign.reference_client ? `Miroir de ${campaign.reference_client} · ` : ""}
                      <Link
                        href={`/antidotes/outbound/pipeline?campagne=${campaign.id}`}
                        className="focus-visible:ring-ring rounded-sm hover:underline focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {campaign.prospect_count} prospect{campaign.prospect_count > 1 ? "s" : ""} dans le pipeline
                      </Link>
                    </p>
                  </div>
                  <RunFunnel stats={campaign.latest_run?.stats ?? campaign.stats} compact />
                  <CampaignLaunch campaignId={campaign.id} latestRun={campaign.latest_run} missing={missing} />
                </div>
              );
            })}
          </PanelRows>
        </Panel>
      )}
    </div>
  );
}
