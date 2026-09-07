import { cookies } from "next/headers";
import type { Metadata } from "next";
import { Building2, Handshake, MessagesSquare, Trophy } from "lucide-react";

import { NewProspectDialog } from "@/components/antidotes/new-prospect-dialog";
import { PipelineScreen } from "@/components/antidotes/pipeline-screen";
import { StatCard, StatGrid } from "@/components/ds/stat-card";
import { SectionHeader } from "@/components/ds/surface";
import { requireAntidotesAccess } from "@/lib/antidotes/access";
import { applyPipelineFilters, parsePipelineParams } from "@/lib/antidotes/pipeline-params";
import { getProspectDetail, listPipelineProspects } from "@/lib/antidotes/queries";
import { listSequenceOptions } from "@/lib/antidotes/sequences/queries";
import { PIPELINE_VIEW_COOKIE, parsePipelineView } from "@/lib/ui-preferences";

export const metadata: Metadata = { title: "Pipeline · Antidotes" };

type Search = Promise<Record<string, string | string[] | undefined>>;

/**
 * Le pipeline outbound : où en est chaque prospect, quand on l'a contacté,
 * ce qui s'est dit.
 *
 * Le pipeline se lit entier, se filtre en mémoire, et les quatre mesures
 * comptent ce que les filtres laissent — un badge qui promettrait ce que le
 * tableau ne montre pas enverrait chercher quelque chose d'introuvable. Le
 * détail du prospect ouvert part **en même temps** que la liste quand l'URL
 * le nomme : un rechargement rouvre le panneau sans second aller-retour.
 */
export default async function PipelinePage({ searchParams }: { searchParams: Search }) {
  const [context, query, cookieStore] = await Promise.all([
    requireAntidotesAccess(),
    searchParams,
    cookies(),
  ]);
  const params = parsePipelineParams(query);

  const [{ prospects, facets }, detail, sequences] = await Promise.all([
    listPipelineProspects({ orgId: context.orgId }),
    params.prospectId
      ? getProspectDetail({ orgId: context.orgId, prospectId: params.prospectId })
      : Promise.resolve(null),
    listSequenceOptions({ orgId: context.orgId }),
  ]);

  const filtered = applyPipelineFilters(prospects, params.filters);
  const view = parsePipelineView(cookieStore.get(PIPELINE_VIEW_COOKIE)?.value);

  const count = (statuses: string[]) =>
    filtered.filter((row) => statuses.includes(row.status)).length;
  const withAds = filtered.filter((row) => row.ads_active).length;
  const toQualify = count(["to_qualify"]);
  const inConversation = count(["contacted", "replied", "meeting"]);
  const replied = count(["replied", "meeting"]);
  const won = count(["won"]);
  const lost = count(["lost"]);

  return (
    <div className="space-y-6">
      <SectionHeader title="Pipeline" count={filtered.length} action={<NewProspectDialog />} />

      <StatGrid>
        <StatCard
          label="Prospects"
          value={filtered.length}
          context={
            withAds > 0
              ? `${withAds} avec des pubs actives`
              : filtered.length > 0
                ? "aucune pub active repérée"
                : "aucun prospect"
          }
          icon={Building2}
        />
        <StatCard
          label="À qualifier"
          value={toQualify}
          context={toQualify > 0 ? "en attente de tri" : "rien à trier"}
          tone={toQualify > 0 ? "warning" : undefined}
          toneLabel={toQualify > 0 ? "à traiter" : undefined}
          icon={MessagesSquare}
        />
        <StatCard
          label="En conversation"
          value={inConversation}
          context={
            replied > 0
              ? `${replied} ${replied > 1 ? "ont" : "a"} répondu`
              : "contactés, sans réponse"
          }
          icon={Handshake}
        />
        <StatCard
          label="Gagnés"
          value={won}
          context={lost > 0 ? `${lost} perdu${lost > 1 ? "s" : ""}` : "aucun perdu"}
          valueTone={won > 0 ? "accent" : undefined}
          icon={Trophy}
        />
      </StatGrid>

      <PipelineScreen
        prospects={filtered}
        total={prospects.length}
        facets={facets}
        filters={params.filters}
        view={view}
        detail={detail}
        selectedId={params.prospectId}
        sequences={sequences}
      />
    </div>
  );
}
