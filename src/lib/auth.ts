import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { isOpenAccess } from "@/lib/access-mode";
import { createClient, createSessionClient } from "@/lib/supabase/server";
import type { Database, Workspace, WorkspaceRole } from "@/lib/supabase/database.types";

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
  /* L'identité vient **toujours** du client de session, jamais du client de
     lecture : en accès ouvert ce dernier est `service_role` et ne connaît
     aucun utilisateur, si bien qu'une personne pourtant connectée était lue
     comme anonyme — donc traitée en owner. C'est la cause du défaut où une
     élève se retrouvait dans le compte de l'agence. */
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  const supabase = await createClient();

  // En accès ouvert, l'absence de session n'est pas un refus : le visiteur est
  // traité comme l'owner de l'organisation. Voir `lib/access-mode.ts`.
  if (!user) return isOpenAccess() ? openAccessViewer(supabase) : null;

  /* Les filtres `user_id` sont explicites et non délégués à la RLS. Elle
     suffirait si elle s'appliquait toujours — mais en accès ouvert les
     lectures passent en `service_role`, et sans ces `where` un client
     récupérerait les appartenances de tout le monde. */
  const [{ data: orgMemberships }, { data: memberships }, { data: workspaces }] =
    await Promise.all([
      supabase
        .from("organization_members")
        .select("org_id, role")
        .eq("user_id", user.id),
      supabase
        .from("memberships")
        .select("workspace_id, role")
        .eq("user_id", user.id),
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

  /* La liste des espaces est lue sans `where` — un owner les veut tous — donc
     elle arrive complète quand la RLS ne filtre pas. Le tri se fait ici : on
     est owner de son organisation, ou membre déclaré d'un espace. Sans cette
     ligne, un client connecté verrait le rail entier de l'agence. */
  const accessible: WorkspaceAccess[] = (workspaces ?? [])
    .filter(
      (workspace) =>
        ownedOrgs.has(workspace.org_id) || roleByWorkspace.has(workspace.id),
    )
    .map((workspace) => ({
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
    // Ni membre d'une organisation, ni membre d'un espace : la seule raison
    // d'avoir un compte est alors une formation achetée. La requête n'est
    // posée que dans ce cas — elle ne coûte rien à l'équipe ni aux clients.
    isStudent:
      (orgMemberships ?? []).length === 0 &&
      (memberships ?? []).length === 0 &&
      (await hasEnrollment(supabase, user.id)),
  };
});

/**
 * Cette personne suit-elle une formation de l'Academy ?
 *
 * Le filtre `user_id` est explicite : en accès ouvert le client de lecture est
 * `service_role`, et sans lui l'existence d'une seule inscription en base
 * ferait passer tout le monde pour élève.
 */
async function hasEnrollment(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("academy_enrollments")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1);
  return (data ?? []).length > 0;
}

/**
 * Le visiteur en accès ouvert : l'owner de l'organisation, sans avoir eu à se
 * connecter.
 *
 * Emprunter l'identité réelle de l'owner plutôt que d'inventer un utilisateur
 * fictif n'est pas un détail : les commentaires et les journaux référencent un
 * profil existant, et une identité inventée casserait ces liens.
 */
async function openAccessViewer(supabase: SupabaseClient<Database>) {
  const [{ data: owner }, { data: workspaces }] = await Promise.all([
    supabase
      .from("organization_members")
      .select("user_id, org_id")
      .eq("role", "owner")
      .limit(1)
      .maybeSingle(),
    supabase.from("workspaces").select("*").order("type").order("name"),
  ]);

  const { data: profile } = owner
    ? await supabase
        .from("profiles")
        .select("email")
        .eq("id", owner.user_id)
        .maybeSingle()
    : { data: null };

  return {
    user: { id: owner?.user_id ?? NIL_UUID } as User,
    email: profile?.email ?? "accès ouvert",
    isOwner: true,
    ownedOrgIds: owner ? [owner.org_id] : [],
    workspaces: ((workspaces ?? []) as Workspace[]).map((workspace) => ({
      ...workspace,
      role: "owner" as const,
    })),
    // L'accès ouvert emprunte l'identité de l'owner : jamais une élève.
    isStudent: false,
  };
}

/** Aucun owner en base — l'application s'affiche, l'écriture échouera. */
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

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
  // Une élève renvoyée sur `/` y trouverait un hub vide, qui se lit comme une
  // panne. Elle rentre chez elle : ses formations.
  if (!viewer.isOwner) redirect(viewer.isStudent ? "/academy" : "/");
  return viewer;
}

/**
 * Renvoie une élève vers ses formations.
 *
 * Elle n'a de place nulle part ailleurs : ni espace client, ni outil interne,
 * ni hub. Les pages du reste de l'application appellent cette garde en tête,
 * juste après `requireViewer` — la redirection vaut mieux qu'un écran vide,
 * qui ne dit pas où aller.
 */
export function redirectStudentToAcademy(viewer: Viewer): void {
  if (viewer.isStudent) redirect("/academy");
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
