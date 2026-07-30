import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Workspace, WorkspaceRole } from "@/lib/supabase/database.types";

/** Rôle effectif de l'utilisateur sur un espace donné. */
export type EffectiveRole = "owner" | WorkspaceRole;

export interface WorkspaceAccess extends Workspace {
  role: EffectiveRole;
}

/**
 * Contexte de l'utilisateur pour la requête en cours.
 *
 * Mis en cache par `React.cache` : le layout, la page et les composants
 * imbriqués peuvent l'appeler librement sans multiplier les allers-retours
 * réseau vers la base.
 */
export const getViewer = cache(async () => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Une seule requête par table : la RLS filtre déjà à la source, il n'y a
  // aucun `where` à ajouter ici.
  const [{ data: orgMemberships }, { data: memberships }, { data: workspaces }] =
    await Promise.all([
      supabase.from("organization_members").select("org_id, role"),
      supabase.from("memberships").select("workspace_id, role"),
      supabase.from("workspaces").select("*").order("type").order("name"),
    ]);

  const ownedOrgs = new Set(
    (orgMemberships ?? [])
      .filter((membership) => membership.role === "owner")
      .map((membership) => membership.org_id),
  );

  const roleByWorkspace = new Map(
    (memberships ?? []).map((membership) => [
      membership.workspace_id,
      membership.role,
    ]),
  );

  const accessible: WorkspaceAccess[] = (workspaces ?? []).map((workspace) => ({
    ...workspace,
    role: ownedOrgs.has(workspace.org_id)
      ? "owner"
      : (roleByWorkspace.get(workspace.id) ?? "client"),
  }));

  return {
    user,
    email: user.email ?? "",
    isOwner: ownedOrgs.size > 0,
    ownedOrgIds: [...ownedOrgs],
    workspaces: accessible,
  };
});

export type Viewer = NonNullable<Awaited<ReturnType<typeof getViewer>>>;

/** Exige une session. Le proxy couvre déjà ce cas, ceci est la ceinture. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

/** Exige le rôle owner — réservé à l'administration de la plateforme. */
export async function requireOwner(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.isOwner) redirect("/");
  return viewer;
}

/**
 * Espace ciblé par l'URL. Renvoie `null` si l'utilisateur n'y a pas accès —
 * indiscernable, de son point de vue, d'un espace qui n'existe pas.
 */
export async function getWorkspace(slug: string): Promise<WorkspaceAccess | null> {
  const viewer = await getViewer();
  return viewer?.workspaces.find((workspace) => workspace.slug === slug) ?? null;
}

const ROLE_LABELS: Record<EffectiveRole, string> = {
  owner: "Propriétaire",
  contributor: "Contributeur",
  client: "Client",
};

export function roleLabel(role: EffectiveRole): string {
  return ROLE_LABELS[role];
}
