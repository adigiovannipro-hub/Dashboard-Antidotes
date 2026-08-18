import { excerptOf } from "@/lib/moderation/ingest";
import type {
  IngestedAttachment,
  IngestedMessage,
  IngestedThread,
} from "@/lib/moderation/ingest";

/**
 * Traduction des conversations privées Graph vers le modèle de la Modération.
 *
 * Une conversation Messenger ou Instagram devient un fil `kind: "dm"` : même
 * modèle que les commentaires, donc même inbox, mêmes gestes, même envoi. La
 * seule différence est la **fenêtre de réponse de 24 h** que Meta impose à la
 * messagerie, calculée ailleurs (`response-window.ts`).
 *
 * Fonctions pures : le transport vit dans `graph.ts`, l'écriture en base dans
 * `moderation/sync.ts`.
 */

export type MetaMessagingParticipant = {
  id?: string;
  name?: string;
  username?: string;
  email?: string;
};

export type MetaMessageAttachment = {
  mime_type?: string;
  name?: string;
  image_data?: { url?: string; preview_url?: string };
  video_data?: { url?: string; preview_url?: string };
  file_url?: string;
};

export type MetaMessageRow = {
  id: string;
  message?: string;
  created_time?: string;
  from?: MetaMessagingParticipant;
  to?: { data?: MetaMessagingParticipant[] };
  attachments?: { data?: MetaMessageAttachment[] };
};

export type MetaConversationRow = {
  id: string;
  updated_time?: string;
  participants?: { data?: MetaMessagingParticipant[] };
  messages?: { data?: MetaMessageRow[] };
};

/** Normalise les horodatages Graph (`+0000`) en ISO strict. */
function toIso(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const time = Date.parse(value);
  return Number.isNaN(time) ? fallback : new Date(time).toISOString();
}

/**
 * Les pièces jointes d'un message privé.
 *
 * Une photo envoyée en DM arrive sans texte : sans ce champ, la bulle serait
 * vide. `preview_url` sert à l'affichage, l'URL pleine à l'ouverture.
 */
function toAttachments(
  attachments: MetaMessageAttachment[] | undefined,
): IngestedAttachment[] {
  return (attachments ?? []).flatMap((attachment) => {
    const image = attachment.image_data;
    const video = attachment.video_data;
    const url = image?.preview_url ?? image?.url ?? video?.preview_url ?? null;
    const href =
      image?.url ?? video?.url ?? attachment.file_url ?? image?.preview_url ?? null;
    if (!url && !href) return [];

    const type = video
      ? "video_inline"
      : image
        ? "photo"
        : (attachment.mime_type ?? "file");

    return [{ type, url, href, title: attachment.name ?? null }];
  });
}

/** Le nom lisible d'un interlocuteur, tel que Meta le rend. */
function participantName(participant: MetaMessagingParticipant | undefined): string | null {
  return participant?.username ?? participant?.name ?? null;
}

/**
 * Une conversation privée en fil normalisé.
 *
 * `brandIds` porte les identifiants de la marque — la Page **et** le compte
 * Instagram, car selon la plateforme Meta nomme l'expéditeur par l'un ou par
 * l'autre. Sans les deux, nos propres réponses passeraient pour des messages
 * entrants et la conversation resterait éternellement « à traiter ».
 *
 * Rend `null` quand rien n'est exploitable : conversation vide, ou tous les
 * messages venus de la marque (un envoi sans réponse n'est pas à modérer).
 */
export function conversationToThread(options: {
  conversation: MetaConversationRow;
  channel: "instagram" | "facebook";
  brandIds: readonly string[];
}): IngestedThread | null {
  const { conversation, channel } = options;
  const brand = new Set(options.brandIds.filter(Boolean));

  const fallbackDate = toIso(conversation.updated_time, new Date(0).toISOString());
  const rows = conversation.messages?.data ?? [];
  if (rows.length === 0) return null;

  const messages: IngestedMessage[] = rows.map((row) => ({
    externalId: row.id,
    authorExternalId: row.from?.id ?? null,
    authorHandle: participantName(row.from),
    authorAvatarUrl: null,
    attachments: toAttachments(row.attachments?.data),
    body: row.message ?? "",
    fromBrand: Boolean(row.from?.id && brand.has(row.from.id)),
    sentAt: toIso(row.created_time, fallbackDate),
  }));

  // Graph rend les messages du plus récent au plus ancien ; l'inbox les lit
  // dans l'ordre de la conversation.
  messages.sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt));

  const participant =
    (conversation.participants?.data ?? []).find(
      (candidate) => candidate.id && !brand.has(candidate.id),
    ) ?? messages.find((message) => !message.fromBrand);

  // Personne d'autre que la marque : rien à modérer.
  if (!participant) return null;

  const handle =
    "username" in participant || "name" in participant
      ? participantName(participant as MetaMessagingParticipant)
      : ((participant as IngestedMessage).authorHandle ?? null);
  const externalId =
    "id" in participant
      ? ((participant as MetaMessagingParticipant).id ?? null)
      : ((participant as IngestedMessage).authorExternalId ?? null);

  return {
    channel,
    kind: "dm",
    externalThreadId: conversation.id,
    participantExternalId: externalId,
    participantHandle: handle,
    participantAvatarUrl: null,
    // Un message privé ne commente aucune publication.
    post: null,
    messages,
  };
}

export function conversationsToThreads(options: {
  conversations: MetaConversationRow[];
  channel: "instagram" | "facebook";
  brandIds: readonly string[];
}): IngestedThread[] {
  return options.conversations.flatMap(
    (conversation) =>
      conversationToThread({
        conversation,
        channel: options.channel,
        brandIds: options.brandIds,
      }) ?? [],
  );
}

/** Réexporté pour l'inbox : un extrait de DM suit la même règle qu'ailleurs. */
export { excerptOf };
