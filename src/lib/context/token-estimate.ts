/**
 * Estimation du poids en tokens du contexte injecté.
 *
 * Une approximation assumée : le vrai compte dépend du tokenizer du modèle,
 * mais l'ordre de grandeur suffit ici — le compteur sert à repérer qu'un
 * document coché alourdit inutilement les prompts, pas à facturer. Sur du
 * français courant, un token vaut environ 3,5 caractères ; on arrondit au-dessus
 * pour pécher par excès plutôt que rassurer à tort.
 */

/** Au-delà, le compteur passe en avertissement : les prompts s'alourdissent. */
export const INJECTED_CONTEXT_TOKEN_LIMIT = 6000;

const CHARS_PER_TOKEN = 3.5;

export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}
