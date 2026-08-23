import "server-only";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/supabase/database.types";

import {
  PLANNING_PAGE_KEY,
  type WorkspacePage,
  type WorkspacePageGrant,
  type WorkspacePartner,
} from "./types";

/**
 * Lectures de l'administration d'un espace.
 *
 * L'erreur Supabase est volontairement ignorée, comme partout dans les
 * `queries.ts` : la RLS est l'autorité, et une liste vide est la bonne
 * réponse pour qui n'a droit à rien.
 */

/** Un tableau de bord homonyme du planning ferait deux entrées identiques. */
function isPlanningLike(name: string): boolean {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .includes("planning");
}

/**
 * Les pages de l'espace, dans l'ordre de la navigation.
 *
 * Source unique du rail comme de la matrice de droits : les deux listes
 * doivent être la même, sinon on coche un droit sur une page qui n'existe
 * pas, ou on masque une page qui reste dans le menu. La page Contexte n'y
 * figure pas, elle ne se partage jamais.
 */
export async function listWorkspacePages(workspaceId: string): Promise<WorkspacePage[]> {
  const supabase = await createClient();

  const [{ data: boards }, { data: dashboards }] = await Promise.all([
    supabase.from("planning_boards").select("id").eq("workspace_id", workspaceId).limit(1),
    supabase
      .from("dashboards")
      .select("slug, name")
      .eq("workspace_id", workspaceId)
      .order("position"),
  ]);

  const pages: WorkspacePage[] = [];

  // Le planning passe avant le reporting : on prépare le mois en cours bien
  // plus souvent qu'on ne relit les chiffres du mois dernier.
  if ((boards ?? []).length > 0) {
    pages.push({ key: PLANNING_PAGE_KEY, name: "Planning Éditorial" });
  }

  for (const dashboard of dashboards ?? []) {
    if (isPlanningLike(dashboard.name)) continue;
    pages.push({ key: dashboard.slug, name: dashboard.name });
  }

  return pages;
}

/**
 * Le tableau de bord d'entrée de chaque espace — sa page « reporting ».
 *
 * Une seule requête pour tous les espaces : l'accueil affiche jusqu'à N
 * cartes, et `listWorkspacePages()` en ferait deux par carte. Un espace sans
 * tableau de bord n'a pas d'entrée dans la carte renvoyée — le lien ne doit
 * pas exister plutôt que pointer une page inexistante.
 *
 * Sans ça, « Ouvrir le reporting » visait `/espace/[slug]`, qui n'est qu'une
 * porte : elle redirige vers la première page de l'espace, et le planning
 * passe **avant** le reporting dans `listWorkspacePages()`. Le menu ouvrait
 * donc toujours le planning éditorial.
 */
export async function listReportingSlugs(
  workspaceIds: string[],
): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  if (workspaceIds.length === 0) return found;

  const supabase = await createClient();
  const { data } = await supabase
    .from("dashboards")
    .select("workspace_id, slug, name")
    .in("workspace_id", workspaceIds)
    .order("position")
    .limit(200);

  for (const dashboard of (data ?? []) as unknown as {
    workspace_id: string;
    slug: string;
    name: string;
  }[]) {
    if (isPlanningLike(dashboard.name)) continue;
    if (found.has(dashboard.workspace_id)) continue;
    found.set(dashboard.workspace_id, dashboard.slug);
  }

  return found;
}

/**
 * Les pages masquées à une adresse. Absence de ligne vaut visible : un
 * partenaire invité sans passer par la matrice voit l'espace entier.
 */
export async function listHiddenPages(
  workspaceId: string,
  email: string,
): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_page_grants")
    .select("page_key, visible")
    .eq("workspace_id", workspaceId)
    .eq("email", email.trim().toLowerCase());

  const rows = (data ?? []) as unknown as WorkspacePageGrant[];
  return new Set(rows.filter((row) => !row.visible).map((row) => row.page_key));
}

/**
 * Les partenaires d'un espace, comptes ouverts et invitations en attente
 * confondus.
 *
 * Client `service_role` assumé, comme la page d'administration des accès :
 * l'écran doit montrer les adhésions de *tous* les utilisateurs, ce que la
 * RLS restreint volontairement pour chacun. La garde owner est faite par
 * l'appelant, avant d'arriver ici.
 */
export async function listWorkspacePartners(
  workspaceId: string,
): Promise<WorkspacePartner[]> {
  const admin = createAdminClient();

  const [{ data: memberships }, { data: invitations }, { data: grants }] = await Promise.all([
    admin.from("memberships").select("user_id, role").eq("workspace_id", workspaceId),
    admin
      .from("invitations")
      .select("id, email, role")
      .eq("workspace_id", workspaceId)
      .is("accepted_at", null),
    admin
      .from("workspace_page_grants")
      .select("email, page_key, visible")
      .eq("workspace_id", workspaceId),
  ]);

  const userIds = (memberships ?? []).map((membership) => membership.user_id);
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id, email").in("id", userIds)
    : { data: [] };

  const emailByUser = new Map((profiles ?? []).map((profile) => [profile.id, profile.email]));

  const hiddenByEmail = new Map<string, string[]>();
  for (const grant of (grants ?? []) as unknown as WorkspacePageGrant[]) {
    if (grant.visible) continue;
    hiddenByEmail.set(grant.email, [...(hiddenByEmail.get(grant.email) ?? []), grant.page_key]);
  }

  const partners: WorkspacePartner[] = (memberships ?? []).map((membership) => {
    const email = (emailByUser.get(membership.user_id) ?? "").toLowerCase();
    return {
      email: email || "compte supprimé",
      role: membership.role as WorkspaceRole,
      status: "active" as const,
      userId: membership.user_id,
      invitationId: null,
      hiddenPages: hiddenByEmail.get(email) ?? [],
    };
  });

  for (const invitation of invitations ?? []) {
    const email = invitation.email.toLowerCase();
    // Une invitation déjà transformée en adhésion ne se compte pas deux fois.
    if (partners.some((partner) => partner.email === email)) continue;
    partners.push({
      email,
      role: invitation.role === "owner" ? "contributor" : invitation.role,
      status: "invited",
      userId: null,
      invitationId: invitation.id,
      hiddenPages: hiddenByEmail.get(email) ?? [],
    });
  }

  return partners.sort((a, b) => a.email.localeCompare(b.email, "fr"));
}
