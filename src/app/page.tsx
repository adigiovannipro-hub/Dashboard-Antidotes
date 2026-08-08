import { redirect } from "next/navigation";
import { ListChecks, MessagesSquare, Send, Wallet } from "lucide-react";

import { AppShell } from "@/components/ds/app-shell";
import { FilterPills, type FilterOption } from "@/components/ds/filter-pills";
import { StatCard, StatGrid } from "@/components/ds/stat-card";
import { SectionHeader } from "@/components/ds/surface";
import { ArchiveSection } from "@/components/mon-travail/archive-section";
import { PublicationsSection } from "@/components/mon-travail/publications-section";
import { TasksSection } from "@/components/mon-travail/tasks-section";
import { WorkspaceCard } from "@/components/mon-travail/workspace-card";
import { requireViewer, roleLabel, type WorkspaceAccess } from "@/lib/auth";
import { dayLabel, addDays, todayInParis } from "@/lib/mon-travail/dates";
import { UPCOMING_DAYS, organizeTasks } from "@/lib/mon-travail/organize";
import {
  getOverview,
  NO_WORKSPACE_ACTIVITY,
  type WorkspaceStats,
} from "@/lib/mon-travail/overview";
import {
  listArchivedTasks,
  listDayPublications,
  listNextPublications,
  listOpenTasks,
} from "@/lib/mon-travail/queries";
import type { TaskWorkspace } from "@/lib/mon-travail/types";
import { DONE_STATUSES } from "@/lib/planning/types";
import { formatMoney } from "@/lib/finance/money";

/** Le filtre client, dans l'URL comme partout : `?client=bondet`. */
const CLIENT_PARAM = "client";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * La page d'accueil de mon espace : « Mon travail ».
 *
 * Quatre étages, du général au particulier — la bande de mesures pour savoir
 * en un regard si la journée tient, ce qui doit partir aujourd'hui, les
 * tâches, puis les espaces clients. L'archivé attend en bas de page.
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

  // Un client n'a qu'un seul espace et aucun outil interne : lui présenter un
  // hub d'un seul élément serait une étape pour rien.
  if (viewer.workspaces.length === 1 && !viewer.isOwner) {
    redirect(`/espace/${viewer.workspaces[0]!.slug}`);
  }

  const today = todayInParis();
  const clientWorkspaces = viewer.workspaces.filter(
    (workspace) => workspace.type === "client",
  );

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
      {/* `pb-16` : l'archivé s'allume en montant dans la fenêtre, et la
          dernière ligne d'une page ne finit jamais d'y entrer — elle serait
          restée à 0,83 d'opacité, donc sous le seuil de contraste. Soixante
          pixels de fond de page lui laissent terminer sa course. */}
      <div className="space-y-8 pb-16">
        {travail ? (
          <>
            {/* La bande de mesures reste globale : elle répond à « la journée
                tient-elle ? », tous clients confondus. Le filtre ci-dessous
                cadre le travail lui-même. */}
            <StatGrid>
              <StatCard
                label="À publier"
                value={travail.stats.publications.today}
                context={
                  travail.stats.publications.publishedToday > 0
                    ? `${travail.stats.publications.publishedToday} déjà partie${travail.stats.publications.publishedToday > 1 ? "s" : ""} aujourd'hui`
                    : "aujourd'hui"
                }
                icon={Send}
              />
              <StatCard
                label="Modération"
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
                href={travail.stats.moderation ? "/moderation" : undefined}
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

            {clientWorkspaces.length > 1 ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="type-overline text-text-secondary">Client</span>
                <FilterPills
                  ariaLabel="Filtrer le travail par client"
                  current={selected?.slug ?? ""}
                  options={clientFilterOptions(clientWorkspaces)}
                />
              </div>
            ) : null}

            <PublicationsSection rows={travail.toPublish} next={travail.next} />

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
            occupaient deux sections pour un lien chacun. */}
        {clientWorkspaces.length > 0 ? (
          <section className="space-y-4">
            <SectionHeader title="Clients" count={clientWorkspaces.length} />
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {clientWorkspaces.map((workspace) => (
                <WorkspaceCard
                  key={workspace.id}
                  href={`/espace/${workspace.slug}`}
                  name={workspace.name}
                  roleLabel={roleLabel(workspace.role)}
                  accentColor={workspace.accent_color}
                  stats={
                    travail
                      ? (travail.byWorkspace.get(workspace.id) ?? NO_WORKSPACE_ACTIVITY)
                      : null
                  }
                />
              ))}
            </div>
          </section>
        ) : null}

        {travail ? (
          <ArchiveSection
            tasks={travail.archivedTasks}
            publications={travail.published}
            workspacesById={travail.workspacesById}
            clientWorkspaces={travail.clientWorkspaces}
          />
        ) : null}
      </div>
    </AppShell>
  );
}

/**
 * Les options du filtre client — un par espace, plus « Tous ».
 *
 * La liste se construit depuis les espaces accessibles : un client ajouté
 * demain apparaît sans qu'une constante soit touchée.
 */
function clientFilterOptions(workspaces: WorkspaceAccess[]): FilterOption[] {
  return [
    { value: "", label: "Tous", href: "/" },
    ...workspaces.map((workspace) => ({
      value: workspace.slug,
      label: workspace.name,
      href: `/?${CLIENT_PARAM}=${encodeURIComponent(workspace.slug)}`,
    })),
  ];
}

/** Tout ce que les sections « Mon travail » consomment, chargé d'un bloc. */
async function loadTravail(
  workspaces: WorkspaceAccess[],
  today: string,
  workspaceId: string | null,
) {
  const [publications, next, openTasks, archivedTasks, overview] = await Promise.all([
    listDayPublications({ day: today, workspaceId }),
    listNextPublications({ after: today, workspaceId, limit: 3 }),
    listOpenTasks({ until: addDays(today, UPCOMING_DAYS), workspaceId }),
    listArchivedTasks({ workspaceId }),
    getOverview({
      today,
      isOwner: true,
      orgId: workspaces[0]?.org_id ?? null,
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
    byWorkspace: overview.byWorkspace as Map<string, WorkspaceStats>,
    groups: organizeTasks(openTasks, today),
    // Ce qui est déjà parti rejoint l'archivé ; le reste est à vérifier.
    toPublish: publications.filter(
      (row) => !DONE_STATUSES.includes(row.subject.status),
    ),
    published: publications.filter((row) =>
      DONE_STATUSES.includes(row.subject.status),
    ),
    next,
    archivedTasks,
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
