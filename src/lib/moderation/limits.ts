import type { ConversationKind, ModerationChannel } from "./types";

/**
 * Ce que la plateforme accepte : longueur d'un message, pièces jointes.
 *
 * Les longueurs viennent de la documentation publique des plateformes, pas
 * d'un essai : elles servent de **garde**, pas de promesse. Un compteur qui
 * s'affiche à 2 000 caractères évite un refus d'API à l'envoi, ce qui est
 * exactement son rôle — et si une plateforme change son plafond, c'est ici
 * qu'on le corrige, à un endroit.
 *
 * Un canal absent de la table n'a pas de limite connue : le compteur ne
 * s'affiche pas. Afficher « ∞ » ou un plafond inventé serait pire que rien.
 */

const COMMENT_LIMITS: Partial<Record<ModerationChannel, number>> = {
  instagram: 2_200,
  facebook: 8_000,
  youtube: 10_000,
};

const DM_LIMITS: Partial<Record<ModerationChannel, number>> = {
  instagram: 1_000,
  facebook: 2_000,
  whatsapp: 4_096,
};

export function characterLimit(
  channel: ModerationChannel,
  kind: ConversationKind,
): number | null {
  const table = kind === "dm" ? DM_LIMITS : COMMENT_LIMITS;
  return table[channel] ?? null;
}

/**
 * Les pièces jointes sortantes.
 *
 * Aucune, aujourd'hui : `sendReply` poste du texte sur les trois canaux
 * branchés — commentaire Instagram, commentaire de Page, message privé — et
 * rien de plus. Le bouton n'est donc pas **désactivé**, il est **absent** : un
 * bouton grisé promet une fonctionnalité qui n'existe pas, et on clique
 * dessus toutes les semaines en croyant à une panne.
 */
export function acceptsAttachments(
  channel: ModerationChannel,
  kind: ConversationKind,
): boolean {
  // Les paramètres existent pour le jour où un canal l'acceptera : la
  // signature ne changera pas, seul ce corps le fera.
  void channel;
  void kind;
  return false;
}
