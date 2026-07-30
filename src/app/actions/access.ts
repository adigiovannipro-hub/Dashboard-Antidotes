"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireOwner } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";

const inviteSchema = z.object({
  email: z.email("Adresse email invalide.").transform((value) => value.trim().toLowerCase()),
  workspaceId: z.uuid("Espace invalide."),
  role: z.enum(["contributor", "client"]),
});

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * Invite une adresse sur un espace.
 *
 * Si le compte existe déjà, l'accès est accordé immédiatement ; sinon
 * l'invitation reste en attente et sera transformée en accès par le trigger
 * `app.handle_new_user` à la première connexion.
 */
export async function inviteToWorkspace(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await requireOwner();

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    workspaceId: formData.get("workspaceId"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const { email, workspaceId, role } = parsed.data;

  // La RLS vérifie déjà que l'espace appartient à une organisation dont
  // l'utilisateur est owner : une tentative sur un autre espace ne renverrait
  // aucune ligne ici.
  const supabase = await createClient();
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, org_id, name")
    .eq("id", workspaceId)
    .maybeSingle();

  if (!workspace) return { ok: false, error: "Espace introuvable." };

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (profile) {
    const { error } = await admin
      .from("memberships")
      .upsert({ user_id: profile.id, workspace_id: workspace.id, role });
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await admin.from("invitations").insert({
      email,
      org_id: workspace.org_id,
      workspace_id: workspace.id,
      role,
      invited_by: viewer.user.id,
    });
    if (error) return { ok: false, error: error.message };
  }

  await admin.from("audit_log").insert({
    actor_id: viewer.user.id,
    org_id: workspace.org_id,
    workspace_id: workspace.id,
    action: "access.invite",
    target: email,
    metadata: { role },
  });

  revalidatePath("/admin/acces");
  return {
    ok: true,
    message: profile
      ? `${email} a désormais accès à ${workspace.name}.`
      : `Invitation enregistrée pour ${email}. L'accès s'ouvrira à sa première connexion.`,
  };
}

export async function revokeAccess(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await requireOwner();

  const userId = String(formData.get("userId") ?? "");
  const workspaceId = String(formData.get("workspaceId") ?? "");
  if (!userId || !workspaceId) return { ok: false, error: "Requête incomplète." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("memberships")
    .delete()
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId);

  if (error) return { ok: false, error: error.message };

  await createAdminClient()
    .from("audit_log")
    .insert({
      actor_id: viewer.user.id,
      workspace_id: workspaceId,
      action: "access.revoke",
      target: userId,
    });

  revalidatePath("/admin/acces");
  return { ok: true, message: "Accès révoqué." };
}

export async function cancelInvitation(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireOwner();

  const id = String(formData.get("invitationId") ?? "");
  if (!id) return { ok: false, error: "Requête incomplète." };

  const supabase = await createClient();
  const { error } = await supabase.from("invitations").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/acces");
  return { ok: true, message: "Invitation annulée." };
}
