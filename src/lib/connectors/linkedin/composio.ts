import "server-only";

import { Composio } from "@composio/core";

import { serverEnv } from "@/lib/env";
import type { LinkedinTransport } from "./types";

/**
 * Le transport Composio — la passerelle qui porte l'application OAuth
 * LinkedIn et ses jetons. Antidotes ne voit jamais un jeton LinkedIn : il
 * demande une lecture, Composio s'authentifie et transmet la réponse.
 *
 * C'est pourquoi LinkedIn n'écrit **rien** dans `social_account_secrets`,
 * contrairement à Meta et YouTube : il n'y a pas de secret à chiffrer de
 * notre côté.
 *
 * L'identité suit `docs/composio-setup.md`. On cherche d'abord un compte
 * rangé sous l'identifiant de l'espace ; à défaut, s'il n'existe **qu'un
 * seul** compte LinkedIn actif dans le projet, on le prend — c'est le cas
 * de l'agence, dont un seul login atteint les six pages clientes. Deux
 * comptes sans identifiant d'espace, en revanche, ne se départagent pas en
 * devinant.
 */

const TOOLKIT = "linkedin";

export const ORG_ACLS = "LINKEDIN_GET_COMPANY_INFO";
export const NETWORK_SIZE = "LINKEDIN_GET_NETWORK_SIZE";
export const SHARE_STATS = "LINKEDIN_GET_SHARE_STATS";

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
 * Le compte LinkedIn à utiliser, ou la raison de son absence. Jamais
 * d'exception ici : l'appelant range la cause dans `data_sources.last_error`,
 * où l'écran la montre.
 */
export async function findLinkedinConnectedAccount(
  workspaceId: string,
): Promise<{ id: string; userId: string } | { error: string }> {
  const composio = client();

  const scoped = await composio.connectedAccounts.list({
    toolkitSlugs: [TOOLKIT],
    statuses: ["ACTIVE"],
    userIds: [workspaceId],
  });
  const scopedActive = scoped.items.filter((item) => !item.isDisabled);
  if (scopedActive[0]) return { id: scopedActive[0].id, userId: workspaceId };

  const all = await composio.connectedAccounts.list({
    toolkitSlugs: [TOOLKIT],
    statuses: ["ACTIVE"],
  });
  const active = all.items.filter((item) => !item.isDisabled);
  if (active.length === 1 && active[0]) {
    return { id: active[0].id, userId: agencyUserId() };
  }

  if (active.length === 0) {
    return {
      error:
        "Aucun compte LinkedIn n'est connecté dans le projet Composio. Brancher le compte par le workflow « Composio — lien de connexion », toolkit linkedin.",
    };
  }
  return {
    error: `${active.length} comptes LinkedIn sont connectés chez Composio et aucun ne porte l'identifiant de cet espace : connecter le bon compte sous l'identifiant ${workspaceId}.`,
  };
}

/**
 * L'identifiant sous lequel le compte de l'agence est rangé.
 *
 * Composio l'exige à l'exécution manuelle d'un outil et ne le rend pas dans
 * la liste des comptes — sans lui, l'appel échoue sur « Toolkit version not
 * specified », message qui accuse la version alors que rien n'est en cause
 * (payé le 2 septembre 2026). Il vaut « agence », comme le lien de
 * connexion, et se surcharge par l'environnement.
 */
function agencyUserId(): string {
  return process.env.COMPOSIO_DEFAULT_USER_ID ?? "agence";
}

/** Le transport de production : un outil LinkedIn via la passerelle. */
export function linkedinTransport(account: {
  id: string;
  userId: string;
}): LinkedinTransport {
  return async (tool, args) => {
    /* Composio refuse « latest » à l'exécution manuelle d'un outil et
       n'accepte qu'une version datée. `COMPOSIO_LINKEDIN_TOOL_VERSION`
       permet d'en épingler une ; à défaut on lève le garde-fou plutôt que
       de figer une version qui périmera — les lectures d'ici sont en
       lecture seule et leur forme est vérifiée à la lecture. */
    const version = process.env.COMPOSIO_LINKEDIN_TOOL_VERSION ?? "latest";
    const result = await client().tools.execute(tool, {
      userId: account.userId,
      connectedAccountId: account.id,
      version,
      dangerouslySkipVersionCheck: version === "latest",
      arguments: args,
    });

    if (!result.successful) {
      throw new Error(
        typeof result.error === "string" && result.error.length > 0
          ? result.error
          : "Réponse Composio sans détail d'erreur.",
      );
    }

    return result.data ?? {};
  };
}
