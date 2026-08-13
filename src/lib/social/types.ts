/**
 * Modèle des comptes sociaux branchés à un espace.
 *
 * Aligné sur `supabase/migrations/0040_social_accounts.sql`. Alias de type et
 * non `interface` : postgrest-js a besoin de l'index signature implicite que
 * TypeScript ne donne qu'aux premiers.
 */

export type SocialAccountKind =
  | "instagram"
  | "facebook_page"
  | "meta_ad_account"
  | "linkedin"
  | "tiktok";

export const SOCIAL_ACCOUNT_LABELS: Record<SocialAccountKind, string> = {
  instagram: "Instagram",
  facebook_page: "Page Facebook",
  meta_ad_account: "Compte publicitaire Meta",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
};

/** Ce que chaque compte apporte, dit en clair sur l'écran de connexion. */
export const SOCIAL_ACCOUNT_PURPOSE: Record<SocialAccountKind, string> = {
  instagram: "Publier, et prévisualiser le feed du planning.",
  facebook_page: "Publier et programmer sur la Page.",
  meta_ad_account: "Alimenter le Reporting en chiffres de campagnes.",
  linkedin: "Publier sur la page entreprise.",
  tiktok: "Publier sur le compte.",
};

export type SocialAccountStatus = "connected" | "expired" | "error" | "disabled";

export const SOCIAL_STATUS_LABELS: Record<SocialAccountStatus, string> = {
  connected: "Connecté",
  expired: "Jeton expiré",
  error: "En erreur",
  disabled: "Désactivé",
};

/** Ce qui arrive d'un seul branchement Meta. */
export const META_KINDS: SocialAccountKind[] = [
  "instagram",
  "facebook_page",
  "meta_ad_account",
];

export type SocialAccountRow = {
  id: string;
  workspace_id: string;
  kind: SocialAccountKind;
  external_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  biography: string | null;
  followers_count: number | null;
  media_count: number | null;
  credentials_encrypted: string | null;
  token_expires_at: string | null;
  scopes: string[];
  parent_external_id: string | null;
  status: SocialAccountStatus;
  last_error: string | null;
  last_synced_at: string | null;
  connected_by: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * La vitrine d'un compte Instagram, telle que l'en-tête de la prévisualisation
 * du feed la lit. Jamais le jeton : ce type traverse jusqu'au navigateur.
 */
export type InstagramProfile = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  biography: string | null;
  followers_count: number | null;
  media_count: number | null;
};

export function toInstagramProfile(row: SocialAccountRow): InstagramProfile {
  return {
    username: row.username ?? row.display_name ?? "compte",
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    biography: row.biography,
    followers_count: row.followers_count,
    media_count: row.media_count,
  };
}
