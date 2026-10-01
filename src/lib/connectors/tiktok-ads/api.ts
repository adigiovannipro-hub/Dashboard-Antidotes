import "server-only";

import { composioClient } from "@/lib/composio/agency";
import type { TiktokAdsTransport } from "./types";

/**
 * La Marketing API de TikTok **en direct**, par le passage brut de Composio.
 *
 * Pourquoi pas les outils pré-emballés : aucun n'expose le rapport intégré
 * (`/report/integrated/get/`), qui est pourtant ce que tout rapport
 * publicitaire lit. `proxyExecute` garde l'authentification chez Composio —
 * aucun jeton TikTok ne transite ici — et rend la main sur l'URL. Les
 * chemins sont relatifs à `https://business-api.tiktok.com/open_api/v1.3`,
 * sondé le 1/10/2026.
 */
export function tiktokAdsTransport(connectedAccountId: string): TiktokAdsTransport {
  return async (endpoint, params) => {
    const response = await composioClient().tools.proxyExecute({
      endpoint,
      method: "GET",
      connectedAccountId,
      parameters: Object.entries(params).map(([name, value]) => ({
        in: "query" as const,
        name,
        value,
      })),
    });

    const status = Number(response.status ?? 0);
    const body = response.data as
      | { code?: number | string; message?: string; data?: unknown }
      | undefined;

    if (status >= 400) {
      throw new Error(`TikTok ${status} ${body?.message ?? ""}`.trim());
    }

    /* TikTok répond 200 et porte son verdict dans `code`. Une réponse sans
       `code` n'est pas une réponse de TikTok — une page trop lourde que la
       passerelle aurait rangée ailleurs, par exemple : la lire comme « zéro
       ligne » serait le silence qu'on s'interdit partout. */
    if (!body || typeof body !== "object" || body.code === undefined) {
      throw new Error("TikTok : réponse inattendue de la passerelle, sans code de retour.");
    }
    if (Number(body.code) !== 0) {
      throw new Error(`TikTok ${body.code} ${body.message ?? ""}`.trim());
    }

    return body.data;
  };
}
