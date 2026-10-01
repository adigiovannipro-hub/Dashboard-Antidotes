/**
 * Quel compte Composio utiliser quand le projet en porte plusieurs.
 *
 * Rebrancher un compte chez Composio ne remplace pas l'ancien : la connexion
 * neuve s'ajoute à côté, et l'ancienne reste « ACTIVE » tant que Composio n'a
 * pas essayé de rafraîchir son jeton — même quand LinkedIn l'a révoqué depuis
 * des semaines. Prendre « le premier de la liste » ramenait donc l'ancien
 * jeton mort après chaque rebranchement (vécu le 1/10/2026 : « REVOKED_ACCESS_TOKEN »
 * jour après jour, reconnexion ou pas), et refuser de trancher entre deux
 * comptes bloquait tout.
 *
 * Pour un réseau branché **une fois pour toute l'agence** — LinkedIn,
 * TikTok Ads —, la règle est simple : la connexion la plus récente est celle
 * qu'on vient de faire, donc celle qu'on veut. Pur, sans Composio.
 */

export type ComposioAccountLike = {
  id: string;
  isDisabled: boolean;
  createdAt?: string | null;
};

export function pickNewestAccount<T extends ComposioAccountLike>(
  items: readonly T[],
): T | null {
  const usable = items.filter((item) => !item.isDisabled);
  if (usable.length === 0) return null;

  // Une date absente ou illisible passe derrière toutes les autres : on ne
  // préfère jamais un compte dont on ne sait pas l'âge à un compte daté.
  const time = (item: T) => {
    const value = item.createdAt ? Date.parse(item.createdAt) : Number.NaN;
    return Number.isFinite(value) ? value : -Infinity;
  };

  return [...usable].sort((a, b) => time(b) - time(a))[0] ?? null;
}
