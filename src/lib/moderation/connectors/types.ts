import type {
  ConversationKind,
  ModerationChannel,
  SupportedLocale,
} from "../types";

/**
 * Interface commune à tous les canaux.
 *
 * Un connecteur traduit le vocabulaire d'une plateforme vers le modèle interne
 * et rien d'autre. Toute la logique produit — tri, recherche FAQ, génération,
 * validation — vit au-dessus et ne connaît aucune plateforme. C'est ce qui
 * permet d'ajouter TikTok en écrivant une classe.
 */

/** Message normalisé, tel qu'il entre dans le système. */
export type IncomingMessage = {
  channel: ModerationChannel;
  /** Identifiant natif de la plateforme : la clé de déduplication. */
  externalMessageId: string;
  externalThreadId: string;
  kind: ConversationKind;
  authorExternalId: string;
  authorHandle: string | null;
  authorAvatarUrl: string | null;
  body: string;
  attachments: { type: string; url: string }[];
  sentAt: Date;
  /**
   * Vrai quand le message vient de la marque : quelqu'un a répondu depuis
   * l'app Instagram ou Business Suite. La conversation sort alors des
   * compteurs, pour éviter une double réponse.
   */
  fromBrand: boolean;
};

export type OutgoingMessage = {
  externalThreadId: string;
  body: string;
  /** Meta uniquement : étend la fenêtre de réponse de 24 h à 7 jours. */
  humanAgentTag?: boolean;
};

export type SendResult =
  | { ok: true; externalMessageId: string }
  | { ok: false; retryable: boolean; error: string };

export type RateLimitBudget = {
  /** Appels restants sur la fenêtre courante, tel que la plateforme le rapporte. */
  remaining: number;
  resetAt: Date;
};

export type StoryMentionPayload = {
  externalId: string;
  authorHandle: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  publishedAt: Date;
  expiresAt: Date | null;
};

export type ChannelConnector = {
  readonly channel: ModerationChannel;

  /** Le canal pousse-t-il des webhooks, ou faut-il l'interroger ? */
  readonly supportsWebhooks: boolean;

  /**
   * Le repartage programmatique en story est-il autorisé par l'API ?
   *
   * Faux pour tout ce qui n'est pas Instagram, et faux même sur Instagram tant
   * que les permissions ne sont pas accordées. L'interface n'affiche l'action
   * que si elle est réellement possible, plutôt que de proposer un bouton qui
   * échouera.
   */
  readonly supportsStoryReshare: boolean;

  verifySignature(rawBody: string, headers: Headers): boolean;

  /** Traduit une charge utile de webhook en messages normalisés. */
  parseWebhook(payload: unknown): IncomingMessage[];

  /** Repli quand le webhook n'existe pas ou a été manqué. */
  poll(options: { since: Date; cursor?: string }): Promise<{
    messages: IncomingMessage[];
    cursor: string | null;
  }>;

  send(message: OutgoingMessage): Promise<SendResult>;

  fetchStoryMentions?(options: { since: Date }): Promise<StoryMentionPayload[]>;

  /** Renouvelle un token longue durée avant expiration. */
  refreshCredentials?(): Promise<{ credentials: string; expiresAt: Date | null }>;

  rateLimitBudget?(): Promise<RateLimitBudget>;
};

/** Langue par défaut d'un canal, quand la détection ne tranche pas. */
export const CHANNEL_DEFAULT_LOCALE: Record<ModerationChannel, SupportedLocale> = {
  instagram: "fr",
  facebook: "fr",
  whatsapp: "fr",
  tiktok: "fr",
  linkedin: "fr",
  youtube: "fr",
  google_reviews: "fr",
};

/**
 * Catalogue des capacités par canal, connu sans connexion active.
 *
 * Sert à l'interface avant tout branchement : on sait dès maintenant que le
 * repartage en story n'existe que sur Instagram, et qu'un avis Google ne se
 * répond pas dans une fenêtre de 24 h.
 */
export const CHANNEL_CAPABILITIES: Record<
  ModerationChannel,
  {
    webhooks: boolean;
    storyReshare: boolean;
    kinds: ConversationKind[];
    v1: boolean;
  }
> = {
  instagram: {
    webhooks: true,
    storyReshare: true,
    kinds: ["dm", "comment", "story_mention"],
    v1: true,
  },
  facebook: { webhooks: true, storyReshare: false, kinds: ["dm", "comment"], v1: true },
  whatsapp: { webhooks: true, storyReshare: false, kinds: ["dm"], v1: true },
  tiktok: { webhooks: false, storyReshare: false, kinds: ["dm", "comment"], v1: false },
  linkedin: { webhooks: false, storyReshare: false, kinds: ["dm", "comment"], v1: false },
  youtube: { webhooks: false, storyReshare: false, kinds: ["comment"], v1: false },
  google_reviews: {
    webhooks: false,
    storyReshare: false,
    kinds: ["review"],
    v1: false,
  },
};
