import "server-only";

import { Composio } from "@composio/core";

import { serverEnv } from "@/lib/env";
import type { GaRunReportRequest, GaRunReportResponse, GaTransport } from "./types";

/**
 * Le transport Composio — la passerelle qui porte l'application OAuth Google
 * et ses jetons. Antidotes ne voit jamais un jeton Google : il demande un
 * rapport, Composio s'authentifie et transmet la réponse de l'API GA telle
 * quelle.
 *
 * L'identité suit `docs/composio-setup.md` : les comptes sont connectés sous
 * l'UUID de l'espace client. On cherche donc d'abord un compte connecté sous
 * cet identifiant ; à défaut, s'il n'existe **qu'un seul** compte Google
 * Analytics actif dans le projet, on le prend — c'est le cas d'un projet qui
 * démarre, et exiger la cérémonie complète bloquerait la première collecte.
 * Deux comptes sans identifiant d'espace, en revanche, ne se départagent pas
 * en devinant.
 */

const TOOLKIT = "google_analytics";
const RUN_REPORT = "GOOGLE_ANALYTICS_RUN_REPORT";

let cached: Composio | null = null;

function client(): Composio {
  if (!cached) {
    cached = new Composio({
      apiKey: serverEnv("COMPOSIO_API_KEY").COMPOSIO_API_KEY,
    });
  }
  return cached;
}

/**
 * Le compte Google Analytics à utiliser pour un espace, ou la raison de son
 * absence. Jamais d'exception ici : l'appelant range la cause dans
 * `data_sources.last_error`, où l'écran la montre.
 */
export async function findGaConnectedAccountId(
  workspaceId: string,
): Promise<{ id: string } | { error: string }> {
  const composio = client();

  // D'abord le compte rattaché à cet espace — le rangement nominal.
  const scoped = await composio.connectedAccounts.list({
    toolkitSlugs: [TOOLKIT],
    statuses: ["ACTIVE"],
    userIds: [workspaceId],
  });
  const scopedActive = scoped.items.filter((item) => !item.isDisabled);
  if (scopedActive[0]) return { id: scopedActive[0].id };

  const all = await composio.connectedAccounts.list({
    toolkitSlugs: [TOOLKIT],
    statuses: ["ACTIVE"],
  });
  const active = all.items.filter((item) => !item.isDisabled);
  if (active.length === 1 && active[0]) return { id: active[0].id };

  if (active.length === 0) {
    return {
      error:
        "Aucun compte Google Analytics n'est connecté chez Composio. Brancher le compte Google depuis le tableau de bord Composio (voir docs/web-analytics-setup.md).",
    };
  }
  return {
    error: `${active.length} comptes Google Analytics sont connectés chez Composio et aucun ne porte l'identifiant de cet espace : connecter le bon compte sous l'identifiant ${workspaceId} (voir docs/web-analytics-setup.md).`,
  };
}

/** Le transport de production : un `runReport` GA via la passerelle. */
export function gaTransport(options: {
  workspaceId: string;
  connectedAccountId: string;
}): GaTransport {
  return async (request: GaRunReportRequest): Promise<GaRunReportResponse> => {
    const result = await client().tools.execute(RUN_REPORT, {
      userId: options.workspaceId,
      connectedAccountId: options.connectedAccountId,
      arguments: request as unknown as Record<string, unknown>,
    });

    if (!result.successful) {
      throw new Error(
        typeof result.error === "string" && result.error.length > 0
          ? result.error
          : "Réponse Composio sans détail d'erreur.",
      );
    }
    return (result.data ?? {}) as GaRunReportResponse;
  };
}
