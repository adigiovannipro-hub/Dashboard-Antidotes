import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlugZap, TriangleAlert } from "lucide-react";

import { EmptyState } from "@/components/ds/empty-state";
import { ConversionsMenu } from "@/components/viz/conversions-menu";
import { MetaDashboard } from "@/components/viz/meta-dashboard";
import { MonthlyReport } from "@/components/production/monthly-report";
import { OrganicDashboard } from "@/components/viz/organic-dashboard";
import { RangePicker } from "@/components/viz/range-picker";
import { ReportingTabs } from "@/components/viz/reporting-tabs";
import { SyncButton } from "@/components/viz/sync-button";
import { getWorkspace } from "@/lib/auth";
import { getActiveContext } from "@/lib/context/queries";
import { formatDayFr } from "@/lib/format";
import {
  currentNetwork,
  providersForNetwork,
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
  sameRangeLastYear,
} from "@/lib/reporting/period";
import {
  getAdsData,
  getOrganicData,
  listReportingSources,
} from "@/lib/reporting/queries";
import { WebDashboard } from "@/components/viz/web-dashboard";
import { getWebData } from "@/lib/web/queries";
import { getClientReport } from "@/lib/production/queries";
import { listWorkspaceSocialLinks } from "@/lib/social/queries";
import { createClient } from "@/lib/supabase/server";
import { requirePageAccess } from "@/lib/workspaces/access";
import { COMPOSIO_TRANSITION_NOTE } from "@/lib/social/direct-connect";

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
  // ce qui manque. Le Site Web s'ouvre sur une propriété GA rattachée, pas
  // sur un compte social.
  const tabs = resolveReportingNetworks({
    contextNetworks: (context?.deliverables?.reseaux ?? []).map(
      (reseau) => reseau.nom,
    ),
    assignedKinds: links.map((link) => link.kind),
    hasWebSource: sources.some((source) => source.provider === "google_analytics"),
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
  const web =
    network === "site-web"
      ? await getWebData({ workspaceId: workspace.id, range })
      : null;

  // La période vit dans la carte héros, pas dans un en-tête : le nom de la
  // page est déjà dans la navigation, le redire coûtait une bande entière.
  // Le Site Web se compare à l'année N-1 — le trafic d'un site est
  // saisonnier, et c'est ce que faisait le rapport Looker de référence.
  const yearComparison = customRange
    ? "la même période un an plus tôt"
    : monthLabel(`${Number(month.slice(0, 4)) - 1}${month.slice(4)}`);
  const period = customRange
    ? {
        label: `du ${formatDayFr(customRange.from)} au ${formatDayFr(customRange.to)}`,
        comparison:
          network === "site-web" ? yearComparison : "la période précédente",
      }
    : {
        label: monthLabel(month),
        comparison:
          network === "site-web" ? yearComparison : monthLabel(previousMonth(month)),
      };

  const isOwner = workspace.role === "owner";
  // Seules les sources de l'onglet ouvert : l'erreur du Site Web n'a rien à
  // dire sur des chiffres Meta complets. Sans onglet, tout se dit — il n'y a
  // pas de chiffres à accuser.
  const failing = sources.filter(
    (source) =>
      source.last_error &&
      (network === null || providersForNetwork(network).includes(source.provider)),
  );

  /* La synthèse du mois, produite par la phase Reporting de la carte cockpit.
     Réservée au propriétaire — elle est écrite par un modèle et sert à
     préparer le point client, pas à le livrer. Elle n'existe que pour un mois
     entier : une plage libre n'a pas de bilan mensuel, et en afficher un
     laisserait croire qu'il porte sur la période affichée. */
  const report =
    isOwner && !customRange
      ? await getClientReport({ workspaceId: workspace.id, month: `${month}-01` })
      : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        {/* `basis-full` sous sm : les onglets défilent désormais au lieu de
            passer à la ligne, donc ils savent rétrécir — sans pleine largeur
            réservée, la rangée d'actions les écrasait à un filet. */}
        <div className="min-w-0 flex-1 max-sm:basis-full">
          {network ? (
            <ReportingTabs networks={tabs.networks} current={network} />
          ) : null}
        </div>
        {network ? (
          /* La rangée d'actions passe à la ligne : à trois boutons elle
             faisait 467 px pour 390 de large, et la page défilait
             horizontalement sur téléphone. `shrink-0` empêchait l'ajustement
             sans autoriser le retour à la ligne. */
          <div className="flex flex-wrap items-center justify-end gap-2">
            {/* Le réglage des conversions du client vit ici, replié : il ne
                concerne qu'un compte sur cinq et se touche deux fois par an —
                un panneau pleine largeur en faisait le sujet de l'écran. Le
                menu ne s'affiche pas du tout sans événement à régler. */}
            {network === "meta-ads" && ads ? (
              <ConversionsMenu
                workspaceSlug={workspace.slug}
                events={ads.customEvents}
                roles={ads.roles}
                isOwner={isOwner}
              />
            ) : null}
            {/* La collecte part du début de la période **de comparaison** :
                demander juillet sans juin rendrait tous les M-1 en N/A — et
                sur le Site Web, la comparaison vit un an en arrière. */}
            {isOwner ? (
              <SyncButton
                workspaceSlug={workspace.slug}
                du={
                  network === "site-web"
                    ? sameRangeLastYear(range).from
                    : previousRange(range).from
                }
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

      {report ? (
        <MonthlyReport report={report} monthLabel={monthLabel(month)} />
      ) : null}

      {network === "meta-ads" && ads?.hasData ? (
        <MetaDashboard
          adSets={ads.adSets}
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
      ) : network === "site-web" && web?.hasData ? (
        <WebDashboard data={web} period={period} />
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

  if (network === "site-web") {
    // La source du Site Web n'est pas un compte social : le geste n'est pas
    // le même, le message non plus.
    return tabs.manquants.includes(network)
      ? "Le Site Web est au contrat du client, mais aucune propriété Google Analytics n'est rattachée à cet espace. Le rattachement se fait par la passerelle Composio — voir docs/web-analytics-setup.md."
      : `La propriété Google Analytics est rattachée, mais aucune donnée n'est encore synchronisée pour ${period.label}. Le bouton Synchroniser lance la collecte.`;
  }

  if (network) {
    return tabs.manquants.includes(network)
      ? `${REPORTING_NETWORK_LABELS[network]} est au contrat du client, mais aucun compte ne lui est affecté. ${COMPOSIO_TRANSITION_NOTE}`
      : `${REPORTING_NETWORK_LABELS[network]} est branché, mais aucune donnée n'est encore synchronisée pour ${period.label}. Le bouton Synchroniser lance la collecte.`;
  }

  if (tabs.sansConnecteur.length > 0) {
    const noms = tabs.sansConnecteur.join(", ");
    return `Ce client est déclaré sur ${noms}. Le Reporting ne sait lire que Meta et le Site Web (Google Analytics) aujourd'hui, et ces réseaux-là n'ont pas encore de connecteur. Rien à réparer : c'est un chantier à venir.`;
  }

  return `Aucun réseau n'est déclaré aux livrables de ce client, et aucun compte ne lui est affecté. La déclaration se fait au Contexte. ${COMPOSIO_TRANSITION_NOTE}`;
}
