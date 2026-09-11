import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  ACTIONABLE_STATUSES,
  countsAsPending,
  MODERATION_FLAGS,
  STATUS_GROUP_MEMBERS,
  VIEW_ORDER,
  viewMatches,
} from "./types";
import type {
  Conversation,
  ConversationKind,
  ConversationStatus,
  Draft,
  FaqCategory,
  FaqComment,
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

/**
 * La requête filtrée, colonnes au choix.
 *
 * Une seule construction pour la liste affichée et pour le « Tout lire », qui
 * doit porter **exactement** sur ce que l'écran montre. Deux requêtes écrites
 * séparément divergeraient au premier filtre ajouté, et le bouton marquerait
 * alors comme lues des conversations qu'on n'a jamais vues.
 *
 * `columns` est une chaîne libre : postgrest-js ne sait plus typer le résultat,
 * d'où le `as unknown as` habituel chez l'appelant.
 */
function filteredConversations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: InboxFilters,
  columns: string,
) {
  let query = supabase.from("conversations").select(columns).is("deleted_at", null);

  const view = filters.view ?? "tout";
  if (view === "commentaires-instagram") {
    query = query.eq("channel", "instagram").eq("kind", "comment");
  } else if (view === "commentaires-facebook") {
    query = query.eq("channel", "facebook").eq("kind", "comment");
  } else if (view === "commentaires-youtube") {
    query = query.eq("channel", "youtube").eq("kind", "comment");
  } else if (view === "messages") {
    query = query.eq("kind", "dm");
  }

  if (filters.clientId) query = query.eq("client_id", filters.clientId);

  /* « Toutes » par défaut, et non « À traiter ».
     Le défaut d'un onglet de canal est déjà « Tout » ; ouvrir la Modération
     sur un sous-ensemble sans que rien dans l'URL ne le dise donnait une boîte
     qui paraissait vide alors qu'elle ne l'était pas. « À traiter » est
     désormais un paramètre explicite, « Toutes » l'URL nue. */
  const group = filters.statusGroup ?? "toutes";
  if (group !== "toutes") {
    query = query.in("status", STATUS_GROUP_MEMBERS[group]);
  }

  if (filters.unreadOnly) query = query.eq("unread", true);
  /* « Signalées » lit les **drapeaux**, pas la priorité : le spam est archivé
     d'office sans monter en priorité, et il doit continuer de se retrouver
     ici. `overlaps` est le `&&` de Postgres — au moins un drapeau. */
  if (filters.highPriorityOnly) query = query.overlaps("flags", MODERATION_FLAGS);
  if (filters.search) {
    query = query.or(
      `participant_handle.ilike.%${filters.search}%,excerpt.ilike.%${filters.search}%,post_excerpt.ilike.%${filters.search}%`,
    );
  }

  return query;
}

export async function listConversations(options: {
  filters: InboxFilters;
  limit?: number;
}): Promise<Conversation[]> {
  const supabase = await createClient();
  const { data } = await filteredConversations(supabase, options.filters, "*")
    .order("last_message_at", { ascending: false })
    // 400 et non 100 : à 100, une boîte chargée coupait des clients entiers
    // de la vue « Tout » — les plus anciens disparaissaient sans un mot.
    .limit(options.limit ?? 400);

  return (data ?? []) as unknown as Conversation[];
}

/** Le strict nécessaire pour marquer un fil lu et en prévenir la plateforme. */
export type UnreadConversationRow = {
  id: string;
  client_id: string;
  status: ConversationStatus;
  channel: ModerationChannel;
  kind: ConversationKind;
  connection_id: string | null;
  participant_external_id: string | null;
};

/**
 * Les conversations non lues du filtre courant — **toutes**, pas les 400
 * affichées.
 *
 * C'est la matière du bouton « Tout lire ». Le plafond est haut et non absent :
 * un nombre sans borne finirait par ne plus tenir dans une réponse, et un lot
 * de dix mille lignes se rejoue de toute façon au clic suivant.
 */
