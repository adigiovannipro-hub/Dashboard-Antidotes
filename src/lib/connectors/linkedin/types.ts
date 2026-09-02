/**
 * Modèle du connecteur LinkedIn organique.
 *
 * Alias de type et non `interface` : postgrest-js a besoin de l'index
 * signature implicite que TypeScript ne donne qu'aux premiers.
 *
 * Ce que LinkedIn sert, **sondé sur pièce** le 2 septembre 2026 contre la
 * page ANMF, par le passage HTTP brut de Composio :
 *
 *   • les statistiques de la page au grain **jour** ou **mois** ;
 *   • la liste des publications (627 sur ANMF) ;
 *   • les statistiques **par publication** ;
 *   • les **gains d'abonnés** mensuels, organiques et payants séparés.
 */

/** Une page entreprise administrée par le compte connecté. */
export type LinkedinPage = {
  /** L'identifiant numérique, celui qui sert d'`external_id`. */
  id: string;
  name: string;
  vanityName: string | null;
  logoUrl: string | null;
};

/** Les grandeurs qu'une réponse `shareStatistics` porte, toutes additives. */
export type LinkedinShareStats = {
  impressions: number;
  /** `uniqueImpressionsCount` : les personnes atteintes, pas les affichages. */
  reach: number;
  clicks: number;
  likes: number;
  comments: number;
  shares: number;
};

/** Une journée de la page. */
export type LinkedinDay = LinkedinShareStats & { date: string };

/** Le gain d'abonnés d'un mois, au 1er du mois. */
export type LinkedinFollowerGain = { month: string; gain: number };

/** Une publication de la page, telle que `/rest/posts` la rend. */
export type LinkedinPost = {
  /** L'URN complet — c'est lui qui sert de clé et de lien. */
  urn: string;
  publishedAt: string;
  commentary: string | null;
  mediaKind: "image" | "carousel" | "video";
};

/** Une requête GET sur l'API LinkedIn, déjà authentifiée. */
export type LinkedinTransport = (
  endpoint: string,
  options?: { version?: string | null },
) => Promise<unknown>;
