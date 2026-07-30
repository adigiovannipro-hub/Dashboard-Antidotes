import type { Metadata } from "next";

import { Inbox } from "@/components/moderation/inbox";
import { requireModerationClient } from "@/lib/moderation/access";
import {
  getConversationThread,
  getCounters,
  listConversations,
  type InboxFilters,
} from "@/lib/moderation/queries";
import type { ModerationChannel } from "@/lib/moderation/types";

type Params = Promise<{ client: string }>;
type Search = Promise<Record<string, string | undefined>>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { client: slug } = await params;
  const { client } = await requireModerationClient(slug);
  return { title: `Modération · ${client.name}` };
}

export default async function ModerationInboxPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { client: slug } = await params;
  const query = await searchParams;
  const { context, client } = await requireModerationClient(slug);

  const filters: InboxFilters = {
    channel: query.canal as ModerationChannel | undefined,
    status: query.statut,
    kind: query.type,
    unreadOnly: query.nonlus === "1",
    highPriorityOnly: query.priorite === "1",
    search: query.q,
  };

  const [conversations, counters] = await Promise.all([
    listConversations({ clientId: client.id, filters }),
    getCounters(client.id),
  ]);

  // La conversation ouverte vient de l'URL : un opérateur peut envoyer un lien
  // direct à un collègue, et le retour arrière fonctionne.
  const selectedId = query.conv ?? conversations[0]?.id ?? null;
  const thread = selectedId
    ? await getConversationThread(selectedId)
    : { conversation: null, messages: [], draft: null };

  return (
    <Inbox
      clients={context.clients}
      client={client}
      role={context.access.role}
      conversations={conversations}
      counters={counters}
      filters={filters}
      selectedId={selectedId}
      thread={thread}
    />
  );
}
