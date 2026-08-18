/**
 * Modèle du module Modération.
 *
 * Aligné sur `supabase/migrations/0004_moderation_schema.sql`. Alias de type et
 * non `interface` : TypeScript ne donne d'index signature implicite qu'aux
 * premiers, et postgrest-js en a besoin pour inférer les résultats de requête.
 */

export type ModerationChannel =
  | "instagram"
  | "facebook"
  | "whatsapp"
  // V2 : présents dès maintenant pour ne pas migrer le modèle plus tard.
  | "tiktok"
  | "linkedin"
  | "youtube"
  | "google_reviews";

/** Canaux réellement ingérés en V1. */
export const V1_CHANNELS: ModerationChannel[] = [
  "instagram",
  "facebook",
  "whatsapp",
];

export const CHANNEL_LABELS: Record<ModerationChannel, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  google_reviews: "Avis Google",
};

export type ConversationKind = "dm" | "comment" | "story_mention" | "review";

export const KIND_LABELS: Record<ConversationKind, string> = {
  dm: "Message privé",
  comment: "Commentaire",
  story_mention: "Mention en story",
  review: "Avis",
};

export type ConversationStatus =
  | "to_process"
  | "awaiting_validation"
  | "validated"
  | "sent"
  | "ignored"
  | "snoozed"
  | "send_failed"
  | "answered_elsewhere";

export const STATUS_LABELS: Record<ConversationStatus, string> = {
  to_process: "À traiter",
  awaiting_validation: "En attente de validation",
  validated: "Validé",
  sent: "Envoyé",
  ignored: "Archivé",
  snoozed: "En attente",
  send_failed: "Échec d'envoi",
  answered_elsewhere: "Répondu ailleurs",
};

/**
 * Statuts qui comptent dans le badge « à gérer ».
 *
 * `snoozed` en est exclu volontairement : mis de côté n'est pas traité, et il a
 * sa propre pastille. `answered_elsewhere` aussi — quelqu'un a répondu depuis
 * l'app Instagram, insister ferait une double réponse.
 */
export const ACTIONABLE_STATUSES: ConversationStatus[] = [
  "to_process",
  "awaiting_validation",
  "send_failed",
];

export function isActionable(status: ConversationStatus): boolean {
  return ACTIONABLE_STATUSES.includes(status);
}

export type ConversationPriority = "normal" | "high";

/**
 * Les onglets de l'inbox croisée — le vocabulaire de la Boîte de réception
 * Meta, réduit à ce que l'outil ingère. Valeurs en français : elles vivent
 * dans l'URL (`?vue=`).
 */
export type InboxView =
  | "tout"
  | "commentaires-instagram"
  | "commentaires-facebook"
  | "messages";

export const VIEW_ORDER: InboxView[] = [
  "tout",
  "commentaires-instagram",
  "commentaires-facebook",
  "messages",
];

export const VIEW_LABELS: Record<InboxView, string> = {
  tout: "Tout",
  "commentaires-instagram": "Commentaires Instagram",
  "commentaires-facebook": "Commentaires Facebook",
  messages: "Messages privés",
};

export function isInboxView(value: string): value is InboxView {
  return value in VIEW_LABELS;
}

/** Un onglet est une contrainte (canal, type) — « tout » n'en porte aucune. */
export function viewMatches(
  view: InboxView,
  channel: ModerationChannel,
  kind: ConversationKind,
): boolean {
  switch (view) {
    case "tout":
      return true;
    case "commentaires-instagram":
      return channel === "instagram" && kind === "comment";
    case "commentaires-facebook":
      return channel === "facebook" && kind === "comment";
    case "messages":
      return kind === "dm";
  }
}

/**
 * Les statuts, regroupés comme on travaille : ce qui attend une action, ce
 * qui est mis de côté, ce qui est classé. Valeurs en français — URL aussi
 * (`?statut=`).
 */
export type StatusGroup = "a-traiter" | "en-attente" | "traitees" | "toutes";

export const STATUS_GROUP_ORDER: StatusGroup[] = [
  "a-traiter",
  "en-attente",
  "traitees",
  "toutes",
];

export const STATUS_GROUP_LABELS: Record<StatusGroup, string> = {
  "a-traiter": "À traiter",
  "en-attente": "En attente",
  traitees: "Traitées",
  toutes: "Toutes",
};

export function isStatusGroup(value: string): value is StatusGroup {
  return value in STATUS_GROUP_LABELS;
}

export const STATUS_GROUP_MEMBERS: Record<
  Exclude<StatusGroup, "toutes">,
  ConversationStatus[]
> = {
  // Aligné sur ACTIONABLE_STATUSES — un seul vocabulaire du « à gérer ».
  "a-traiter": ["to_process", "awaiting_validation", "send_failed"],
  "en-attente": ["snoozed"],
  // `validated` est traité du point de vue de l'opérateur : validé, en
  // partance — il ne réclame plus rien.
  traitees: ["validated", "sent", "ignored", "answered_elsewhere"],
};

