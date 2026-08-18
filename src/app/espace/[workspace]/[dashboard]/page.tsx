import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlugZap, TriangleAlert } from "lucide-react";

import { EmptyState } from "@/components/ds/empty-state";
import { MetaDashboard } from "@/components/viz/meta-dashboard";
import { OrganicDashboard } from "@/components/viz/organic-dashboard";
import { RangePicker } from "@/components/viz/range-picker";
import { ReportingTabs } from "@/components/viz/reporting-tabs";
import { SyncButton } from "@/components/viz/sync-button";
import { getWorkspace } from "@/lib/auth";
import { getActiveContext } from "@/lib/context/queries";
import { formatDayFr } from "@/lib/format";
import {
  currentNetwork,
  REPORTING_NETWORK_LABELS,
  resolveReportingNetworks,
  type ReportingNetwork,
  // Le composant d'onglets porte déjà le nom `ReportingTabs` dans ce fichier.
  type ReportingTabs as ReportingNetworkTabs,
} from "@/lib/reporting/networks";
import {
  lastCompleteMonth,
  monthBounds,
  monthLabel,
  parseMonth,
  parseRange,
  previousMonth,
  previousRange,
} from "@/lib/reporting/period";
import {
  getAdsData,
  getOrganicData,
  listReportingSources,
} from "@/lib/reporting/queries";
import { listWorkspaceSocialLinks } from "@/lib/social/queries";
import { createClient } from "@/lib/supabase/server";
import { requirePageAccess } from "@/lib/workspaces/access";

type Params = Promise<{ workspace: string; dashboard: string }>;
type Query = Promise<{ reseau?: string; mois?: string; du?: string; au?: string }>;

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

  const [query, links, context, sources] = await Promise.all([
    searchParams,
    listWorkspaceSocialLinks(workspace.id),
    getActiveContext(workspace.id),
    listReportingSources(workspace.id),
  ]);

  // Les onglets se déduisent de ce qui est branché ; le Contexte sert à dire
  // ce qui manque.
  const tabs = resolveReportingNetworks({
    contextNetworks: (context?.deliverables?.reseaux ?? []).map(
      (reseau) => reseau.nom,
    ),
    assignedKinds: links.map((link) => link.kind),
  });
  const network = currentNetwork(tabs, query.reseau);

  // Le mois révolu par défaut : le 17 août, on lit juillet. La plage libre
  // prime — c'est le choix le plus explicite que l'URL puisse porter.
  const now = new Date();
  const month = parseMonth(query.mois, now) ?? lastCompleteMonth(now);
  const customRange = parseRange(query.du, query.au);
  const range = customRange ?? monthBounds(month);

  const ads =
    network === "meta-ads"
      ? await getAdsData({ workspaceId: workspace.id, range })
      : null;
  const organic =
    network === "instagram" || network === "facebook"
      ? await getOrganicData({ workspaceId: workspace.id, platform: network, range })
      : null;

  // La période vit dans la carte héros, pas dans un en-tête : le nom de la
  // page est déjà dans la navigation, le redire coûtait une bande entière.
  const period = customRange
    ? {
        label: `du ${formatDayFr(customRange.from)} au ${formatDayFr(customRange.to)}`,
        comparison: "la période précédente",
      }
    : {
        label: monthLabel(month),
        comparison: monthLabel(previousMonth(month)),
      };

  const isOwner = workspace.role === "owner";
  const failing = sources.filter((source) => source.last_error);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          {network ? (
            <ReportingTabs networks={tabs.networks} current={network} />
          ) : null}
        </div>
        {network ? (
          <div className="flex shrink-0 items-center gap-2">
            {/* La collecte part du début de la période **de comparaison** :
                demander juillet sans juin rendrait tous les M-1 en N/A. */}
            {isOwner ? (
              <SyncButton
                workspaceSlug={workspace.slug}
                du={previousRange(range).from}
              />
            ) : null}
            <RangePicker
              range={range}
              syncWorkspace={isOwner ? workspace.slug : undefined}
            />
          </div>
        ) : null}
      </div>

      {/* Une source en erreur se dit ici, avec sa cause : un écran vide
          inexpliqué ferait accuser les chiffres. */}
      {isOwner && failing.length > 0 ? (
        <div className="border-warning-ink/25 bg-warning-subtle/40 rounded-md border px-3 py-2">
          {failing.map((source) => (
            <p
              key={`${source.provider}-${source.display_name}`}
              className="type-caption text-warning-ink"
            >
              <TriangleAlert
                className="mr-1.5 inline size-3.5 align-[-2px]"
                strokeWidth={1.75}
                aria-hidden
              />
              {source.display_name ?? source.provider} : {source.last_error}
            </p>
          ))}
        </div>
      ) : null}

      {network === "meta-ads" && ads?.hasData ? (
        <MetaDashboard
          adSets={ads.adSets}
          customEvents={ads.customEvents}
          total={ads.total}
          previousTotal={ads.previousTotal}
          age={ads.age}
          gender={ads.gender}
          regions={ads.regions}
          followers={ads.followers}
          period={period}
        />
      ) : (network === "instagram" || network === "facebook") && organic?.hasData ? (
        <OrganicDashboard
          network={network}
          posts={organic.posts}
          total={organic.total}
          previousTotal={organic.previousTotal}
          followers={organic.followers}
          followersNow={organic.followersNow}
          period={period}
        />
      ) : (
        <EmptyState icon={PlugZap} message={emptyMessage({ network, tabs, period })} />
      )}
    </div>
  );
}

/**
 * Ce que dit l'écran quand il n'a rien à montrer.
 *
 * Quatre situations, et les confondre est ce qui faisait passer une
 * fonctionnalité absente pour une panne :
 *
 *   1. l'onglet est ouvert parce que le contrat le déclare, mais aucun compte
 *      n'est affecté — il reste un geste, et on dit lequel ;
 *   2. le compte est affecté, la période est simplement vide ;
 *   3. le client n'est déclaré que sur des réseaux qu'aucun connecteur ne
 *      sert — TikTok, LinkedIn — et l'écran le nomme au lieu de rester muet ;
 *   4. rien n'est déclaré nulle part.
 */
function emptyMessage(input: {
  network: ReportingNetwork | null;
  tabs: ReportingNetworkTabs;
  period: { label: string };
}): string {
  const { network, tabs, period } = input;

  if (network) {
    return tabs.manquants.includes(network)
      ? `${REPORTING_NETWORK_LABELS[network]} est au contrat du client, mais aucun compte ne lui est affecté — à faire depuis Connexions, sur le Planning.`
      : `${REPORTING_NETWORK_LABELS[network]} est branché, mais aucune donnée n'est encore synchronisée pour ${period.label}. Le bouton Synchroniser lance la collecte.`;
  }

  if (tabs.sansConnecteur.length > 0) {
    const noms = tabs.sansConnecteur.join(", ");
    return `Ce client est déclaré sur ${noms}. Le Reporting ne sait lire que Meta aujourd'hui — Instagram, Facebook et les campagnes — et ces réseaux-là n'ont pas encore de connecteur. Rien à réparer : c'est un chantier à venir.`;
  }

  return "Aucun réseau n'est déclaré aux livrables de ce client, et aucun compte ne lui est affecté. Les deux se règlent depuis le Contexte et depuis Connexions.";
}
