/**
 * Modèle du connecteur LinkedIn organique.
 *
 * Alias de type et non `interface` : postgrest-js a besoin de l'index
 * signature implicite que TypeScript ne donne qu'aux premiers.
 *
 * Ce que LinkedIn sert vraiment, sondé sur pièce le 2 septembre 2026 :
 * la liste des pages administrées, le nombre d'abonnés du jour, et les
 * compteurs **cumulés** de publications. Il n'y a **pas** de liste des
 * publications d'une page — aucun outil de la passerelle ne l'expose — et
 * aucun découpage temporel n'est accepté sur les statistiques.
 */

/** Une page entreprise administrée par le compte connecté. */
export type LinkedinPage = {
  /** L'identifiant numérique, celui qui sert d'`external_id`. */
  id: string;
  name: string;
  vanityName: string | null;
  logoUrl: string | null;
};

/**
 * Les compteurs cumulés d'une page, tels que LinkedIn les rend.
 *
 * Cumulés depuis la création de la page : ce ne sont pas les chiffres d'une
 * période. La valeur d'une période se calcule par différence entre deux
 * relevés (`deltaBetween`).
 */
export type LinkedinLifetimeTotals = {
  impressions: number;
  /** `uniqueImpressionsCount` : les personnes atteintes, pas les affichages. */
  reach: number;
  clicks: number;
  likes: number;
  comments: number;
  shares: number;
};

export const EMPTY_LIFETIME_TOTALS: LinkedinLifetimeTotals = {
  impressions: 0,
  reach: 0,
  clicks: 0,
  likes: 0,
  comments: 0,
  shares: 0,
};

/** Les colonnes de `social_lifetime_totals` que le connecteur écrit. */
export type LifetimeColumns = LinkedinLifetimeTotals & { date: string };

/** L'exécution d'un outil LinkedIn par la passerelle. */
export type LinkedinTransport = (
  tool: string,
  args: Record<string, unknown>,
) => Promise<unknown>;