export async function listUnreadConversations(options: {
  filters: InboxFilters;
  limit?: number;
}): Promise<UnreadConversationRow[]> {
  const supabase = await createClient();
  const { data } = await filteredConversations(
    supabase,
    { ...options.filters, unreadOnly: true },
    "id, client_id, status, channel, kind, connection_id, participant_external_id",
  )
    .order("last_message_at", { ascending: false })
    .limit(options.limit ?? 5000);

  return (data ?? []) as unknown as UnreadConversationRow[];
}

export type InboxCounters = {
  /** À gérer dans le périmètre courant (onglet + client). */
  actionable: number;
  unread: number;
  /** Conversations portant au moins un drapeau — ce que « Signalées » montre. */
  flagged: number;
  /** Ancienneté du plus vieux message à gérer du périmètre, en heures. */
  oldestActionableHours: number | null;
  /** Badge de chaque onglet : le **non lu à traiter**, dans le client courant. */
  byView: Record<InboxView, number>;
  /** Badge de chaque client : le **non lu à traiter**, dans l'onglet courant. */
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
 *
 * Onglets et clients comptent le **non lu à traiter** (`countsAsPending`), la
 * même définition que la pastille du rail : les deux doivent rester d'accord.
 * Les statuts, eux, comptent l'effectif exact de leur propre filtre — c'est
 * leur rôle, et « À traiter » vaut alors pour la charge de travail, lue ou non.
 */
export async function getInboxCounters(options: {
  view?: InboxView;
  clientId?: string;
}): Promise<InboxCounters> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations")
    .select("client_id, channel, kind, status, unread, flags, last_message_at")
    .is("deleted_at", null);

  const rows = (data ?? []) as unknown as {
    client_id: string;
    channel: ModerationChannel;
    kind: ConversationKind;
    status: ConversationStatus;
    unread: boolean;
    flags: string[];
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
  let flagged = 0;
  let oldestActionable: number | null = null;

  for (const row of rows) {
    const actionableRow = ACTIONABLE_STATUSES.includes(row.status);
    /* Les badges disent le **non lu à traiter** — la même définition que la
       pastille du rail (`countsAsPending`). Sans l'état de lecture, marquer
       trois cents conversations comme lues ne changeait aucun chiffre : rien
       ne bougeait à l'écran, et le geste paraissait sans effet. */
    const pending = countsAsPending(row);
    const inView = viewMatches(view, row.channel, row.kind);
    const inClient = !options.clientId || row.client_id === options.clientId;

    if (pending && inClient) {
      for (const candidate of VIEW_ORDER) {
        if (viewMatches(candidate, row.channel, row.kind)) byView[candidate] += 1;
      }
    }
    if (pending && inView) {
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
    if (row.flags.length > 0) flagged += 1;
    if (actionableRow) {
      actionable += 1;
      const at = new Date(row.last_message_at).getTime();
      if (oldestActionable === null || at < oldestActionable) oldestActionable = at;
    }
  }

  return {
    actionable,
    unread,
    flagged,
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

/**
 * Les thèmes d'un client, dans l'ordre du board.
 *
 * Lus ici et non plus en ligne dans la page : la FAQ a maintenant son écran,
 * et l'éditeur d'étiquettes a besoin de la couleur en plus du nom.
 */
export async function listFaqCategories(clientId: string): Promise<FaqCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("faq_categories")
    .select("*")
    .eq("client_id", clientId)
    .order("position");
  return (data ?? []) as unknown as FaqCategory[];
}

/**
 * Les fils de discussion de toute la FAQ d'un client, d'un coup.
 *
 * Un appel par ligne ouverte ferait autant de requêtes que de clics : le
 * tableau charge tout, chaque ligne pioche le sien en mémoire — soixante-huit
 * entrées et quelques messages tiennent largement.
 */
export async function listFaqComments(clientId: string): Promise<FaqComment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("faq_comments")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at")
    .limit(1000);
  return (data ?? []) as unknown as FaqComment[];
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
