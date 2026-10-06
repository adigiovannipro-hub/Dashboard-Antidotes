/**
 * Les formes du connecteur TikTok Ads.
 *
 * Toutes **sondées sur pièce** le 1/10/2026 contre le compte publicitaire
 * d'ANMF (« Chasseurs de Graines »), par le passage brut de Composio sur la
 * Marketing API (`business-api.tiktok.com/open_api/v1.3`) — rien de ce qui
 * suit n'est recopié d'une documentation.
 */

/** Un compte publicitaire, tel que l'inventaire de l'agence le range. */
export type TiktokAdvertiser = {
  id: string;
  name: string;
  /** Le Business Center qui le porte — « ANMF », « I-VENT »… */
  businessCenterId: string;
  businessCenterName: string | null;
};

/** Une ligne du rapport intégré : des dimensions, des métriques, tout en chaînes. */
export type TiktokReportRow = {
  dimensions?: Record<string, string | null | undefined>;
  metrics?: Record<string, string | number | null | undefined>;
};

/**
 * Le transport : un GET sur la Marketing API, qui rend le champ `data` de la
 * réponse. TikTok répond **toujours** 200 et porte son verdict dans `code` :
 * le transport doit lever sur un `code` non nul, sans quoi un refus se
 * lirait « aucune donnée ».
 */
export type TiktokAdsTransport = (
  endpoint: string,
  params: Record<string, string>,
) => Promise<unknown>;
