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

/**
 * Les réseaux qu'un compte peut représenter.
 *
 * Aligné sur `social_account_kind`, étendu par
 * `0049_reseaux_a_connecter.sql`. Tous ne se branchent pas aujourd'hui —
 * seul Meta a un connecteur — mais tous se **déclarent** : un client qui a
 * YouTube à son contrat doit voir YouTube dans ses connexions, avec la vérité
 * en face plutôt qu'une absence de ligne. Voir `CONNECTABLE_KINDS`.
 */
export type SocialAccountKind =
  | "instagram"
  | "facebook_page"
  | "meta_ad_account"
  | "linkedin"
  | "tiktok"
  | "youtube"
  | "pinterest"
  | "x"
  | "threads"
  | "snapchat";

export const SOCIAL_ACCOUNT_LABELS: Record<SocialAccountKind, string> = {
  instagram: "Instagram",
  facebook_page: "Page Facebook",
  meta_ad_account: "Compte publicitaire Meta",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  pinterest: "Pinterest",
  x: "X",
  threads: "Threads",
  snapchat: "Snapchat",
};

/** À quoi sert le compte affecté, dit sur l'écran d'affectation. */
export const SOCIAL_ACCOUNT_PURPOSE: Record<SocialAccountKind, string> = {
  instagram: "Publication et prévisualisation du feed",
  facebook_page: "Publication sur la Page",
  meta_ad_account: "Chiffres de campagnes du Reporting",
  linkedin: "Publication sur la page entreprise",
  tiktok: "Publication sur le compte",
  youtube: "Publication sur la chaîne",
  pinterest: "Épingles du compte",
  x: "Publication sur le compte",
  threads: "Publication sur le compte",
  snapchat: "Publication sur le compte",
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

/**
 * Les réseaux qu'un connecteur sait réellement remplir aujourd'hui.
 *
 * Meta, et rien d'autre. Les sept autres se déclarent, s'affichent et
 * attendent leur connecteur — l'écran le dit en toutes lettres plutôt que de
 * montrer une liste de choix vide, qui laisserait croire à une panne.
 *
 * C'est la seule chose à changer le jour où LinkedIn arrive.
 */
/**
 * Les réseaux qu'on sait réellement brancher.
 *
 * Meta d'un côté — un login, trois comptes —, YouTube de l'autre, qui demande
 * son propre aller-retour Google : les deux n'ont ni la même app, ni le même
 * périmètre d'autorisation. Le reste s'affiche sans bouton plutôt que d'offrir
 * une liste vide qui se lirait comme une panne.
 */
export const CONNECTABLE_KINDS: SocialAccountKind[] = [...META_KINDS, "youtube"];

/** Par quel branchement passe un réseau — chaque famille a sa route OAuth. */
export function connectorOf(kind: SocialAccountKind): "meta" | "youtube" | null {
  if (META_KINDS.includes(kind)) return "meta";
  if (kind === "youtube") return "youtube";
  return null;
}

export function isConnectable(kind: SocialAccountKind): boolean {
  return CONNECTABLE_KINDS.includes(kind);
}

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
