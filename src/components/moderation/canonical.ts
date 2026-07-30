/**
 * Reformulation d'un message entrant en question canonique.
 *
 * Le but n'est pas de deviner à la place de l'opérateur, mais de lui épargner
 * la page blanche : il corrige une proposition au lieu de rédiger. Sur cent
 * messages, c'est la différence entre dix minutes et une heure.
 */
export function proposeCanonical(message: string): string {
  // La salutation part **avant** le découpage en phrases : « Bonjour ! J'ai
  // commandé… » se découpe sinon sur le point d'exclamation, et il ne reste
  // que « Bonjour », qui devient une chaîne vide une fois nettoyée.
  const withoutGreeting = message
    .trim()
    .replace(/^(bonjour|bonsoir|salut|hello|hey|hi|coucou)\b[\s,!.…-]*/i, "")
    .trim();

  const firstSentence =
    withoutGreeting.split(/[.!?\n]/).find((part) => part.trim().length > 0)?.trim() ??
    "";
  if (!firstSentence) return "";

  const capitalized = firstSentence.charAt(0).toUpperCase() + firstSentence.slice(1);
  return capitalized.endsWith("?") ? capitalized : `${capitalized} ?`;
}
