/**
 * Modèle des comptes sociaux.
 *
 * Aligné sur `supabase/migrations/0043_social_accounts.sql` et
 * `0044_social_accounts_par_organisation.sql`. Alias de type et non
 * `interface` : postgrest-js a besoin de l'index signature implicite que
 * TypeScript ne donne qu'aux premiers.
 *
 * Deux niveaux, à ne pas confondre :
 *
 *   `SocialAccountRow`      ce que le login Meta de l'agence atteint
 *   `WorkspaceSocialLink`   ce que **ce client** utilise, un par réseau
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

/** À quoi sert le compte affecté, dit sur l'écran d'affectation. */
export const SOCIAL_ACCOUNT_PURPOSE: Record<SocialAccountKind, string> = {
  instagram: "Publication et prévisualisation du feed",
  facebook_page: "Publication sur la Page",
  meta_ad_account: "Chiffres de campagnes du Reporting",
  linkedin: "Publication sur la page entreprise",
  tiktok: "Publication sur le compte",
};

export type SocialAccountStatus = "connected" | "expired" | "error" | "disabled";

export const SOCIAL_STATUS_LABELS: Record<SocialAccountStatus, string> = {
  connected: "Connecté",
  expired: "Jeton expiré",
  error: "En erreur",
  disabled: "Désactivé",
};

/** Ce qu'un seul branchement Meta rapporte, et donc ce qui s'affecte ici. */
export const META_KINDS: SocialAccountKind[] = [
  "instagram",
  "facebook_page",
  "meta_ad_account",
];

export function isSocialAccountKind(value: string): value is SocialAccountKind {
  return value in SOCIAL_ACCOUNT_LABELS;
}

/**
 * Une ligne de l'inventaire.
 *
 * Le jeton n'y figure pas : il vit dans `social_account_secrets`, hors de
 * portée d'un membre d'espace. Ce type traverse jusqu'au navigateur.
 */
export type SocialAccountRow = {
  id: string;
  org_id: string;
  kind: SocialAccountKind;
  external_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  biography: string | null;
  followers_count: number | null;
  media_count: number | null;
  parent_external_id: string | null;
  status: SocialAccountStatus;
  last_error: string | null;
  last_synced_at: string | null;
  connected_by: string | null;
  created_at: string;
  updated_at: string;
};

/** L'affectation d'un compte à un client, un par réseau. */
export type WorkspaceSocialLink = {
  workspace_id: string;
  kind: SocialAccountKind;
  account_id: string;
  org_id: string;
  assigned_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Ce que l'écran d'affectation lit : le choix par réseau, ou rien. */
export type SocialSelection = Partial<Record<SocialAccountKind, string>>;

export function selectionFromLinks(
  links: WorkspaceSocialLink[],
): SocialSelection {
  const selection: SocialSelection = {};
  for (const link of links) selection[link.kind] = link.account_id;
  return selection;
}

/**
 * La vitrine d'un compte Instagram, telle que l'en-tête de la prévisualisation
 * du feed la lit.
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

/**
 * Le nom lisible d'un compte, sans jamais rendre une chaîne vide.
 *
 * Un compte publicitaire Meta arrive souvent sans nom : `act_1234…` vaut mieux
 * qu'une ligne muette dans une liste de choix.
 */
export function socialAccountName(account: SocialAccountRow): string {
  return account.display_name ?? account.username ?? account.external_id;
}
