import "server-only";

import { createClient } from "@/lib/supabase/server";
import { deriveCounters, type CounterRow, type InboxSelection } from "./counters";
import { sortForSegment } from "./sorting";
import { MODERATION_FLAGS, STATUS_GROUP_MEMBERS } from "./types";
import type {
  Conversation,
  ConversationKind,
  ConversationStatus,
  Draft,
  FaqCategory,
  FaqComment,
  FaqEntry,
  ModerationChannel,
  ModerationMessage,
} from "./types";

export type { InboxCounters } from "./counters";

/**
 * Lectures de l'inbox croisée.
 *
 * Toutes passent par le client porteur de la session : la RLS fait le
 * cloisonnement — sans filtre client, la liste rend **tous les clients que le
 * lecteur atteint**, et rien d'autre. C'est ce qui fait l'inbox multi-clients
 * de l'agence et, sans changer une ligne, l'inbox mono-client d'un
 * contributeur d'espace.
 */

/**
 * Ce que l'écran demande : la sélection des filtres, plus la recherche.
 *
 * La sélection est **exactement** celle du sélecteur de compteurs
 * (`InboxSelection`) : une seule définition pour ce qu'on compte et pour ce
 * qu'on liste, sinon un badge finit par annoncer autre chose que la liste.
 */
export type InboxFilters = InboxSelection & { search?: string };

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

  // Réseaux : une liste vide ne filtre rien — c'est « tous les réseaux »,
  // l'état par défaut de la rangée d'icônes.
  if (filters.networks.length > 0) query = query.in("channel", filters.networks);
  if (filters.dmOnly) query = query.eq("kind", "dm");
  if (filters.clientId) query = query.eq("client_id", filters.clientId);

  query = query.in("status", STATUS_GROUP_MEMBERS[filters.statusGroup]);

  /* Le spam ne s'affiche pas dans « À traiter ».
     L'ingestion archive désormais un fil dont tous les entrants sont du spam,
     mais elle ne juge que ce qui arrive : les fils relevés avant la règle
     gardent leur statut, et c'est là que le panneau se remplissait de
     « check my profile for free followers ». Le filtre de lecture ferme les
     deux cas d'un coup. Le fil n'est pas perdu — « Signalées » est fait pour
     ça, et le segment « Traitées » le garde une fois archivé. */
  if (filters.statusGroup === "a-traiter" && !filters.flaggedOnly) {
    query = query.not("flags", "cs", "{spam}");
  }

  if (filters.unreadOnly) query = query.eq("unread", true);
  /* « Signalées » lit les **drapeaux**, pas la priorité : le spam est archivé
     d'office sans monter en priorité, et il doit continuer de se retrouver
     ici. `overlaps` est le `&&` de Postgres — au moins un drapeau. */
  if (filters.flaggedOnly) query = query.overlaps("flags", MODERATION_FLAGS);
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

  /* L'ordre final se pose en mémoire : « fenêtre qui ferme aujourd'hui »
     mélange deux grandeurs — le canal et l'ancienneté — qu'un `order` SQL ne
     sait pas croiser sans colonne calculée. Le tri porte sur les 400 lignes
     déjà lues, ce qui est exactement ce que l'écran affiche. */
  return sortForSegment(
    (data ?? []) as unknown as Conversation[],
    options.filters.statusGroup,
  );
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

/**
 * Les compteurs de l'Inbox, en une lecture et une seule fonction.
 *
 * La lecture rapporte les colonnes de tri ; tout le reste est calculé par
 * `deriveCounters`, pur et testé, qui porte l'invariant : sans filtre posé, la
 * somme des réseaux et celle des clients valent le total affiché.
 *
 * La recherche plein texte est la seule dimension qui ne passe pas par là —
 * elle porte sur des colonnes de texte que les compteurs n'embarquent pas. Une
 * recherche active rend donc des badges qui parlent de la boîte, pas du
 * résultat : l'écran les efface plutôt que de les laisser mentir.
 */
export async function getInboxCounters(
  selection: InboxSelection,
): Promise<import("./counters").InboxCounters> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations")
    .select("client_id, channel, kind, status, unread, flags, last_message_at")
    .is("deleted_at", null);

  return deriveCounters((data ?? []) as unknown as CounterRow[], selection);
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