export function statusGroupOf(
  status: ConversationStatus,
): Exclude<StatusGroup, "toutes"> {
  if (STATUS_GROUP_MEMBERS["a-traiter"].includes(status)) return "a-traiter";
  if (STATUS_GROUP_MEMBERS["en-attente"].includes(status)) return "en-attente";
  return "traitees";
}

/**
 * Signalements automatiques. Une conversation qui en porte au moins un n'est
 * **jamais** éligible à l'auto-envoi et passe en priorité haute.
 */
export type ModerationFlag =
  | "spam"
  | "insult"
  | "dispute"
  | "refund"
  | "sensitive";

export const FLAG_LABELS: Record<ModerationFlag, string> = {
  spam: "Spam",
  insult: "Insulte",
  dispute: "Litige",
  refund: "Remboursement",
  sensitive: "Question sensible",
};

export type DraftStatus =
  | "proposed"
  | "validated"
  | "refused"
  | "sent"
  | "expired"
  | "no_answer_available";

export type ModerationRole = "owner" | "operator" | "viewer";

export type SupportedLocale = "fr" | "en";

export type ToneSettings = {
  /** Vouvoiement ou tutoiement. */
  address: "vous" | "tu";
  signature: string | null;
  emojis_allowed: boolean;
  target_length: "short" | "medium" | "long";
};

export type AutoSendSettings = {
  enabled: boolean;
  min_confidence: number;
  hourly_cap: number;
  /** Interrupteur d'arrêt d'urgence : coupe tout, sans toucher au reste. */
  emergency_stop: boolean;
  eligible_channels: ModerationChannel[];
  eligible_categories: string[];
};

export type ModerationClient = {
  id: string;
  org_id: string;
  workspace_id: string | null;
  slug: string;
  name: string;
  locale_default: SupportedLocale;
  locales_active: SupportedLocale[];
  tone_settings: ToneSettings;
  auto_send_settings: AutoSendSettings;
  retention_days: number | null;
  archived_at: string | null;
  created_at: string;
};

/**
 * Le pseudo d'un participant, ou la raison de son absence.
 *
 * Meta ne nomme pas toujours l'auteur d'un commentaire — compte personnel qui
 * l'a restreint, confidentialité Facebook. « Inconnu » laissait croire à une
 * panne de notre côté ; la phrase dit qui masque, et que le fil reste
 * répondable.
 */
export function participantLabel(handle: string | null): string {
  return handle ?? "Auteur masqué par Meta";
}

export type Conversation = {
  id: string;
  client_id: string;
  connection_id: string | null;
  channel: ModerationChannel;
  external_thread_id: string;
  kind: ConversationKind;
  participant_external_id: string | null;
  participant_handle: string | null;
  participant_avatar_url: string | null;
  status: ConversationStatus;
  priority: ConversationPriority;
  unread: boolean;
  flags: ModerationFlag[];
  detected_locale: SupportedLocale | null;
  excerpt: string | null;
  /** La publication commentée — null pour un message privé. */
  post_external_id: string | null;
  post_permalink: string | null;
  post_excerpt: string | null;
  post_thumbnail_url: string | null;
  message_count: number;
  last_message_at: string;
  response_window_expires_at: string | null;
  human_agent_tag_used: boolean;
  locked_by: string | null;
  locked_at: string | null;
  lock_expires_at: string | null;
  deleted_at: string | null;
  created_at: string;
};

export type ModerationMessage = {
  id: string;
  conversation_id: string;
  client_id: string;
  direction: "inbound" | "outbound";
  external_message_id: string | null;
  author_external_id: string | null;
  author_handle: string | null;
  body: string;
  attachments: unknown[];
  origin: "platform" | "antidotes" | "auto_send";
  sent_at: string;
  created_at: string;
};

/** Entrée FAQ citée sous un brouillon, cliquable pour vérification. */
export type DraftSource = {
  faq_entry_id: string;
  question: string;
  similarity: number;
};

export type Draft = {
  id: string;
  conversation_id: string;
  client_id: string;
  body: string;
  locale: SupportedLocale;
  confidence: number | null;
  model: string | null;
  prompt_version: string | null;
  status: DraftStatus;
  sources: DraftSource[];
  translated_from_fr: boolean;
  auto_sent: boolean;
  auto_send_rule: unknown | null;
  bad_auto_reply: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  sent_at: string | null;
  send_error: string | null;
  created_at: string;
};

export type FaqEntry = {
  id: string;
  client_id: string;
  question_canonical: string;
  variants: string[];
  answer_fr: string | null;
  answer_en: string | null;
  category_id: string | null;
  channels: ModerationChannel[];
  priority: number;
  active: boolean;
  confidence: number;
  usage_count: number;
  direct_validation_count: number;
  correction_count: number;
  embedding_source: string | null;
  monday_item_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
