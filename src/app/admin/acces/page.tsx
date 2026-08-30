import type { Metadata } from "next";

import { AppShell } from "@/components/ds/app-shell";
import { InviteForm } from "./invite-form";
import { AccessTable } from "./access-table";
import { requireOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Gestion des accès",
};

export default async function AccessPage() {
  const viewer = await requireOwner();

  // Vue d'administration : elle doit montrer les adhésions de *tous* les
  // utilisateurs, ce que la RLS restreint volontairement pour tout le monde.
  // D'où le client service_role, après avoir vérifié le rôle owner ci-dessus.
  const admin = createAdminClient();
  const orgIds = viewer.ownedOrgIds;
  const workspaceIds = viewer.workspaces.map((workspace) => workspace.id);

  const [{ data: memberships }, { data: invitations }, { data: profiles }] =
    await Promise.all([
      admin
        .from("memberships")
        .select("user_id, workspace_id, role, created_at")
        .in("workspace_id", workspaceIds),
      admin
        .from("invitations")
        .select("id, email, workspace_id, role, first_name, last_name, created_at, expires_at")
        .in("org_id", orgIds)
        .is("accepted_at", null),
      admin
        .from("profiles")
        .select("id, email, full_name, first_name, last_name, avatar_url"),
    ]);

  const profileByUser = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const workspaceById = new Map(
    viewer.workspaces.map((workspace) => [workspace.id, workspace]),
  );

  // Le bucket des avatars n'a aucune politique : les URL se signent ici, avec
  // le client admin, après la garde owner en tête de page.
  const avatarPaths = [
    ...new Set(
      (profiles ?? [])
        .map((profile) => profile.avatar_url)
        .filter((path): path is string => Boolean(path)),
    ),
  ];
  const { data: signed } = avatarPaths.length
    ? await admin.storage.from("member-avatars").createSignedUrls(avatarPaths, 60 * 60)
    : { data: [] };
  const avatarByPath = new Map(
    (signed ?? [])
      .filter((entry) => entry.path && entry.signedUrl)
      .map((entry) => [entry.path as string, entry.signedUrl]),
  );

  const rows = (memberships ?? []).map((membership) => {
    const profile = profileByUser.get(membership.user_id);
    return {
      kind: "member" as const,
      id: `${membership.user_id}:${membership.workspace_id}`,
      userId: membership.user_id,
      email: profile?.email ?? "compte supprimé",
      firstName: profile?.first_name ?? "",
      lastName: profile?.last_name ?? "",
      avatarUrl: profile?.avatar_url
        ? (avatarByPath.get(profile.avatar_url) ?? null)
        : null,
      workspaceId: membership.workspace_id,
      workspaceName: workspaceById.get(membership.workspace_id)?.name ?? "—",
      role: membership.role as "contributor" | "client",
      since: membership.created_at,
    };
  });

  const pending = (invitations ?? []).map((invitation) => ({
    kind: "invitation" as const,
    id: invitation.id,
    email: invitation.email,
    fullName: [invitation.first_name, invitation.last_name]
      .filter((part): part is string => Boolean(part))
      .join(" "),
    workspaceId: invitation.workspace_id ?? "",
    workspaceName: invitation.workspace_id
      ? (workspaceById.get(invitation.workspace_id)?.name ?? "—")
      : "Toute l'organisation",
    role: invitation.role,
    since: invitation.created_at,
    expiresAt: invitation.expires_at,
  }));

  const invitable = viewer.workspaces.filter(
    (workspace) => workspace.type !== "personal",
  );

  return (
    <AppShell
      viewer={viewer}
      title="Gestion des accès"
      subtitle="Seules les adresses invitées peuvent se connecter à un espace. L'espace Perso n'est jamais partageable."
    >
      <div className="max-w-4xl space-y-8">
        <InviteForm workspaces={invitable} />
        <AccessTable members={rows} invitations={pending} />
      </div>
    </AppShell>
  );
}
