import { redirect } from "next/navigation";
import { ListChecks, MessagesSquare, Send, Wallet } from "lucide-react";

import { AppShell } from "@/components/ds/app-shell";
import { StatCard, StatGrid } from "@/components/ds/stat-card";
import { SectionHeader } from "@/components/ds/surface";
import { ClientCard } from "@/components/mon-travail/client-card";
import { PublicationsSection } from "@/components/mon-travail/publications-section";
import { TasksSection } from "@/components/mon-travail/tasks-section";
import { WorkspaceCard } from "@/components/mon-travail/workspace-card";
import { buildCardModel } from "@/lib/production/card-model";
import { getProductionSnapshots } from "@/lib/production/queries";
import {
  redirectStudentToAcademy,
  requireViewer,
  roleLabel,
  type WorkspaceAccess,
} from "@/lib/auth";
import { dayLabel, addDays, todayInParis } from "@/lib/mon-travail/dates";
import { UPCOMING_DAYS, organizeTasks } from "@/lib/mon-travail/organize";
import {
  getOverview,
  NO_WORKSPACE_ACTIVITY,
  type WorkspaceStats,
} from "@/lib/mon-travail/overview";
import {
  listNextPublications,
  listOpenTasks,
  listPublicationsToDo,
} from "@/lib/mon-travail/queries";
import type { TaskWorkspace } from "@/lib/mon-travail/types";
import { formatMoney } from "@/lib/finance/money";
import { signLogoUrls } from "@/lib/workspaces/logos";
import { listReportingSlugs } from "@/lib/workspaces/queries";

/** Le filtre client, dans l'URL comme partout : `?client=bondet`. */
const CLIENT_PARAM = "client";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * La page d'accueil de mon espace : « Mon travail ».
 *
 * Quatre étages, du général au particulier — la bande de mesures pour savoir
 * en un regard si la journée tient, ce qui doit partir aujourd'hui, les
 * tâches, puis les espaces clients.
 *
 * Un client, lui, ne voit que ses espaces. Le module n'existe pas pour lui —
 * ni section vide, ni mention.
 */
