import { Inbox } from "@/components/moderation/inbox";
import type { ClientChip } from "@/components/moderation/inbox-filter-bar";
import { requireViewer } from "@/lib/auth";
import { requireModeration } from "@/lib/moderation/access";
import { networksToShow } from "@/lib/moderation/counters";
import { parseInboxSelection, type InboxQuery } from "@/lib/moderation/filters";
import {
  getConversationThread,
  getInboxCounters,
  listChannelConnections,
  listConversations,
  type InboxFilters,
} from "@/lib/moderation/queries";
import { signLogoUrls } from "@/lib/workspaces/logos";

/**
 * L'Inbox croisée : tous les clients relevés, dans une seule boîte.
 *
 * Les filtres vivent dans l'URL en français — `?reseau=`, `?client=`,
 * `?statut=`, `?nonlus=`, `?signalees=`, `?mp=`, `?q=`, `?conv=` — et une
 * seule fonction les lit (`parseInboxSelection`), partagée avec « Tout lire ».
 */

type Search = Promise<Record<string, string | undefined>>;

export default async function InboxPage({ searchParams }: { searchParams: Search }) {
  const query = await searchParams;
  const [viewer, context] = await Promise.all([requireViewer(), requireModeration()]);

  const activeClient = context.clients.find(
    (candidate) => candidate.slug === query.client,
  );

  const inboxQuery: InboxQuery = {
    reseau: query.reseau,
    statut: query.statut,
    nonlus: query.nonlus,
    signalees: query.signalees,
    mp: query.mp,
    q: query.q,
  };
  const selection = parseInboxSelection(inboxQuery, activeClient?.id);
  const filters: InboxFilters = { ...selection, search: query.q };

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
      getInboxCounters(selection),
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
      /* Les réseaux affichés sont ceux que le module relève, plus ceux que les
         données contiennent — calculés sur les conversations chargées, donc
         jamais une icône qui n'a rien derrière. */
      networksShown={networksToShow(
        conversations.map((conversation) => ({
          client_id: conversation.client_id,
          channel: conversation.channel,
          kind: conversation.kind,
          status: conversation.status,
          unread: conversation.unread,
          flags: conversation.flags,
          last_message_at: conversation.last_message_at,
        })),
      )}
      connections={connections}
      selection={selection}
      query={inboxQuery}
      clientSlug={activeClient?.slug ?? null}
      search={query.q ?? ""}
      selectedId={selectedId}
      threadOpen={Boolean(query.conv)}
      thread={thread}
    />
  );
}
