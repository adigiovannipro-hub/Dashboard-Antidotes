import { triageMessage } from "./triage";
import type {
  ConversationKind,
  ConversationPriority,
  ConversationStatus,
  ModerationChannel,
  ModerationFlag,
  SupportedLocale,
} from "./types";

/**
 * Modèle normalisé de l'ingestion, et fusion avec l'état de l'inbox.
 *
 * Un connecteur (Meta aujourd'hui, TikTok demain) traduit sa plateforme vers
 * `IngestedThread` ; ici vit la seule logique produit : que devient une
 * conversation quand un passage de synchronisation la revoit ? Fonctions
 * pures, zéro import Supabase — c'est ce qui les rend testables, et c'est le
 * pattern `auto-forward.ts` des Reçus.
 */

/**
 * Une pièce jointe de message — GIF, image, sticker.
 *
 * `url` est ce qui s'affiche, `href` ce qui s'ouvre. Les deux peuvent être
 * absentes séparément : un GIF a les deux, un lien partagé n'a que `href`.
 */
export type IngestedAttachment = {
  type: string;
  url: string | null;
  href: string | null;
  title: string | null;
};

export type IngestedMessage = {
  /** Identifiant natif de la plateforme : la clé de déduplication. */
  externalId: string;
  authorExternalId: string | null;
  authorHandle: string | null;
  authorAvatarUrl: string | null;
  attachments: IngestedAttachment[];
  body: string;
  /** Vrai quand le message vient de la marque — réponse faite ailleurs. */
  fromBrand: boolean;
  /** ISO 8601. */
  sentAt: string;
};

/** La publication commentée, affichée en tête de fil. */
export type IngestedPost = {
  externalId: string;
  permalink: string | null;
  excerpt: string | null;
  thumbnailUrl: string | null;
  publishedAt: string | null;
};

export type IngestedThread = {
  channel: ModerationChannel;
  kind: ConversationKind;
  externalThreadId: string;
  participantExternalId: string | null;
  participantHandle: string | null;
  participantAvatarUrl: string | null;
  /**
   * L'état de lecture **chez la plateforme**, quand elle le rend — Meta le
   * fait pour les messages privés (`unread_count`). `null` : inconnu, la
   * fusion tranche seule. `false` : ouvert là-bas, donc jamais de pastille
   * non-lu ici — ce qui a été vu dans la Boîte de réception Meta ne re-sonne
   * pas dans l'outil.
   */
  platformUnread?: boolean | null;
  /** Null pour un message privé. */
  post: IngestedPost | null;
  /** Chronologique, du plus ancien au plus récent. */
  messages: IngestedMessage[];
};

/** Ce que la fusion doit connaître d'une conversation déjà en base. */
export type ExistingThreadState = {
  status: ConversationStatus;
  unread: boolean;
  priority: ConversationPriority;
  flags: ModerationFlag[];
  last_message_at: string;
};

/** Les colonnes d'état qu'un passage de synchronisation écrit. */
export type ThreadStatePlan = {
  status: ConversationStatus;
  unread: boolean;
  priority: ConversationPriority;
  flags: ModerationFlag[];
  detected_locale: SupportedLocale;
  excerpt: string | null;
  last_message_at: string;
  message_count: number;
};

/**
 * Retire ce que Postgres refuse dans un texte : le caractère nul, les
 * caractères de contrôle bruts et les moitiés de paires UTF-16 orphelines —
 * un emoji tronqué par la plateforme suffit à faire échouer **tout** l'upsert
 * du passage (« invalid input syntax for type json », vécu sur un commentaire
 * Facebook de Bondet). Les sauts de ligne restent : un message en a le droit.
 */
export function sanitizeText(value: string): string;
export function sanitizeText(value: string | null): string | null;
export function sanitizeText(value: string | null): string | null {
  if (value === null) return null;
  return (
    value
      // eslint-disable-next-line no-control-regex -- c'est le sujet même
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
      .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
  );
}

