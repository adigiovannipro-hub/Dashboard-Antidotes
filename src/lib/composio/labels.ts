/**
 * Les réseaux branchés une fois pour toute l'agence par Composio, et leur nom
 * à l'écran. Module sans `server-only` : la boîte Connexions, côté
 * navigateur, en a besoin autant que les routes.
 */

export type AgencyToolkit = "linkedin" | "tiktok_ads";

export const AGENCY_TOOLKIT_LABELS: Record<AgencyToolkit, string> = {
  linkedin: "LinkedIn",
  tiktok_ads: "TikTok Ads",
};

export function isAgencyToolkit(value: string): value is AgencyToolkit {
  return value in AGENCY_TOOLKIT_LABELS;
}
