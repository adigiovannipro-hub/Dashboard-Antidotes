import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { CampaignForm } from "@/components/antidotes/campaign-form";
import { CampaignLaunch } from "@/components/antidotes/campaign-launch";
import { CampaignRuns } from "@/components/antidotes/campaign-runs";
import { RunFunnel } from "@/components/antidotes/run-funnel";
import { EmptyState } from "@/components/ds/empty-state";
import { Panel, PanelBody, PanelHeader, SectionHeader } from "@/components/ds/surface";
import { Button } from "@/components/ui/button";
import { requireAntidotesAccess } from "@/lib/antidotes/access";
import { getCampaignDetail } from "@/lib/antidotes/queries";
import { providerAvailability } from "@/lib/antidotes/sourcing/assemble";
import { campaignReadiness, resolveCampaignConfig } from "@/lib/antidotes/sourcing/config";
import { Radar } from "lucide-react";

type Params = Promise<{ campaign: string }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { campaign } = await params;
  return { title: `Campagne ${campaign.slice(0, 8)} · Antidotes` };
}

/**
 * Une campagne : ses réglages, son dernier taux de survie, l'historique de ses
 * passages. « Lancer » est en tête, avec ce qui l'empêche de partir quand il
 * manque quelque chose.
 */
export default async function CampaignPage({ params }: { params: Params }) {
  const { campaign: campaignId } = await params;
  if (!UUID.test(campaignId)) notFound();

  const context = await requireAntidotesAccess();
  const detail = await getCampaignDetail({ orgId: context.orgId, campaignId });
  if (!detail) notFound();

  const config = resolveCampaignConfig(detail.campaign);
  const missing = campaignReadiness(config);
  const latestRun = detail.runs[0] ?? null;
  const availability = providerAvailability();

  return (
    <div className="space-y-6">
      <div>
        <Button render={<Link href="/antidotes/outbound/sourcing" />} variant="ghost" size="sm">
          <ArrowLeft aria-hidden />
          Campagnes
        </Button>
      </div>

      {/* Le lancement passe sous le titre en dessous de `sm` : la pastille,
          la date et le bouton prenaient la moitié de l'écran et repliaient le
          nom de la campagne sur deux lignes. */}
      <SectionHeader
        title={detail.campaign.name}
        description={
          detail.campaign.reference_client
            ? `Miroir de ${detail.campaign.reference_client} · ${detail.prospect_count} prospect${detail.prospect_count > 1 ? "s" : ""}`
            : `${detail.prospect_count} prospect${detail.prospect_count > 1 ? "s" : ""}`
        }
        className="flex-wrap"
        action={
          <CampaignLaunch
            campaignId={detail.campaign.id}
            latestRun={latestRun}
            missing={missing}
            size="default"
          />
        }
      />

      {missing.length > 0 ? (
        <EmptyState icon={Radar} message={`Pour lancer la campagne, il manque ${missing.join(" et ")}.`} />
      ) : null}

      {latestRun ? (
        <Panel>
          <PanelHeader
            title="Dernier passage"
            action={
              <Button
                render={<Link href={`/antidotes/outbound/pipeline?campagne=${detail.campaign.id}`} />}
                variant="outline"
                size="sm"
              >
                Voir dans le pipeline
              </Button>
            }
          />
          <PanelBody>
            <RunFunnel stats={latestRun.stats} />
          </PanelBody>
        </Panel>
      ) : null}

      <CampaignForm campaign={detail.campaign} config={config} availability={availability} />

      {detail.runs.length > 0 ? (
        <Panel>
          <PanelHeader title="Passages" count={detail.runs.length} />
          <CampaignRuns runs={detail.runs} />
        </Panel>
      ) : null}
    </div>
  );
}
