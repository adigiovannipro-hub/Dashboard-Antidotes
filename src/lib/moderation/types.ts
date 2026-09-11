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

/**
 * Ce qu'un **badge** annonce : à traiter *et* pas encore lu.
 *
 * La définition est unique, et elle doit le rester — la pastille du rail
 * (`countModeration`) et les compteurs d'onglets de canal (`getInboxCounters`)
 * s'en servent tous les deux. Le jour où l'une des deux compte autre chose, un
 * badge promet ce que le clic ne montre pas : c'est la règle de la maison, et
 * c'est déjà arrivé.
 *
 * Pourquoi l'état de lecture et pas la seule charge de travail : un badge de
 * notification dit ce qu'on n'a pas encore regardé. La charge, elle, est déjà
 * portée par le filtre de statut « À traiter », qui compte tout l'actionnable,
 * lu ou non. Sans cette distinction, lire trois cents conversations ne faisait
 * bouger aucun chiffre.
 */
export function countsAsPending(row: {
  status: ConversationStatus;
  unread: boolean;
  flags?: readonly string[] | null;
}): boolean {
  return row.unread && ACTIONABLE_STATUSES.includes(row.status) && !isSpam(row.flags);
}

/**
 * Le spam quitte « À traiter », et donc les badges.
 *
 * L'ingestion archive déjà un fil dont tous les entrants sont du spam, mais
 * elle ne juge que ce qui arrive : un fil relevé avant la règle garde son
 * statut. Le prédicat vaut donc aussi à la **lecture**, du filtre SQL jusqu'au
 * compteur — sans quoi un badge annoncerait des conversations que le clic ne
 * montre plus. Rien n'est perdu : « Toutes » et « Signalées » les gardent.
 */
export function isSpam(flags: readonly string[] | null | undefined): boolean {
  return (flags ?? []).includes("spam");
}

export type ConversationPriority = "normal" | "high";

/**
 * Les statuts, regroupés comme on travaille : ce qui attend une action, ce
 * qui est mis de côté, ce qui est classé. Valeurs en français — URL aussi
 * (`?statut=`).
 *
 * « Toutes » a disparu le 11/09 : un quatrième groupe qui contient les trois
 * autres n'est pas un filtre, c'est leur absence — et l'écran s'ouvrait alors
 * sur des centaines de fils classés où le travail du jour se noyait. Les
 * libellés et l'ordre vivent dans `filters.ts`, avec la lecture de l'URL.
 */
export type StatusGroup = "a-traiter" | "en-attente" | "traitees";

export const STATUS_GROUP_MEMBERS: Record<StatusGroup, ConversationStatus[]> = {
  // Aligné sur ACTIONABLE_STATUSES — un seul vocabulaire du « à gérer ».
  "a-traiter": ["to_process", "awaiting_validation", "send_failed"],
  "en-attente": ["snoozed"],
  // `validated` est traité du point de vue de l'opérateur : validé, en
  // partance — il ne réclame plus rien.
  traitees: ["validated", "sent", "ignored", "answered_elsewhere"],
};

export function statusGroupOf(status: ConversationStatus): StatusGroup {
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
  | "sensitive"
  /* Posé à la main depuis l'Inbox, jamais par le triage. La colonne est un
     `text[]` et non un enum : un drapeau de plus ne demande pas de migration.
     Il fait entrer le fil dans « Signalées », qui est la seule liste où l'on
     revient volontairement. */
  | "manual";

export const FLAG_LABELS: Record<ModerationFlag, string> = {
  manual: "Signalée",
  spam: "Spam",
  insult: "Insulte",
  dispute: "Litige",
  refund: "Remboursement",
  sensitive: "Question sensible",
};

/**
 * Tous les drapeaux, dans l'ordre de la déclaration.
 *
 * Sert au filtre « Signalées », qui interroge la **présence d'un drapeau** et
 * non la priorité : depuis que le spam est archivé sans monter en priorité, la
 * priorité ne dit plus « signalé ». Le libellé du filtre, lui, n'a jamais
 * parlé que des drapeaux.
 */
export const MODERATION_FLAGS: ModerationFlag[] = Object.keys(
  FLAG_LABELS,
) as ModerationFlag[];

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

/**
 * Le verdict du client sur un élément de langage — posé depuis son espace,
 * par action serveur uniquement. `null` : jamais soumis à validation.
 */
export type FaqClientReview = "pending" | "approved" | "rejected";

export const FAQ_CLIENT_REVIEW_LABELS: Record<FaqClientReview, string> = {
  pending: "À valider",
  approved: "Validé",
  rejected: "Refusé",
};

export type FaqEntry = {
  id: string;
  client_id: string;
  /** Le titre court du board Monday (« BON CADEAU REPORT ») — l'ancre de lecture. */
  title: string | null;
  question_canonical: string;
  variants: string[];
  answer_fr: string | null;
  answer_en: string | null;
  /** La version courte pour TikTok, quand le board en portait une. */
  answer_tiktok: string | null;
  client_review: FaqClientReview | null;
  client_reviewed_at: string | null;
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

/** Un thème de la FAQ — la colonne « Thème » du board Monday d'origine. */
export type FaqCategory = {
  id: string;
  client_id: string;
  name: string;
  position: number;
  /** Choisie dans l'éditeur d'étiquettes ; `null` = teinte déduite du nom. */
  color: string | null;
};

/**
 * Un message du fil d'un élément de langage.
 *
 * Le fil sert à informer le client d'une formule et à lui en demander
 * l'autorisation ; les adresses taguées reçoivent le message par e-mail, par
 * la boîte Gmail des Reçus. `author_name` est recopié à l'écriture : un
 * message doit rester lisible quand le compte qui l'a posé n'existe plus.
 */
export type FaqComment = {
  id: string;
  client_id: string;
  entry_id: string;
  author_id: string | null;
  author_name: string | null;
  body: string;
  mentions: string[];
  created_at: string;
};

/**
 * Une réponse enregistrée : la formule qu'on retape dix fois par semaine.
 *
 * Distincte d'une entrée de FAQ, et pour une raison de fond : une entrée de
 * FAQ répond à une **question** et nourrit la recherche sémantique comme la
 * boucle de correction. Une réponse enregistrée est un bout de texte qu'on
 * colle, sans question en face. Les mélanger remplirait la FAQ d'entrées sans
 * question, invisibles de la recherche et nuisibles à l'apprentissage.
 */
export type SavedReply = {
  id: string;
  client_id: string;
  title: string;
  body: string;
  tags: string[];
  /** Vide = partout. Sinon, les types de fil où elle se propose. */
  scope: ConversationKind[];
  usage_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Ce qu'une recherche dans la bibliothèque doit trouver : le nom, le corps,
    les étiquettes. Pure, pour que la liste filtre sans aller-retour. */
export function savedReplyMatches(reply: SavedReply, needle: string): boolean {
  const query = needle.trim().toLowerCase();
  if (!query) return true;
  return [reply.title, reply.body, ...reply.tags]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

/** Une réponse ne se propose que sur les fils qu'elle sert. */
export function savedReplyApplies(reply: SavedReply, kind: ConversationKind): boolean {
  return reply.scope.length === 0 || reply.scope.includes(kind);
}
