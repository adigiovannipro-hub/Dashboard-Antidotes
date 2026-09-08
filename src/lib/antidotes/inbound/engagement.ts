/**
 * Le score d'engagement d'un post, **relatif à l'audience** de son auteur.
 *
 * Un post à 300 réactions n'est pas le même signal chez un compte de 2 000
 * abonnés et chez un compte de 200 000 : c'est le premier qui a trouvé un
 * sujet, le second a trouvé une audience. On rapporte donc les interactions
 * aux abonnés au moment du relevé. Les commentaires pèsent plus qu'un like,
 * les partages plus qu'un commentaire — c'est le geste qui coûte qui compte.
 *
 * Module pur : les grandeurs sont stockées brutes, le score se calcule ici,
 * au rendu — comme tout ratio dans ce dépôt.
 */

import type { PostMetrics } from "../types";

export const WEIGHTS = { likes: 1, comments: 3, shares: 5 } as const;

/** Les interactions pondérées, sans les vues : une vue n'est pas un geste. */
export function weightedInteractions(metrics: PostMetrics): number {
  return (
    (metrics.likes ?? 0) * WEIGHTS.likes +
    (metrics.comments ?? 0) * WEIGHTS.comments +
    (metrics.shares ?? 0) * WEIGHTS.shares
  );
}

export type EngagementScore = {
  interactions: number;
  /** Interactions pour mille abonnés ; `null` sans dénominateur connu. */
  perThousand: number | null;
  /** Ce qu'on trie : le relatif quand il existe, l'absolu sinon. */
  sortKey: number;
  relative: boolean;
};

export function engagementScore(metrics: PostMetrics, followers: number | null | undefined): EngagementScore {
  const interactions = weightedInteractions(metrics);
  const base = followers ?? metrics.followers_at_collect ?? null;
  if (base && base > 0) {
    const perThousand = (interactions / base) * 1000;
    return { interactions, perThousand, sortKey: perThousand, relative: true };
  }
  return { interactions, perThousand: null, sortKey: interactions, relative: false };
}

/** `4,2 ‰` ou `312 interactions` — ce que la carte affiche. */
export function formatEngagement(score: EngagementScore): string {
  if (score.perThousand !== null) {
    const value = score.perThousand >= 10 ? Math.round(score.perThousand) : Math.round(score.perThousand * 10) / 10;
    return `${value.toLocaleString("fr-FR")} ‰`;
  }
  return `${score.interactions.toLocaleString("fr-FR")} interaction${score.interactions > 1 ? "s" : ""}`;
}
