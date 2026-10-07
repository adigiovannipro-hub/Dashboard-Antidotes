import "server-only";

import { Composio } from "@composio/core";

import { serverEnv } from "@/lib/env";
import {
  AGENCY_TOOLKIT_LABELS,
  CLIENT_TOOLKIT_LABELS,
  type AgencyToolkit,
  type ClientToolkit,
  type ComposioToolkit,
  composioSlug,
} from "./labels";
import { pickNewestAccount } from "./pick";

export {
  AGENCY_TOOLKIT_LABELS,
  CLIENT_TOOLKIT_KIND,
  CLIENT_TOOLKIT_LABELS,
  COMPOSIO_TOOLKIT_LABELS,
  composioSlug,
  isAgencyToolkit,
  isClientToolkit,
  type AgencyToolkit,
  type ClientToolkit,
  type ComposioToolkit,
} from "./labels";

/**
 * Les réseaux branchés **une fois pour toute l'agence** par la passerelle
 * Composio : un seul login LinkedIn atteint les pages de tous les clients, un
 * seul login TikTok Business atteint tous leurs comptes publicitaires.
 *
 * Deux pièges payés, et c'est ce que ce module ferme :
 *
 *   • **le tiroir** — brancher depuis le tableau de bord de Composio range la
 *     connexion dans l'espace personnel (« For You »), que la clé de projet
 *     de l'application ne voit pas. Le 1/10/2026, LinkedIn rebranché et
 *     TikTok Ads ajouté par ce chemin sont restés invisibles : l'application
 *     lisait toujours l'ancien jeton révoqué. Le lien se demande donc ici,
 *     avec la clé du projet, et le compte atterrit au bon endroit ;
 *   • **l'ancien compte** — un rebranchement s'ajoute à côté de l'ancien au
 *     lieu de le remplacer. On prend toujours le plus récent (`pick.ts`).
 */

/**
 * La configuration d'authentification à demander, quand celle que Composio
 * gère par défaut ne suffit pas.
 *
 * LinkedIn : la configuration par défaut ne demande que le profil — toute
 * lecture d'une page entreprise répond alors 403 « r_organization_admin »
 * (vécu le 2/09/2026). « linkedin-pages » porte les portées de la Community
 * Management API ; c'est celle que `scripts/composio-lien.ts` crée aussi.
 * TikTok Ads : l'OAuth géré par Composio suffit — c'est celui qui a servi au
 * branchement du 1/10/2026 dans l'espace personnel.
 * Profil LinkedIn d'un client : publier en son nom, rien de plus — lui
 * demander l'administration de pages qu'il n'a peut-être pas encombrerait
 * l'écran de consentement pour rien.
 */
const SCOPED_CONFIGS: Partial<Record<ComposioToolkit, { name: string; scopes: string[] }>> = {
  linkedin: {
    name: "linkedin-pages",
    scopes: [
      "openid",
      "profile",
      "email",
      "w_member_social",
      "r_organization_social",
      "r_organization_admin",
      "rw_organization_admin",
    ],
  },
  linkedin_profil: {
    name: "linkedin-profil",
    scopes: ["openid", "profile", "w_member_social"],
  },
};

let cached: Composio | null = null;

export function composioClient(): Composio {
  if (!cached) {
    cached = new Composio({
      apiKey: serverEnv("COMPOSIO_API_KEY").COMPOSIO_API_KEY,
    });
  }
  return cached;
}

/** L'identifiant sous lequel on range les comptes de l'agence chez Composio. */
export function agencyUserId(): string {
  return process.env.COMPOSIO_DEFAULT_USER_ID ?? "agence";
}

/**
 * L'identifiant d'un **client** chez Composio : un compte X ou TikTok
 * n'appartient qu'à lui, et deux clients branchés sous le même identifiant
 * se confondraient — le plus récent l'emportant chez l'autre.
 */
export function clientUserId(workspaceId: string): string {
  return `espace:${workspaceId}`;
}

/** Le compte d'un client pour ce réseau — le plus récent —, ou la raison de son absence. */
export async function findClientAccount(
  toolkit: ClientToolkit,
  workspaceId: string,
): Promise<{ id: string } | { error: string }> {
  const list = await composioClient().connectedAccounts.list({
    userIds: [clientUserId(workspaceId)],
    toolkitSlugs: [composioSlug(toolkit)],
    statuses: ["ACTIVE"],
  });
  const picked = pickNewestAccount(list.items);
  if (picked) return { id: picked.id };

  const label = CLIENT_TOOLKIT_LABELS[toolkit];
  return {
    error: `Aucun compte ${label} n'est branché pour ce client. Le brancher depuis Connexions (bouton « Brancher ${label} »), avec le login du client.`,
  };
}

/** Le compte de l'agence pour ce réseau — le plus récent —, ou la raison de son absence. */
export async function findAgencyAccount(
  toolkit: AgencyToolkit,
): Promise<{ id: string } | { error: string }> {
  const list = await composioClient().connectedAccounts.list({
    toolkitSlugs: [toolkit],
    statuses: ["ACTIVE"],
  });
  const picked = pickNewestAccount(list.items);
  if (picked) return { id: picked.id };

  return {
    error: `Aucun compte ${AGENCY_TOOLKIT_LABELS[toolkit]} n'est branché dans le projet Composio de l'application. Le brancher depuis Connexions (bouton « Brancher ${AGENCY_TOOLKIT_LABELS[toolkit]} ») — une connexion faite depuis le tableau de bord de Composio reste invisible de l'application.`,
  };
}

/**
 * Le lien d'autorisation, demandé **dans le projet de l'application**.
 *
 * `allowMultiple` : l'ancien compte, même mort, compte encore comme actif chez
 * Composio, et sans ce drapeau le lien serait refusé — exactement le cas d'un
 * rebranchement.
 */
export async function startAgencyConnection(options: {
  toolkit: ComposioToolkit;
  callbackUrl: string;
  /** L'identifiant Composio — celui de l'agence par défaut, celui de l'espace pour un client. */
  userId?: string;
}): Promise<string> {
  const composio = composioClient();
  const scoped = SCOPED_CONFIGS[options.toolkit];

  const slug = composioSlug(options.toolkit);
  const configs = await composio.authConfigs.list({ toolkit: slug });
  let config = scoped
    ? configs.items.find((item) => item.name === scoped.name)
    : (configs.items.find((item) => item.status === "ENABLED") ?? configs.items[0]);

  if (!config) {
    const created = await composio.authConfigs.create(slug, {
      type: "use_composio_managed_auth",
      name: scoped?.name ?? `${options.toolkit}-agence`,
      ...(scoped ? { credentials: { scopes: scoped.scopes } } : {}),
    });
    config = { id: created.id } as (typeof configs.items)[number];
  }

  const request = await composio.connectedAccounts.link(options.userId ?? agencyUserId(), config.id, {
    callbackUrl: options.callbackUrl,
    allowMultiple: true,
  });
  if (!request.redirectUrl) {
    throw new Error("Composio n'a pas rendu de lien d'autorisation.");
  }
  return request.redirectUrl;
}
