import { Inbox } from "@/components/moderation/inbox";
import type { ClientChip } from "@/components/moderation/inbox-filter-bar";
import { requireViewer } from "@/lib/auth";
import { requireModeration } from "@/lib/moderation/access";
import {
  getConversationThread,
  getInboxCounters,
  listChannelConnections,
  listConversations,
  type InboxFilters,
} from "@/lib/moderation/queries";
import { isInboxView, isStatusGroup } from "@/lib/moderation/types";
import { signLogoUrls } from "@/lib/workspaces/logos";

/**
 * L'inbox croisée : tous les clients relevés, dans une seule boîte.
 *
 * Les filtres vivent dans l'URL en français — `?vue=`, `?client=`, `?statut=`,
 * `?nonlus=`, `?priorite=`, `?q=`, `?conv=` — et la vue par défaut est le
 * travail : tout ce qui attend une action, tous clients confondus.
 */

type Search = Promise<Record<string, string | undefined>>;

export default async function ModerationInboxPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const query = await searchParams;
  const [viewer, context] = await Promise.all([requireViewer(), requireModeration()]);

  const activeClient = context.clients.find(
    (candidate) => candidate.slug === query.client,
  );
  const view = query.vue && isInboxView(query.vue) ? query.vue : "tout";
  const statusGroup =
    query.statut && isStatusGroup(query.statut) ? query.statut : "a-traiter";

  const filters: InboxFilters = {
    view,
    clientId: activeClient?.id,
    statusGroup,
    unreadOnly: query.nonlus === "1",
    highPriorityOnly: query.priorite === "1",
    search: query.q,
  };

  // L'identité visuelle d'un client vient de son espace : même logo que le
  // rail, signé en un seul appel pour tous.
  const logoPathByWorkspace = new Map(
    viewer.workspaces.map((workspace) => [workspace.id, workspace.logo_url]),
  );
  const logoPaths = context.clients.map((client) =>
    client.workspace_id
      ? (logoPathByWorkspace.get(client.workspace_id) ?? null)
      : null,
  );

  /* Le fil part **en même temps** que la liste quand l'URL le nomme : c'était
     la lenteur ressentie entre deux conversations — la liste et les compteurs
     d'abord, le fil seulement ensuite, soit deux allers-retours en série pour
     un clic qui ne change que le volet de droite. */
  const [signedLogos, conversations, counters, connections, requestedThread] =
    await Promise.all([
      signLogoUrls(logoPaths),
      listConversations({ filters }),
      getInboxCounters({ view, clientId: activeClient?.id }),
      listChannelConnections(),
      query.conv ? getConversationThread(query.conv) : null,
    ]);

  const clients: ClientChip[] = context.clients.map((client) => {
    const path = client.workspace_id
      ? (logoPathByWorkspace.get(client.workspace_id) ?? null)
      : null;
    return {
      id: client.id,
      slug: client.slug,
      name: client.name,
      logoUrl: path ? (signedLogos.get(path) ?? null) : null,
    };
  });

  // La conversation ouverte vient de l'URL : un opérateur peut envoyer un lien
  // direct à un collègue, et le retour arrière fonctionne. Sans `?conv=`, on
  // ouvre la première de la liste — connue trop tard pour la course ci-dessus.
  const selectedId = query.conv ?? conversations[0]?.id ?? null;
  const thread =
    requestedThread ??
    (selectedId
      ? await getConversationThread(selectedId)
      : { conversation: null, messages: [], draft: null });

  return (
    <Inbox
      clients={clients}
      role={context.access.role}
      conversations={conversations}
      counters={counters}
      connections={connections}
      view={view}
      statusGroup={statusGroup}
      clientSlug={activeClient?.slug ?? null}
      unreadOnly={filters.unreadOnly ?? false}
      highPriorityOnly={filters.highPriorityOnly ?? false}
      search={query.q ?? ""}
      selectedId={selectedId}
      threadOpen={Boolean(query.conv)}
      thread={thread}
    />
  );
}
