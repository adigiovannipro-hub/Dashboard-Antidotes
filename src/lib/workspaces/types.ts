/**
 * Modèle de l'administration d'un espace : ses pages, ses partenaires, et
 * les droits des seconds sur les premières.
 *
 * Alias de type et non `interface` : postgrest-js a besoin de l'index
 * signature implicite que TypeScript ne donne qu'aux premiers pour inférer
 * les résultats de requête.
 */
import type { WorkspaceRole } from "@/lib/supabase/database.types";

/** Clé de la page Planning Éditorial ; les autres sont des slugs de tableau. */
export const PLANNING_PAGE_KEY = "planning";

/**
 * Clé de la page FAQ.
 *
 * La FAQ était un onglet de la section Planning — un `planning_board` de
 * `kind = 'faq'`. Le retour d'écran du 11/09 l'en sort : c'est une page du
 * menu de l'espace, entre le Contexte et le Planning. Elle n'a pas de slug de
 * tableau, d'où une clé en dur comme celle du planning.
 */
export const FAQ_PAGE_KEY = "faq";

/**
 * La page Contexte n'apparaît jamais dans la matrice de droits : elle est
 * réservée à l'owner, et un droit qu'on pourrait cocher laisserait croire
 * qu'elle se partage.
 */
export const NEVER_SHARED_PAGE_KEYS = ["contexte"] as const;

/** Une page de l'espace, telle qu'elle apparaît dans la navigation. */
export type WorkspacePage = {
  key: string;
  name: string;
};

export type WorkspacePartnerStatus = "active" | "invited";

export const PARTNER_STATUS_LABELS: Record<WorkspacePartnerStatus, string> = {
  active: "Accès ouvert",
  invited: "Invitation en attente",
};

export const PARTNER_ROLE_LABELS: Record<WorkspaceRole, string> = {
  contributor: "Contributeur",
  client: "Client",
};

/** Un partenaire de l'espace : compte déjà ouvert, ou invitation en attente. */
export type WorkspacePartner = {
  email: string;
  role: WorkspaceRole;
  status: WorkspacePartnerStatus;
  userId: string | null;
  invitationId: string | null;
  /** Pages explicitement masquées ; tout le reste est visible. */
  hiddenPages: string[];
};

export type WorkspacePageGrant = {
  workspace_id: string;
  email: string;
  page_key: string;
  visible: boolean;
  created_at: string;
};
