/**
 * Les réseaux branchés par Composio, et leur nom à l'écran. Module sans
 * `server-only` : la boîte Connexions, côté navigateur, en a besoin autant
 * que les routes.
 *
 * Deux familles, qui ne se branchent pas de la même façon :
 *
 *   • **l'agence** — un seul login LinkedIn atteint les pages de tous les
 *     clients, un seul login TikTok Business tous leurs comptes
 *     publicitaires ;
 *   • **le client** — un compte X ou TikTok n'appartient qu'à une personne :
 *     il se branche depuis l'espace du client, par son propre login, et se
 *     range chez Composio sous un identifiant propre à l'espace.
 */

export type AgencyToolkit = "linkedin" | "tiktok_ads";

export const AGENCY_TOOLKIT_LABELS: Record<AgencyToolkit, string> = {
  linkedin: "LinkedIn",
  tiktok_ads: "TikTok Ads",
};

export function isAgencyToolkit(value: string): value is AgencyToolkit {
  return value in AGENCY_TOOLKIT_LABELS;
}

/** Le slug Composio — `twitter` pour X, le nom que Composio garde. */
export type ClientToolkit = "twitter" | "tiktok";

export const CLIENT_TOOLKIT_LABELS: Record<ClientToolkit, string> = {
  twitter: "X",
  tiktok: "TikTok",
};

/** Le type de compte social que chaque branchement client rapporte. */
export const CLIENT_TOOLKIT_KIND = {
  twitter: "x",
  tiktok: "tiktok",
} as const satisfies Record<ClientToolkit, string>;

export function isClientToolkit(value: string): value is ClientToolkit {
  return value in CLIENT_TOOLKIT_LABELS;
}

export type ComposioToolkit = AgencyToolkit | ClientToolkit;

export const COMPOSIO_TOOLKIT_LABELS: Record<ComposioToolkit, string> = {
  ...AGENCY_TOOLKIT_LABELS,
  ...CLIENT_TOOLKIT_LABELS,
};
