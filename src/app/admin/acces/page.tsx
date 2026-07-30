import type { Metadata } from "next";

import { AppHeader } from "@/components/app-header";
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
        .select("id, email, workspace_id, role, created_at, expires_at")
        .in("org_id", orgIds)
        .is("accepted_at", null),
      admin.from("profiles").select("id, email, full_name"),
    ]);

  const emailByUser = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.email]),
  );
  const workspaceById = new Map(
    viewer.workspaces.map((workspace) => [workspace.id, workspace]),
  );

  const rows = (memberships ?? []).map((membership) => ({
    kind: "member" as const,
    id: `${membership.user_id}:${membership.workspace_id}`,
    userId: membership.user_id,
    email: emailByUser.get(membership.user_id) ?? "compte supprimé",
    workspaceId: membership.workspace_id,
    workspaceName: workspaceById.get(membership.workspace_id)?.name ?? "—",
    role: membership.role as "contributor" | "client",
    since: membership.created_at,
  }));

  const pending = (invitations ?? []).map((invitation) => ({
    kind: "invitation" as const,
    id: invitation.id,
    email: invitation.email,
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
    <>
      <AppHeader viewer={viewer} />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-10 p-6 md:p-10">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Gestion des accès
          </h1>
          <p className="text-muted-foreground text-sm">
            Seules les adresses invitées peuvent se connecter à un espace.
            L&apos;espace Perso n&apos;est jamais partageable.
          </p>
        </div>

        <InviteForm workspaces={invitable} />

        <AccessTable members={rows} invitations={pending} />
      </main>
    </>
  );
}
