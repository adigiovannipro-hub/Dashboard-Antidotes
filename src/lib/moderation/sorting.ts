import { windowState } from "./response-window";
import type { ConversationKind, ModerationChannel, StatusGroup } from "./types";

/**
 * L'ordre de la liste.
 *
 * Partout, le plus récent d'abord — c'est l'ordre d'une boîte de réception.
 * Sauf dans « À traiter », où une règle passe devant : **un message privé dont
 * la fenêtre de réponse se ferme dans les vingt-quatre heures monte en tête**,
 * le plus urgent en premier. Passé sept jours, Meta refuse l'envoi ; un fil
 * qu'on ne voit pas parce qu'il est descendu de trois écrans est un client
 * qu'on ne peut plus joindre.
 *
 * L'échéance se calcule sur `last_message_at`, faute de mieux à ce niveau : la
 * liste ne charge pas les messages, et c'est la date du dernier message du fil,
 * entrant ou sortant. Une réponse de notre part la repousse donc légèrement —
 * dans le sens prudent, le fil remonte plus tôt que nécessaire, jamais trop
 * tard.
 */

export type SortableConversation = {
  channel: ModerationChannel;
  kind: ConversationKind;
  last_message_at: string;
};

export function sortForSegment<T extends SortableConversation>(
  rows: readonly T[],
  segment: StatusGroup,
  now = new Date(),
): T[] {
  const byRecency = (a: T, b: T) => (a.last_message_at < b.last_message_at ? 1 : -1);
  if (segment !== "a-traiter") return [...rows].sort(byRecency);

  const closing: T[] = [];
  const rest: T[] = [];
  for (const row of rows) {
    const state = windowState({
      channel: row.channel,
      kind: row.kind,
      lastInboundAt: new Date(row.last_message_at),
      now,
    });
    (state === "closing" ? closing : rest).push(row);
  }

  // Le plus ancien d'abord parmi les urgents : c'est celui dont la fenêtre
  // ferme en premier.
  closing.sort((a, b) => (a.last_message_at < b.last_message_at ? -1 : 1));
  rest.sort(byRecency);
  return [...closing, ...rest];
}
