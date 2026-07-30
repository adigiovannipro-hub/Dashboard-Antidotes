import type {
  AutoSendSettings,
  Conversation,
  Draft,
  ModerationChannel,
} from "./types";

/**
 * Garde-fous de l'auto-envoi.
 *
 * Désactivé par défaut, activable uniquement par l'owner. Ce module est la
 * seule porte : rien ne part automatiquement sans passer par `evaluateAutoSend`,
 * et la fonction refuse par défaut — chaque autorisation est explicite.
 *
 * Les exclusions ne sont pas configurables. Un litige, une insulte, une question
 * sensible, un brouillon sans source FAQ ou un premier contact ne partent jamais
 * seuls, quel que soit le réglage. C'est ce qui rend la fonctionnalité
 * défendable auprès d'un client.
 */

export type AutoSendRefusal =
  | "disabled"
  | "emergency_stop"
  | "below_confidence"
  | "channel_not_eligible"
  | "category_not_eligible"
  | "flagged"
  | "no_faq_source"
  | "first_interaction"
  | "hourly_cap_reached"
  | "draft_not_proposed"
  | "send_window_closed";

export const REFUSAL_LABELS: Record<AutoSendRefusal, string> = {
  disabled: "Auto-envoi désactivé pour ce client",
  emergency_stop: "Arrêt d'urgence activé",
  below_confidence: "Confiance sous le seuil configuré",
  channel_not_eligible: "Canal non éligible",
  category_not_eligible: "Catégorie FAQ non éligible",
  flagged: "Message signalé — lecture humaine obligatoire",
  no_faq_source: "Aucune source FAQ citée",
  first_interaction: "Première interaction de cet utilisateur",
  hourly_cap_reached: "Plafond horaire atteint",
  draft_not_proposed: "Brouillon déjà traité",
  send_window_closed: "Fenêtre de réponse fermée",
};

export type AutoSendDecision =
  | { allowed: true; rule: { confidence: number; categories: string[] } }
  | { allowed: false; refusals: AutoSendRefusal[] };

export type AutoSendContext = {
  settings: AutoSendSettings;
  conversation: Pick<
    Conversation,
    "channel" | "flags" | "status" | "message_count"
  >;
  draft: Pick<Draft, "status" | "confidence" | "sources">;
  /** Catégories des entrées FAQ citées par le brouillon. */
  sourceCategories: string[];
  /** Envois automatiques déjà effectués dans l'heure glissante, ce client. */
  autoSentLastHour: number;
  /** Faux si la fenêtre de réponse du canal est fermée. */
  sendWindowOpen: boolean;
  /**
   * Vrai si cet utilisateur a déjà échangé avec la marque auparavant. Un
   * premier contact ne reçoit jamais de réponse automatique : c'est le moment où
   * une erreur coûte le plus cher.
   */
  hasPriorInteraction: boolean;
};

/**
 * Renvoie **toutes** les raisons de refus, pas seulement la première. Un
 * opérateur qui cherche à comprendre pourquoi rien ne part automatiquement a
 * besoin de la liste complète, pas d'un jeu de piste.
 */
export function evaluateAutoSend(context: AutoSendContext): AutoSendDecision {
  const {
    settings,
    conversation,
    draft,
    sourceCategories,
    autoSentLastHour,
    sendWindowOpen,
    hasPriorInteraction,
  } = context;

  const refusals: AutoSendRefusal[] = [];

  if (!settings.enabled) refusals.push("disabled");
  if (settings.emergency_stop) refusals.push("emergency_stop");

  if (draft.status !== "proposed") refusals.push("draft_not_proposed");

  // --- Exclusions systématiques, non configurables ---
  if (conversation.flags.length > 0) refusals.push("flagged");
  if (draft.sources.length === 0) refusals.push("no_faq_source");
  if (!hasPriorInteraction) refusals.push("first_interaction");

  // --- Réglages du client ---
  if (draft.confidence === null || draft.confidence < settings.min_confidence) {
    refusals.push("below_confidence");
  }
  if (!isChannelEligible(settings, conversation.channel)) {
    refusals.push("channel_not_eligible");
  }
  if (!areCategoriesEligible(settings, sourceCategories)) {
    refusals.push("category_not_eligible");
  }
  if (autoSentLastHour >= settings.hourly_cap) refusals.push("hourly_cap_reached");
  if (!sendWindowOpen) refusals.push("send_window_closed");

  if (refusals.length > 0) return { allowed: false, refusals };

  return {
    allowed: true,
    rule: { confidence: draft.confidence!, categories: sourceCategories },
  };
}

/**
 * Une liste de canaux vide signifie **aucun canal éligible**, pas « tous ».
 * L'inverse serait un piège : activer l'auto-envoi sans avoir choisi de canal
 * ouvrirait la vanne partout.
 */
function isChannelEligible(
  settings: AutoSendSettings,
  channel: ModerationChannel,
): boolean {
  return settings.eligible_channels.includes(channel);
}

/**
 * Même logique pour les catégories, avec une exigence de plus : **toutes** les
 * catégories citées doivent être éligibles. Un brouillon qui s'appuie sur une
 * entrée « livraison » autorisée et une entrée « SAV » non autorisée ne part pas.
 */
function areCategoriesEligible(
  settings: AutoSendSettings,
  categories: string[],
): boolean {
  if (settings.eligible_categories.length === 0) return false;
  if (categories.length === 0) return false;
  return categories.every((category) =>
    settings.eligible_categories.includes(category),
  );
}

/**
 * Une réponse automatique marquée « mauvaise » abaisse la confiance des entrées
 * FAQ qui l'ont produite. Plancher à 0,1 : on n'annule pas une entrée, on la
 * fait sortir du champ de l'auto-envoi et remonter dans « à retravailler ».
 */
export function penalizeConfidence(current: number, step = 0.15): number {
  return Math.max(0.1, Math.round((current - step) * 1000) / 1000);
}

/** Une validation directe restaure lentement la confiance, plafonnée à 1. */
export function rewardConfidence(current: number, step = 0.05): number {
  return Math.min(1, Math.round((current + step) * 1000) / 1000);
}