/** Extrait court pour la liste — une ligne, sans retour chariot. */
export function excerptOf(body: string, max = 140): string | null {
  const flat = body.replace(/\s+/g, " ").trim();
  if (flat.length === 0) return null;
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).trimEnd()}…`;
}

/**
 * L'extrait d'un message pour la liste.
 *
 * Un commentaire en GIF n'a pas de texte : sans repli, la ligne s'affichait
 * vide alors qu'il s'y passe quelque chose. On nomme alors la pièce jointe.
 */
function excerptOfMessage(message: IngestedMessage | null): string | null {
  if (!message) return null;
  const text = excerptOf(message.body);
  if (text) return text;
  const attachment = message.attachments[0];
  if (!attachment) return null;
  return ATTACHMENT_LABELS[attachment.type] ?? "Pièce jointe";
}

/** Les types d'attachement que Meta rend, dits en français. */
export const ATTACHMENT_LABELS: Record<string, string> = {
  animated_image_share: "GIF",
  animated_image_video: "GIF",
  sticker: "Sticker",
  photo: "Photo",
  video_inline: "Vidéo",
  share: "Lien partagé",
};

function parseTime(iso: string): number {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? 0 : time;
}

/**
 * Statuts qu'une réponse de la marque faite ailleurs referme.
 *
 * `validated` n'en est pas : un envoi est en vol depuis l'outil, le passage
 * suivant le verra comme message de marque et le fil restera cohérent.
 * `sent`, `ignored` et `answered_elsewhere` sont déjà clos.
 */
const CLOSABLE_STATUSES: ConversationStatus[] = [
  "to_process",
  "awaiting_validation",
  "snoozed",
  "send_failed",
];

/**
 * L'état d'une conversation après un passage de synchronisation.
 *
 * Trois règles, dans cet ordre :
 *
 *   1. La marque a répondu après le dernier message entrant — depuis l'app
 *      Instagram, Business Suite ou l'outil : la conversation se classe
 *      « répondu ailleurs » si elle attendait encore une action. Insister
 *      ferait une double réponse.
 *   2. Un message entrant nouveau rouvre le fil, quel que soit son état :
 *      un commentaire de plus sous un fil ignoré redevient du travail.
 *   3. Sinon, rien ne bouge : le passage rafraîchit les compteurs, jamais
 *      le travail de l'opérateur.
 */
export function planThreadState(options: {
  existing: ExistingThreadState | null;
  thread: IngestedThread;
  fallbackLocale?: SupportedLocale;
}): ThreadStatePlan {
  const { existing, thread } = options;
  const fallback = options.fallbackLocale ?? "fr";

  const inbound = thread.messages.filter((message) => !message.fromBrand);
  const lastInbound = inbound.at(-1) ?? null;
  const lastBrandAt = thread.messages
    .filter((message) => message.fromBrand)
    .reduce((latest, message) => Math.max(latest, parseTime(message.sentAt)), 0);
  const lastInboundAt = lastInbound ? parseTime(lastInbound.sentAt) : 0;
  const lastMessageAt = thread.messages.reduce(
    (latest, message) => Math.max(latest, parseTime(message.sentAt)),
    0,
  );

  // Le tri couvre tous les messages entrants : un signalement posé au premier
  // message ne s'efface pas parce qu'un « ? » est arrivé ensuite.
  const flags: ModerationFlag[] = [];
  for (const message of inbound) {
    for (const flag of triageMessage(message.body, fallback).flags) {
      if (!flags.includes(flag)) flags.push(flag);
    }
  }
  for (const flag of existing?.flags ?? []) {
    if (!flags.includes(flag)) flags.push(flag);
  }

  const locale = lastInbound
    ? triageMessage(lastInbound.body, fallback).locale
    : fallback;

  const brandAnswered = lastBrandAt > 0 && lastBrandAt >= lastInboundAt;
  const newInbound =
    lastInbound !== null &&
    (existing === null || lastInboundAt > parseTime(existing.last_message_at));

  let status: ConversationStatus;
  let unread: boolean;

  if (existing === null) {
    status = brandAnswered ? "answered_elsewhere" : "to_process";
    unread = !brandAnswered;
  } else if (
    brandAnswered &&
    (newInbound || CLOSABLE_STATUSES.includes(existing.status))
  ) {
    status = "answered_elsewhere";
    unread = false;
  } else if (newInbound) {
    status = "to_process";
    unread = true;
  } else {
    status = existing.status;
    unread = existing.unread;
  }

  // Ce que Meta a déjà montré comme lu ne re-sonne pas ici : la pastille
  // non-lu suit la plus stricte des deux boîtes. Le statut, lui, ne bouge
  // pas — lire n'est pas répondre.
  if (thread.platformUnread === false) unread = false;

  // La priorité ne redescend jamais : un signalement lu reste signalé.
  const priority: ConversationPriority =
    flags.length > 0 || existing?.priority === "high" ? "high" : "normal";

  return {
    status,
    unread,
    priority,
    flags,
    detected_locale: locale,
    excerpt: excerptOfMessage(lastInbound ?? thread.messages.at(-1) ?? null),
    last_message_at: new Date(lastMessageAt || Date.now()).toISOString(),
    message_count: thread.messages.length,
  };
}
