/**
 * Fenêtre de réponse de la messagerie Meta.
 *
 * Messenger et Instagram n'autorisent une réponse que dans les **24 h** suivant
 * le dernier message de l'utilisateur. Au-delà, l'envoi est refusé — sauf en
 * marquant le message avec le tag `human_agent`, qui étend la fenêtre à **7
 * jours** et est précisément prévu pour le cas d'un opérateur humain qui répond
 * en différé.
 *
 * WhatsApp fonctionne autrement : la même fenêtre de 24 h s'applique, mais
 * au-delà il faut passer par un *template* pré-approuvé, pas par un tag. Le
 * module l'expose comme une contrainte distincte pour ne pas laisser croire
 * qu'un tag suffirait.
 */
import type { ModerationChannel } from "./types";

const HOUR = 60 * 60 * 1000;

export const STANDARD_WINDOW_MS = 24 * HOUR;
export const HUMAN_AGENT_WINDOW_MS = 7 * 24 * HOUR;

export type SendEligibility =
  | { canSend: true; requiresHumanAgentTag: boolean; hoursRemaining: number }
  | {
      canSend: false;
      reason: "window_expired" | "requires_approved_template";
      hoursOverdue: number;
    };

/** Canaux soumis à la fenêtre de messagerie Meta. */
const WINDOWED_CHANNELS: ModerationChannel[] = [
  "instagram",
  "facebook",
  "whatsapp",
];

/**
 * Les commentaires publics n'ont pas de fenêtre : on peut répondre à un
 * commentaire de l'an dernier. Seule la messagerie privée est contrainte.
 */
export function isWindowed(
  channel: ModerationChannel,
  kind: "dm" | "comment" | "story_mention" | "review",
): boolean {
  return kind === "dm" && WINDOWED_CHANNELS.includes(channel);
}

export function computeWindowExpiry(
  lastInboundAt: Date,
  humanAgentTagUsed = false,
): Date {
  const span = humanAgentTagUsed ? HUMAN_AGENT_WINDOW_MS : STANDARD_WINDOW_MS;
  return new Date(lastInboundAt.getTime() + span);
}

export function evaluateSendEligibility(options: {
  channel: ModerationChannel;
  kind: "dm" | "comment" | "story_mention" | "review";
  lastInboundAt: Date;
  now?: Date;
}): SendEligibility {
  const { channel, kind, lastInboundAt } = options;
  const now = options.now ?? new Date();
  const elapsed = now.getTime() - lastInboundAt.getTime();

  if (!isWindowed(channel, kind)) {
    return { canSend: true, requiresHumanAgentTag: false, hoursRemaining: Infinity };
  }

  if (elapsed <= STANDARD_WINDOW_MS) {
    return {
      canSend: true,
      requiresHumanAgentTag: false,
      hoursRemaining: (STANDARD_WINDOW_MS - elapsed) / HOUR,
    };
  }

  // WhatsApp : au-delà de 24 h, le tag human_agent n'existe pas — il faut un
  // template approuvé, que le module ne gère pas en V1.
  if (channel === "whatsapp") {
    return {
      canSend: false,
      reason: "requires_approved_template",
      hoursOverdue: (elapsed - STANDARD_WINDOW_MS) / HOUR,
    };
  }

  if (elapsed <= HUMAN_AGENT_WINDOW_MS) {
    return {
      canSend: true,
      requiresHumanAgentTag: true,
      hoursRemaining: (HUMAN_AGENT_WINDOW_MS - elapsed) / HOUR,
    };
  }

  return {
    canSend: false,
    reason: "window_expired",
    hoursOverdue: (elapsed - HUMAN_AGENT_WINDOW_MS) / HOUR,
  };
}

/** Formule courte pour l'inbox : « 6 h restantes », « expiré depuis 2 j ». */
export function formatWindow(eligibility: SendEligibility): string {
  if (eligibility.canSend) {
    if (!Number.isFinite(eligibility.hoursRemaining)) return "Pas de limite";
    const hours = Math.floor(eligibility.hoursRemaining);
    const suffix = eligibility.requiresHumanAgentTag ? " (tag human_agent)" : "";
    if (hours >= 48) return `${Math.floor(hours / 24)} j restants${suffix}`;
    return `${hours} h restantes${suffix}`;
  }

  if (eligibility.reason === "requires_approved_template") {
    return "Fenêtre 24 h dépassée — template approuvé requis";
  }
  const days = Math.floor(eligibility.hoursOverdue / 24);
  return days >= 1 ? `Expiré depuis ${days} j` : "Fenêtre expirée";
}

/**
 * Les trois états visibles d'une fenêtre de réponse.
 *
 * `none` : rien à dire — un commentaire public se répond un an plus tard, et
 * afficher « pas de limite » sur chaque fil serait du bruit.
 * `open` : la fenêtre court. `closing` : moins de 24 h, il faut traiter
 * aujourd'hui. `expired` : l'envoi est refusé par la plateforme, pas par nous.
 */
export type WindowState = "none" | "open" | "closing" | "expired";

/** En deçà, la fenêtre se ferme aujourd'hui. */
export const CLOSING_HOURS = 24;

/**
 * L'état se lit sur la fenêtre **utilisable**, pas sur celle de 24 h.
 *
 * `evaluateSendEligibility` rend les 24 h standard tant qu'on est dedans, et
 * ne parle des sept jours qu'au-delà — c'est juste pour décider du tag, faux
 * pour l'écran : à deux heures d'un message, il reste six jours et non vingt-
 * deux heures. L'état se calcule donc sur la vraie échéance, celle que
 * `sendReply` sait atteindre en posant `human_agent`.
 */
export function windowState(options: {
  channel: ModerationChannel;
  kind: "dm" | "comment" | "story_mention" | "review";
  lastInboundAt: Date;
  now?: Date;
}): WindowState {
  if (!isWindowed(options.channel, options.kind)) return "none";

  const now = options.now ?? new Date();
  const elapsed = now.getTime() - options.lastInboundAt.getTime();
  // WhatsApp ne connaît pas le tag : sa fenêtre reste celle des 24 h.
  const span =
    options.channel === "whatsapp" ? STANDARD_WINDOW_MS : HUMAN_AGENT_WINDOW_MS;
  const remaining = (span - elapsed) / HOUR;

  if (remaining <= 0) return "expired";
  return remaining <= CLOSING_HOURS ? "closing" : "open";
}
