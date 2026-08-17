import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlugZap } from "lucide-react";

import { EmptyState } from "@/components/ds/empty-state";
import { StatusPill } from "@/components/ds/status-pill";
import { SectionHeader } from "@/components/ds/surface";
import { MetaDashboard } from "@/components/viz/meta-dashboard";
import { OrganicDashboard } from "@/components/viz/organic-dashboard";
import { RangePicker } from "@/components/viz/range-picker";
import { ReportingTabs } from "@/components/viz/reporting-tabs";
import { SyncButton } from "@/components/viz/sync-button";
import { getWorkspace } from "@/lib/auth";
import { getActiveContext } from "@/lib/context/queries";
import {
  BONDET_AD_SETS,
  BONDET_AGE,
  BONDET_FOLLOWERS,
  BONDET_GENDER,
  BONDET_PREVIOUS_TOTAL,
  BONDET_REGIONS,
  BONDET_TOTAL,
} from "@/lib/demo/bondet";
import { formatDayFr } from "@/lib/format";
import {
  currentNetwork,
  REPORTING_NETWORK_LABELS,
  REPORTING_NETWORK_SUBTITLES,
  resolveReportingNetworks,
} from "@/lib/reporting/networks";
import {
  lastCompleteMonth,
  monthBounds,
  monthLabel,
  parseMonth,
  parseRange,
  previousMonth,
} from "@/lib/reporting/period";
import { getAdsData, getOrganicData } from "@/lib/reporting/queries";
import { listWorkspaceSocialLinks } from "@/lib/social/queries";
import { createClient } from "@/lib/supabase/server";
import { requirePageAccess } from "@/lib/workspaces/access";

type Params = Promise<{ workspace: string; dashboard: string }>;
type Query = Promise<{ reseau?: string; mois?: string; du?: string; au?: string }>;

/** Le mois que couvre le jeu de démonstration Bondet. */
const DEMO_MONTH = "2026-06";

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

  // Le dashboard s'appelait « meta » avant de devenir « reporting » : les deux
  // slugs sont acceptés le temps que la migration 0008 soit passée partout.
  const demoAds =
    workspace.slug === "bondet" &&
    (dashboard.slug === "reporting" || dashboard.slug === "meta");

  // Les onglets se déduisent de ce qui est branché ; le Contexte sert à dire
  // ce qui manque.
  const tabs = resolveReportingNetworks({
    contextNetworks: (context?.deliverables?.reseaux ?? []).map(
      (reseau) => reseau.nom,
    ),
    assignedKinds: links.map((link) => link.kind),
  });
  const network = currentNetwork(tabs, query.reseau);

  // Le mois révolu par défaut : le 14 août, on lit juillet.
  const now = new Date();
  const requestedMonth = parseMonth(query.mois, now);
  // La plage libre prime sur le mois : c'est le choix le plus explicite que
  // l'URL puisse porter.
  const customRange = parseRange(query.du, query.au);
  let month = requestedMonth ?? lastCompleteMonth(now);
  let range = customRange ?? monthBounds(month);

  // Les données réelles d'abord : dès que le connecteur a rempli la base pour
  // la période, elles priment.
  const ads =
    network === "meta-ads"
      ? await getAdsData({ workspaceId: workspace.id, range })
      : null;
  const organic =
    network === "instagram" || network === "facebook"
      ? await getOrganicData({ workspaceId: workspace.id, platform: network, range })
      : null;

  // La démonstration ne survit qu'en repli : Bondet, aucune donnée réelle sur
  // le mois demandé, et un mois qui est — ou devient — juin 2026. Dès que la
  // synchronisation aura rempli juillet, c'est juillet réel qui s'ouvrira.
  const showDemo =
    network === "meta-ads" &&
    demoAds &&
    !ads?.hasData &&
    !customRange &&
    (requestedMonth ?? DEMO_MONTH) === DEMO_MONTH;
  if (showDemo) {
    month = DEMO_MONTH;
    range = monthBounds(DEMO_MONTH);
  }

  const period = customRange
    ? {
        label: `du ${formatDayFr(customRange.from)} au ${formatDayFr(customRange.to)}`,
        comparison: "la période précédente",
      }
    : {
        label: monthLabel(month),
        comparison: monthLabel(previousMonth(month)),
      };

  return (
    <div className="space-y-5">
      <SectionHeader
        title={dashboard.name}
        description={
          network
            ? `${period.label} · comparé à ${period.comparison} — ${REPORTING_NETWORK_SUBTITLES[network]}`
            : "Aucun compte branché sur cet espace."
        }
        action={
          <div className="flex items-center gap-2">
            {showDemo ? <StatusPill tone="info">Démonstration</StatusPill> : null}
            {network && workspace.role === "owner" ? (
              <SyncButton workspaceSlug={workspace.slug} />
            ) : null}
            {network ? <RangePicker range={range} /> : null}
          </div>
        }
      />

      {network ? (
        <ReportingTabs networks={tabs.networks} current={network} />
      ) : null}

      {network === "meta-ads" && ads?.hasData ? (
        <MetaDashboard
          adSets={ads.adSets}
          total={ads.total}
          previousTotal={ads.previousTotal}
          age={ads.age}
          gender={ads.gender}
          regions={ads.regions}
          followers={ads.followers.length > 0 ? ads.followers : BONDET_FOLLOWERS}
          period={period}
        />
      ) : showDemo ? (
        <MetaDashboard
          adSets={BONDET_AD_SETS}
          total={BONDET_TOTAL}
          previousTotal={BONDET_PREVIOUS_TOTAL}
          age={BONDET_AGE}
          gender={BONDET_GENDER}
          regions={BONDET_REGIONS}
          followers={BONDET_FOLLOWERS}
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
        <EmptyState
          icon={PlugZap}
          message={
            network === "meta-ads" && demoAds && !customRange
              ? `Aucune donnée synchronisée pour ${period.label} — le jeu de démonstration ne couvre que ${monthLabel(DEMO_MONTH)}. Synchroniser remplira les vrais chiffres.`
              : network
                ? `${REPORTING_NETWORK_LABELS[network]} est branché, mais aucune donnée n'a encore été synchronisée pour ${period.label}. Le bouton Synchroniser lance la collecte.`
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
