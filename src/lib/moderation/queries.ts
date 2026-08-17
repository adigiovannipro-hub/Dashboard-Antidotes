import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  ACTIONABLE_STATUSES,
  STATUS_GROUP_MEMBERS,
  VIEW_ORDER,
  viewMatches,
} from "./types";
import type {
  Conversation,
  ConversationKind,
  ConversationStatus,
  Draft,
  FaqEntry,
  InboxView,
  ModerationChannel,
  ModerationMessage,
  StatusGroup,
} from "./types";

/**
 * Lectures de l'inbox croisée.
 *
 * Toutes passent par le client porteur de la session : la RLS fait le
 * cloisonnement — sans filtre client, la liste rend **tous les clients que le
 * lecteur atteint**, et rien d'autre. C'est ce qui fait l'inbox multi-clients
 * de l'agence et, sans changer une ligne, l'inbox mono-client d'un
 * contributeur d'espace.
 */

export type InboxFilters = {
  /** Onglet courant — « tout » par défaut. */
  view?: InboxView;
  /** Filtre client, résolu du slug de l'URL vers l'identifiant. */
  clientId?: string;
  /** Groupe de statuts — « à traiter » par défaut, décidé par la page. */
  statusGroup?: StatusGroup;
  unreadOnly?: boolean;
  highPriorityOnly?: boolean;
  search?: string;
};

export async function listConversations(options: {
  filters: InboxFilters;
  limit?: number;
}): Promise<Conversation[]> {
  const supabase = await createClient();
  let query = supabase
    .from("conversations")
    .select("*")
    .is("deleted_at", null)
    .order("last_message_at", { ascending: false })
    .limit(options.limit ?? 100);

  const { filters } = options;
  const view = filters.view ?? "tout";
  if (view === "commentaires-instagram") {
    query = query.eq("channel", "instagram").eq("kind", "comment");
  } else if (view === "commentaires-facebook") {
    query = query.eq("channel", "facebook").eq("kind", "comment");
  } else if (view === "messages") {
    query = query.eq("kind", "dm");
  }

  if (filters.clientId) query = query.eq("client_id", filters.clientId);

  const group = filters.statusGroup ?? "a-traiter";
  if (group !== "toutes") {
    query = query.in("status", STATUS_GROUP_MEMBERS[group]);
  }

  if (filters.unreadOnly) query = query.eq("unread", true);
  if (filters.highPriorityOnly) query = query.eq("priority", "high");
  if (filters.search) {
    query = query.or(
      `participant_handle.ilike.%${filters.search}%,excerpt.ilike.%${filters.search}%,post_excerpt.ilike.%${filters.search}%`,
    );
  }

  const { data } = await query;
  return (data ?? []) as unknown as Conversation[];
}

export type InboxCounters = {
  /** À gérer dans le périmètre courant (onglet + client). */
  actionable: number;
  unread: number;
  highPriority: number;
  /** Ancienneté du plus vieux message à gérer du périmètre, en heures. */
  oldestActionableHours: number | null;
  /** Badge de chaque onglet : l'actionnable, filtré par le client courant. */
  byView: Record<InboxView, number>;
  /** Badge de chaque client : l'actionnable, filtré par l'onglet courant. */
  byClient: Record<string, number>;
  /** Effectif de chaque groupe de statuts dans le périmètre courant. */
  byStatusGroup: Record<StatusGroup, number>;
};

/**
 * Compteurs de l'inbox, en une seule requête.
 *
 * Les badges se répondent : les onglets comptent dans le client choisi, les
 * clients comptent dans l'onglet choisi, les statuts comptent dans les deux.
 * C'est ce croisement qui rend la navigation honnête — un badge n'annonce
 * jamais des conversations que le clic ne montrera pas.
 */
export async function getInboxCounters(options: {
  view?: InboxView;
  clientId?: string;
}): Promise<InboxCounters> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations")
    .select("client_id, channel, kind, status, unread, priority, last_message_at")
    .is("deleted_at", null);

  const rows = (data ?? []) as unknown as {
    client_id: string;
    channel: ModerationChannel;
    kind: ConversationKind;
    status: ConversationStatus;
    unread: boolean;
    priority: string;
    last_message_at: string;
  }[];

  const view = options.view ?? "tout";
  const byView = Object.fromEntries(VIEW_ORDER.map((entry) => [entry, 0])) as Record<
    InboxView,
    number
  >;
  const byClient: Record<string, number> = {};
  const byStatusGroup: Record<StatusGroup, number> = {
    "a-traiter": 0,
    "en-attente": 0,
    traitees: 0,
    toutes: 0,
  };

  let actionable = 0;
  let unread = 0;
  let highPriority = 0;
  let oldestActionable: number | null = null;

  for (const row of rows) {
    const actionableRow = ACTIONABLE_STATUSES.includes(row.status);
    const inView = viewMatches(view, row.channel, row.kind);
    const inClient = !options.clientId || row.client_id === options.clientId;

    if (actionableRow && inClient) {
      for (const candidate of VIEW_ORDER) {
        if (viewMatches(candidate, row.channel, row.kind)) byView[candidate] += 1;
      }
    }
    if (actionableRow && inView) {
      byClient[row.client_id] = (byClient[row.client_id] ?? 0) + 1;
    }

    if (!inView || !inClient) continue;

    byStatusGroup.toutes += 1;
    if (STATUS_GROUP_MEMBERS["a-traiter"].includes(row.status)) {
      byStatusGroup["a-traiter"] += 1;
    } else if (STATUS_GROUP_MEMBERS["en-attente"].includes(row.status)) {
      byStatusGroup["en-attente"] += 1;
    } else {
      byStatusGroup.traitees += 1;
    }

    if (row.unread) unread += 1;
    if (row.priority === "high") highPriority += 1;
    if (actionableRow) {
      actionable += 1;
      const at = new Date(row.last_message_at).getTime();
      if (oldestActionable === null || at < oldestActionable) oldestActionable = at;
    }
  }

  return {
    actionable,
    unread,
    highPriority,
    oldestActionableHours:
      oldestActionable === null
        ? null
        : (Date.now() - oldestActionable) / (60 * 60 * 1000),
    byView,
    byClient,
    byStatusGroup,
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

/**
 * L'état des canaux relevés — pour l'en-tête de l'inbox : dernier passage et
 * erreurs à montrer, jamais de jeton (la table n'en porte pas).
 */
export type ChannelConnectionSummary = {
  id: string;
  client_id: string;
  channel: ModerationChannel;
  display_name: string | null;
  status: string;
  last_polled_at: string | null;
  last_error: string | null;
};

export async function listChannelConnections(): Promise<ChannelConnectionSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("channel_connections")
    .select("id, client_id, channel, display_name, status, last_polled_at, last_error")
    .order("last_polled_at", { ascending: false });
  return (data ?? []) as unknown as ChannelConnectionSummary[];
}
