import "server-only";

import { createClient } from "@/lib/supabase/server";
import { ACTIONABLE_STATUSES } from "./types";
import type {
  Conversation,
  Draft,
  FaqEntry,
  ModerationChannel,
  ModerationMessage,
} from "./types";

/**
 * Lectures de l'inbox.
 *
 * Toutes passent par le client porteur de la session : la RLS fait le
 * cloisonnement, il n'y a donc aucun `where client_id` défensif à ajouter — un
 * opérateur d'un autre client ne verrait rien même sans filtre.
 */

export type InboxFilters = {
  channel?: ModerationChannel;
  status?: string;
  kind?: string;
  unreadOnly?: boolean;
  highPriorityOnly?: boolean;
  search?: string;
};

export type ConversationListItem = Conversation & {
  latest_draft_status: string | null;
};

export async function listConversations(options: {
  clientId: string;
  filters: InboxFilters;
  limit?: number;
}): Promise<ConversationListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("conversations")
    .select("*")
    .eq("client_id", options.clientId)
    .is("deleted_at", null)
    .order("last_message_at", { ascending: false })
    .limit(options.limit ?? 100);

  const { filters } = options;
  if (filters.channel) query = query.eq("channel", filters.channel);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.kind) query = query.eq("kind", filters.kind);
  if (filters.unreadOnly) query = query.eq("unread", true);
  if (filters.highPriorityOnly) query = query.eq("priority", "high");
  if (filters.search) {
    query = query.or(
      `participant_handle.ilike.%${filters.search}%,excerpt.ilike.%${filters.search}%`,
    );
  }

  const { data } = await query;
  return ((data ?? []) as unknown as Conversation[]).map((conversation) => ({
    ...conversation,
    latest_draft_status: null,
  }));
}

export type InboxCounters = {
  /** Badge global « à gérer » : à traiter + en attente de validation + échecs. */
  actionable: number;
  byStatus: Record<string, number>;
  byChannel: Record<string, number>;
  snoozed: number;
  unread: number;
  highPriority: number;
  /** Ancienneté du plus vieux message non traité, en heures. */
  oldestActionableHours: number | null;
};

/**
 * Compteurs de l'inbox.
 *
 * Une seule requête plutôt qu'un `count` par pastille : sept allers-retours
 * pour afficher un en-tête serait absurde, et les volumes en jeu (quelques
 * milliers de lignes par client) tiennent largement en mémoire.
 */
export async function getCounters(clientId: string): Promise<InboxCounters> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations")
    .select("status, channel, unread, priority, last_message_at")
    .eq("client_id", clientId)
    .is("deleted_at", null);

  const rows = (data ?? []) as unknown as {
    status: string;
    channel: string;
    unread: boolean;
    priority: string;
    last_message_at: string;
  }[];

  const byStatus: Record<string, number> = {};
  const byChannel: Record<string, number> = {};
  let actionable = 0;
  let unread = 0;
  let highPriority = 0;
  let oldestActionable: number | null = null;

  for (const row of rows) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    if (row.unread) unread += 1;
    if (row.priority === "high") highPriority += 1;

    if (ACTIONABLE_STATUSES.includes(row.status as never)) {
      actionable += 1;
      // Le badge par canal ne compte que l'actionnable : afficher le total
      // ferait clignoter un canal où tout est déjà traité.
      byChannel[row.channel] = (byChannel[row.channel] ?? 0) + 1;
      const at = new Date(row.last_message_at).getTime();
      if (oldestActionable === null || at < oldestActionable) oldestActionable = at;
    }
  }

  return {
    actionable,
    byStatus,
    byChannel,
    snoozed: byStatus.snoozed ?? 0,
    unread,
    highPriority,
    oldestActionableHours:
      oldestActionable === null
        ? null
        : (Date.now() - oldestActionable) / (60 * 60 * 1000),
  };
}

export async function getConversationThread(conversationId: string): Promise<{
  conversation: Conversation | null;
  messages: ModerationMessage[];
  draft: Draft | null;
}> {
  const supabase = await createClient();

  const [{ data: conversation }, { data: messages }, { data: drafts }] =
    await Promise.all([
      supabase.from("conversations").select("*").eq("id", conversationId).maybeSingle(),
      supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("sent_at"),
      supabase
        .from("drafts")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

  return {
    conversation: (conversation as unknown as Conversation) ?? null,
    messages: (messages ?? []) as unknown as ModerationMessage[],
    draft: ((drafts ?? [])[0] as unknown as Draft) ?? null,
  };
}

export async function listFaqEntries(clientId: string): Promise<FaqEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("faq_entries")
    .select("*")
    .eq("client_id", clientId)
    .is("deleted_at", null)
    .order("question_canonical");
  return (data ?? []) as unknown as FaqEntry[];
}
