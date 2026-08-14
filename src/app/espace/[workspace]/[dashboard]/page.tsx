import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlugZap } from "lucide-react";

import { EmptyState } from "@/components/ds/empty-state";
import { StatusPill } from "@/components/ds/status-pill";
import { SectionHeader } from "@/components/ds/surface";
import { MetaDashboard } from "@/components/viz/meta-dashboard";
import { ReportingTabs } from "@/components/viz/reporting-tabs";
import { getWorkspace } from "@/lib/auth";
import { getActiveContext } from "@/lib/context/queries";
import {
  BONDET_AD_SETS,
  BONDET_AGE,
  BONDET_FOLLOWERS,
  BONDET_GENDER,
  BONDET_PERIOD,
  BONDET_PREVIOUS_TOTAL,
  BONDET_REGIONS,
  BONDET_TOTAL,
} from "@/lib/demo/bondet";
import {
  currentNetwork,
  REPORTING_NETWORK_LABELS,
  REPORTING_NETWORK_SUBTITLES,
  resolveReportingNetworks,
} from "@/lib/reporting/networks";
import { listWorkspaceSocialLinks } from "@/lib/social/queries";
import { createClient } from "@/lib/supabase/server";
import { requirePageAccess } from "@/lib/workspaces/access";

type Params = Promise<{ workspace: string; dashboard: string }>;
type Query = Promise<{ reseau?: string }>;

async function load(params: Params) {
  const { workspace: workspaceSlug, dashboard: dashboardSlug } = await params;
  const workspace = await getWorkspace(workspaceSlug);
  if (!workspace) return null;

  const supabase = await createClient();
  const { data: dashboard } = await supabase
    .from("dashboards")
    .select("id, slug, name")
    .eq("workspace_id", workspace.id)
    .eq("slug", dashboardSlug)
    .maybeSingle();

  return dashboard ? { workspace, dashboard } : null;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const loaded = await load(params);
  if (!loaded) return { title: "Introuvable" };
  return { title: `${loaded.dashboard.name} · ${loaded.workspace.name}` };
}

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Query;
}) {
  const loaded = await load(params);
  if (!loaded) notFound();

  const { workspace, dashboard } = loaded;
  await requirePageAccess(workspace, dashboard.slug);

  const [query, links, context] = await Promise.all([
    searchParams,
    listWorkspaceSocialLinks(workspace.id),
    getActiveContext(workspace.id),
  ]);

  // Les onglets se déduisent de ce qui est branché, rangés dans l'ordre où le
  // Contexte déclare les réseaux du client.
  const tabs = resolveReportingNetworks({
    contextNetworks: (context?.deliverables?.reseaux ?? []).map(
      (reseau) => reseau.nom,
    ),
    assignedKinds: links.map((link) => link.kind),
  });
  const network = currentNetwork(tabs, query.reseau);

  // Aucune source n'est encore synchronisée : le payant tourne sur les données
  // de démonstration, calées sur le rapport Looker réel de juin 2026. Le
  // connecteur ne changera que l'origine des données, pas la forme.
  // Le dashboard s'appelait « meta » avant de devenir « reporting » : les deux
  // slugs sont acceptés le temps que la migration 0008 soit passée partout.
  const demoAds =
    workspace.slug === "bondet" &&
    (dashboard.slug === "reporting" || dashboard.slug === "meta");

  return (
    <div className="space-y-5">
      <SectionHeader
        title={dashboard.name}
        description={
          network
            ? REPORTING_NETWORK_SUBTITLES[network]
            : "Aucun compte branché sur cet espace."
        }
        action={
          network === "meta-ads" && demoAds ? (
            <StatusPill tone="info">Données de démonstration</StatusPill>
          ) : null
        }
      />

      {network ? (
        <ReportingTabs networks={tabs.networks} current={network} />
      ) : null}

      {network === "meta-ads" && demoAds ? (
        <MetaDashboard
          adSets={BONDET_AD_SETS}
          total={BONDET_TOTAL}
          previousTotal={BONDET_PREVIOUS_TOTAL}
          age={BONDET_AGE}
          gender={BONDET_GENDER}
          regions={BONDET_REGIONS}
          followers={BONDET_FOLLOWERS}
          period={BONDET_PERIOD}
        />
      ) : (
        <EmptyState
          icon={PlugZap}
          message={
            network
              ? `${REPORTING_NETWORK_LABELS[network]} est branché, mais aucune donnée n'a encore été synchronisée.`
              : tabs.manquants.length > 0
                ? `Le Contexte déclare ${tabs.manquants
                    .map((missing) => REPORTING_NETWORK_LABELS[missing])
                    .join(" et ")}, mais aucun compte n'est affecté à cet espace — à faire depuis Connexions, sur le Planning.`
                : "Aucune source de données n'est connectée à cet espace."
          }
        />
      )}
    </div>
  );
}