export default async function HubPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const viewer = await requireViewer();

  // Une élève de l'Academy n'a ni espace ni outil : le hub lui montrerait une
  // page vide, qui se lit comme une panne. Elle rentre chez elle.
  redirectStudentToAcademy(viewer);

  // Un client n'a qu'un seul espace et aucun outil interne : lui présenter un
  // hub d'un seul élément serait une étape pour rien.
  if (viewer.workspaces.length === 1 && !viewer.isOwner) {
    redirect(`/espace/${viewer.workspaces[0]!.slug}`);
  }

  const today = todayInParis();
  const clientWorkspaces = viewer.workspaces.filter(
    (workspace) => workspace.type === "client",
  );
  // Signés en une fois pour tous les espaces : le helper est mis en cache par
  // requête, le rail vient d'appeler le même.
  const logos = await signLogoUrls(clientWorkspaces.map((w) => w.logo_url));
  // Le tableau de bord d'entrée de chaque espace, pour « Ouvrir le reporting ».
  // Une seule requête pour toutes les cartes.
  const reportings = await listReportingSlugs(clientWorkspaces.map((w) => w.id));

  // Un slug inconnu ne filtre rien plutôt que de vider la page : un lien
  // partagé après le renommage d'un espace doit rester lisible.
  const requested = (await searchParams)[CLIENT_PARAM];
  const selected =
    clientWorkspaces.find(
      (workspace) => workspace.slug === (Array.isArray(requested) ? requested[0] : requested),
    ) ?? null;

  const travail = viewer.isOwner
    ? await loadTravail(viewer.workspaces, today, selected?.id ?? null)
    : null;

  return (
    <AppShell
      viewer={viewer}
      title={travail ? "Mon travail" : "Espaces"}
      subtitle={travail ? dayLabel(today) : `${viewer.workspaces.length} espaces accessibles`}
    >
      <div className="space-y-8 pb-16">
        {travail ? (
          <>
            {/* La bande de mesures est globale, tous clients confondus : elle
                répond à « la journée tient-elle ? ». Le travail lui-même ne se
                filtre plus par client — les lignes s'entremêlent, et c'est la
                colonne Client de chaque tableau qui dit à qui elles sont. */}
            <StatGrid>
              <StatCard
                label="À publier"
                value={travail.stats.publications.today}
                context={
                  travail.stats.publications.publishedToday > 0
                    ? `${travail.stats.publications.publishedToday} déjà partie${travail.stats.publications.publishedToday > 1 ? "s" : ""} aujourd'hui`
                    : "aujourd'hui"
                }
                tone={travail.late > 0 ? "danger" : undefined}
                toneLabel={travail.late > 0 ? `${travail.late} en retard` : undefined}
                icon={Send}
              />
              <StatCard
                label="Inbox"
                value={travail.stats.moderation?.pending ?? null}
                context={
                  travail.stats.moderation
                    ? "conversations en attente"
                    : "aucun compte connecté"
                }
                tone={
                  travail.stats.moderation && travail.stats.moderation.pending > 0
                    ? "warning"
                    : undefined
                }
                toneLabel={
                  travail.stats.moderation && travail.stats.moderation.pending > 0
                    ? "à traiter"
                    : undefined
                }
                icon={MessagesSquare}
                href={travail.stats.moderation ? "/inbox" : undefined}
              />
              <StatCard
                label="Tâches ouvertes"
                value={travail.stats.tasks.open}
                context={
                  travail.stats.tasks.overdue === 0
                    ? "aucun retard"
                    : "toutes échéances confondues"
                }
                tone={travail.stats.tasks.overdue > 0 ? "danger" : undefined}
                toneLabel={
                  travail.stats.tasks.overdue > 0
                    ? `${travail.stats.tasks.overdue} en retard`
                    : undefined
                }
                icon={ListChecks}
              />
              <StatCard
                label="Factures émises"
                value={
                  travail.stats.invoices
                    ? formatMoney(travail.stats.invoices.pendingCents, "EUR")
                    : null
                }
                context={
                  travail.stats.invoices
                    ? `${travail.stats.invoices.count} en attente d'encaissement`
                    : "module Finance non amorcé"
                }
                tone={
                  travail.stats.invoices && travail.stats.invoices.overdue > 0
                    ? "danger"
                    : undefined
                }
                toneLabel={
                  travail.stats.invoices && travail.stats.invoices.overdue > 0
                    ? `${travail.stats.invoices.overdue} échue${travail.stats.invoices.overdue > 1 ? "s" : ""}`
                    : undefined
                }
                icon={Wallet}
                href={travail.stats.invoices ? "/entreprise/finance" : undefined}
              />
            </StatGrid>

            <PublicationsSection
              rows={travail.toPublish}
              next={travail.next}
              late={travail.late}
            />

            <TasksSection
              groups={travail.groups}
              today={travail.today}
              workspacesById={travail.workspacesById}
              clientWorkspaces={travail.clientWorkspaces}
              defaultWorkspaceId={selected?.id ?? null}
            />
          </>
        ) : null}

        {viewer.workspaces.length === 0 ? <EmptyState email={viewer.email} /> : null}

        {/* Seuls les espaces clients ont leur carte ici. « Mon entreprise » et
            « Perso » restent dans le rail : sur la page de travail, ils
            occupaient deux sections pour un lien chacun.

            Pour l'owner, la carte est le cockpit de production du mois —
            cycle de phases, mesures contextuelles, action IA. Pour un
            visiteur non owner, elle reste une carte de navigation : le cycle
            de production est un outil interne, il n'existe pas pour lui. */}
        {clientWorkspaces.length > 0 ? (
          <section className="space-y-4">
            <SectionHeader title="Clients" count={clientWorkspaces.length} />
            {/* `enter-stagger` : les cartes clients entrent l'une après
                l'autre au montage de la page. Voir `globals.css`. */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 enter-stagger">
              {clientWorkspaces.map((workspace) => {
                if (!travail) {
                  return (
                    <WorkspaceCard
                      key={workspace.id}
                      href={`/espace/${workspace.slug}`}
                      name={workspace.name}
                      roleLabel={roleLabel(workspace.role)}
                      accentColor={workspace.accent_color}
                      stats={null}
                    />
                  );
                }

                const stats =
                  travail.byWorkspace.get(workspace.id) ?? NO_WORKSPACE_ACTIVITY;
                const snapshot = travail.production.get(workspace.id);
                if (!snapshot) return null;

                return (
                  <ClientCard
                    key={workspace.id}
                    workspaceId={workspace.id}
                    slug={workspace.slug}
                    name={workspace.name}
                    accentColor={workspace.accent_color}
                    logoUrl={
                      workspace.logo_url ? (logos.get(workspace.logo_url) ?? null) : null
                    }
                    reportingHref={reportings.get(workspace.id) ?? null}
                    model={buildCardModel({
                      today: travail.today,
                      snapshot,
                      upcoming: stats.upcoming,
                      moderation: stats.moderation,
                      monthProgress: stats.monthProgress,
                    })}
                  />
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}


/** Tout ce que les sections « Mon travail » consomment, chargé d'un bloc. */
async function loadTravail(
  workspaces: WorkspaceAccess[],
  today: string,
  workspaceId: string | null,
) {
  const [toPublish, next, openTasks, overview, production] =
    await Promise.all([
      listPublicationsToDo({ until: today, workspaceId }),
      listNextPublications({ after: today, workspaceId, limit: 3 }),
      listOpenTasks({ until: addDays(today, UPCOMING_DAYS), workspaceId }),
      getOverview({
        today,
        isOwner: true,
        orgId: workspaces[0]?.org_id ?? null,
      }),
      getProductionSnapshots({
        workspaceIds: workspaces
          .filter((workspace) => workspace.type === "client")
          .map((workspace) => workspace.id),
        today,
      }),
    ]);

  const asTaskWorkspace = (workspace: WorkspaceAccess): TaskWorkspace => ({
    id: workspace.id,
    slug: workspace.slug,
    name: workspace.name,
    accent_color: workspace.accent_color,
  });

  return {
    today,
    stats: overview.stats,
    production,
    byWorkspace: overview.byWorkspace as Map<string, WorkspaceStats>,
    groups: organizeTasks(openTasks, today),
    toPublish,
    // Compté une fois ici, affiché par la bande de mesures et par le panneau.
    late: toPublish.filter(
      (row) => row.subject.scheduled_on !== null && row.subject.scheduled_on < today,
    ).length,
    next,
    workspacesById: Object.fromEntries(
      workspaces.map((workspace) => [workspace.id, asTaskWorkspace(workspace)]),
    ),
    clientWorkspaces: workspaces
      .filter((workspace) => workspace.type === "client")
      .map(asTaskWorkspace),
  };
}

function EmptyState({ email }: { email: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
      <p className="type-body text-text-secondary">
        Le compte <span className="font-medium text-text-primary">{email}</span>{" "}
        n&apos;a encore accès à aucun espace.
      </p>
      <p className="type-caption mt-1 text-text-secondary">
        Un accès doit être accordé à cette adresse depuis l&apos;administration.
      </p>
    </div>
  );
}
