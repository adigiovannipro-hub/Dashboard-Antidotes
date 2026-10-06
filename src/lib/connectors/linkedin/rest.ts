import "server-only";

import { composioClient, findAgencyAccount } from "@/lib/composio/agency";

/**
 * L'API LinkedIn **en direct**, par le passage HTTP brut de Composio.
 *
 * Pourquoi pas ses outils pré-emballés : `LINKEDIN_GET_SHARE_STATS` refuse
 * tout `timeIntervals`, et aucun outil n'expose les publications d'une
 * page. Ce ne sont pas des limites de LinkedIn — l'API sert les deux, et le
 * reste du monde en fait des rapports — mais des limites de l'emballage.
 * `proxyExecute` rend la main sur l'URL, les en-têtes et la syntaxe RestLi,
 * en gardant l'authentification chez Composio : aucun jeton ne transite ici.
 *
 * Tout a été **sondé sur pièce** le 2 septembre 2026 contre la page ANMF,
 * et rien de ce qui suit n'est supposé.
 */

/**
 * La version d'API des routes `/rest/`.
 *
 * LinkedIn ne garde qu'une année de versions, et la fenêtre n'est pas un
 * intervalle continu : au balayage du 2 septembre 2026, 202606, 202603,
 * 202601 et 202510 répondaient, 202512 et 202508 non. Elle se surcharge par
 * l'environnement le jour où celle-ci meurt — sans quoi il faudrait un
 * déploiement pour un simple numéro.
 */
export function linkedinVersion(): string {
  return process.env.LINKEDIN_API_VERSION ?? "202606";
}

const client = composioClient;

/**
 * Le nombre d'abonnés d'une page — par l'outil pré-emballé, et lui seul.
 *
 * C'est la seule lecture où l'emballage fait mieux que le passage brut :
 * `/v2/networkSizes/{urn}?edgeType=…` répond « Data Processing Exception
 * while processing fields [/edgeType] » à travers le proxy, qui réencode
 * l'énumération, tandis que `LINKEDIN_GET_NETWORK_SIZE` rend le compte sans
 * broncher (6 711 sur ANMF, vérifié deux fois). On ne répare pas ce qui
 * marche : le brut sert là où l'emballage bride, pas ailleurs.
 */
export async function fetchFollowersCount(options: {
  connectedAccountId: string;
  organizationId: string;
}): Promise<number | null> {
  const version = process.env.COMPOSIO_LINKEDIN_TOOL_VERSION ?? "latest";
  const result = await client().tools.execute("LINKEDIN_GET_NETWORK_SIZE", {
    userId: process.env.COMPOSIO_DEFAULT_USER_ID ?? "agence",
    connectedAccountId: options.connectedAccountId,
    version,
    dangerouslySkipVersionCheck: version === "latest",
    arguments: { organization_id: options.organizationId },
  });

  if (!result.successful) {
    throw new Error(
      typeof result.error === "string" && result.error.length > 0
        ? result.error
        : "Réponse Composio sans détail d'erreur.",
    );
  }

  const size = (result.data as { firstDegreeSize?: number } | undefined)?.firstDegreeSize;
  return typeof size === "number" && Number.isFinite(size) ? size : null;
}

export type LinkedinRest = (
  endpoint: string,
  options?: { version?: string | null },
) => Promise<unknown>;

/**
 * Le compte LinkedIn de l'agence chez Composio, ou la raison de son absence.
 *
 * Le plus récent des comptes actifs : un rebranchement s'ajoute à côté de
 * l'ancien, qui reste « actif » chez Composio même révoqué par LinkedIn.
 * Voir `src/lib/composio/agency.ts`.
 */
export async function findLinkedinAccount(): Promise<{ id: string } | { error: string }> {
  return findAgencyAccount("linkedin");
}

/**
 * Le transport : une requête GET authentifiée sur l'API LinkedIn.
 *
 * `version: null` vise l'ancienne API `/v2`, qui n'a pas d'en-tête de
 * version — elle sert les mêmes statistiques et survit aux péremptions.
 */
export function linkedinRest(connectedAccountId: string): LinkedinRest {
  return async (endpoint, options) => {
    const version = options?.version === undefined ? linkedinVersion() : options.version;

    const response = await client().tools.proxyExecute({
      endpoint,
      method: "GET",
      connectedAccountId,
      parameters: version
        ? [
            { in: "header", name: "LinkedIn-Version", value: version },
            { in: "header", name: "X-Restli-Protocol-Version", value: "2.0.0" },
          ]
        : [{ in: "header", name: "X-Restli-Protocol-Version", value: "2.0.0" }],
    });

    /* Le passage brut rend le corps **et** le code : un refus de LinkedIn
       arrive en 200 côté Composio avec un 4xx dedans. Sans ce test, une
       erreur d'autorisation se lirait « aucune donnée » — exactement le
       silence qu'on s'interdit partout ailleurs. */
    const status = Number(response.status ?? 0);
    if (status >= 400) {
      const body = response.data as { message?: string; code?: string } | undefined;
      throw new Error(
        `LinkedIn ${status} ${body?.code ?? ""} ${body?.message ?? ""}`.trim(),
      );
    }

    return response.data;
  };
}

/** Minuit UTC d'un jour donné, en millisecondes — la borne que RestLi attend. */
export function utcMidnight(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

/** Un intervalle RestLi, la seule syntaxe que LinkedIn accepte. */
export function timeInterval(
  from: string,
  to: string,
  granularity: "DAY" | "MONTH",
): string {
  /* Bornes **alignées sur minuit** : LinkedIn refuse un intervalle posé sur
     un instant quelconque (« Bad request … time intervals »), ce qu'un
     `Date.now()` brut produit à tous les coups. La borne haute est
     exclusive — le lendemain du dernier jour voulu. */
  const start = utcMidnight(from);
  const end = utcMidnight(to) + 86_400_000;
  return `(timeRange:(start:${start},end:${end}),timeGranularityType:${granularity})`;
}
