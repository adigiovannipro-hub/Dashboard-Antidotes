"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireOwner } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";

const inviteSchema = z.object({
  email: z.email("Adresse email invalide.").transform((value) => value.trim().toLowerCase()),
  workspaceId: z.uuid("Espace invalide."),
  role: z.enum(["contributor", "client"]),
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
});

const profileSchema = z.object({
  userId: z.uuid("Compte invalide."),
  firstName: z.string().trim().max(80),
  lastName: z.string().trim().max(80),
});

/** « Prénom Nom », sans double espace quand l'un des deux manque. */
function composeFullName(firstName: string, lastName: string): string | null {
  const full = [firstName, lastName].filter((part) => part !== "").join(" ");
  return full === "" ? null : full;
}

/**
 * Le compte visé appartient-il à un espace du propriétaire ? La fiche d'un
 * membre s'édite depuis la gestion des accès, qui ne montre que ces
 * comptes-là — la garde rend la même frontière côté écriture.
 */
async function isManagedMember(userId: string, workspaceIds: string[]): Promise<boolean> {
  if (workspaceIds.length === 0) return false;
  const admin = createAdminClient();
  const { data } = await admin
    .from("memberships")
    .select("user_id")
    .eq("user_id", userId)
    .in("workspace_id", workspaceIds)
    .limit(1);
  return (data ?? []).length > 0;
}

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
    firstName: formData.get("firstName") ?? undefined,
    lastName: formData.get("lastName") ?? undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const { email, workspaceId, role } = parsed.data;
  const firstName = parsed.data.firstName ?? "";
  const lastName = parsed.data.lastName ?? "";

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

    // Les noms saisis à l'invitation remplissent la fiche du compte existant —
    // sans écraser une fiche déjà renseignée par ailleurs.
    if (firstName !== "" || lastName !== "") {
      await admin
        .from("profiles")
        .update({
          first_name: firstName || null,
          last_name: lastName || null,
          full_name: composeFullName(firstName, lastName),
        } as never)
        .eq("id", profile.id)
        .is("first_name", null);
    }
  } else {
    const { error } = await admin.from("invitations").insert({
      email,
      org_id: workspace.org_id,
      workspace_id: workspace.id,
      role,
      first_name: firstName || null,
      last_name: lastName || null,
      invited_by: viewer.user.id,
    } as never);
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

/**
 * Prénom et nom d'un membre, édités depuis la gestion des accès.
 *
 * `full_name` est recomposé au passage : c'est lui que lisent les écrans qui
 * affichaient déjà un auteur (journal du planning, dernière modification).
 */
export async function updateMemberProfile(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await requireOwner();

  const parsed = profileSchema.safeParse({
    userId: formData.get("userId"),
    firstName: formData.get("firstName") ?? "",
    lastName: formData.get("lastName") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const workspaceIds = viewer.workspaces.map((workspace) => workspace.id);
  const managed =
    parsed.data.userId === viewer.user.id ||
    (await isManagedMember(parsed.data.userId, workspaceIds));
  if (!managed) return { ok: false, error: "Compte introuvable." };

  const { error } = await createAdminClient()
    .from("profiles")
    .update({
      first_name: parsed.data.firstName || null,
      last_name: parsed.data.lastName || null,
      full_name: composeFullName(parsed.data.firstName, parsed.data.lastName),
    } as never)
    .eq("id", parsed.data.userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/acces");
  return { ok: true, message: "Fiche mise à jour." };
}

const AVATAR_BUCKET = "member-avatars";
const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export type AvatarUploadResult =
  | { ok: true; path: string; url: string }
  | { ok: false; error: string };

/**
 * Signe l'envoi d'une photo de profil — le fichier part du navigateur droit
 * au bucket, comme les logos d'espace. Client admin : le bucket n'a aucune
 * politique `authenticated`, il ne se touche que depuis cette administration,
 * après la garde owner ci-dessous.
 */
export async function prepareAvatarUpload(
  input: { userId: string; name: string; type: string; size: number },
): Promise<AvatarUploadResult> {
  const viewer = await requireOwner();

  if (input.size > MAX_AVATAR_BYTES) {
    return { ok: false, error: "Trop lourd : 2 Mo maximum." };
  }
  if (!AVATAR_TYPES.includes(input.type)) {
    return { ok: false, error: "Format non accepté : PNG, JPG ou WebP." };
  }

  const workspaceIds = viewer.workspaces.map((workspace) => workspace.id);
  const managed =
    input.userId === viewer.user.id ||
    (await isManagedMember(input.userId, workspaceIds));
  if (!managed) return { ok: false, error: "Compte introuvable." };

  // Un nom stable par extension : remplacer la photo écrase la précédente.
  const extension = input.type.split("/")[1]!;
  const path = `${input.userId}/avatar.${extension}`;

  const { data, error } = await createAdminClient()
    .storage.from(AVATAR_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });
  if (error) return { ok: false, error: error.message };

  return { ok: true, path, url: data.signedUrl };
}

/** Accroche le chemin que le navigateur vient de remplir. */
export async function attachAvatar(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await requireOwner();

  const userId = String(formData.get("userId") ?? "");
  const path = String(formData.get("path") ?? "");
  if (!userId || !path.startsWith(`${userId}/`)) {
    return { ok: false, error: "Requête incomplète." };
  }

  const workspaceIds = viewer.workspaces.map((workspace) => workspace.id);
  const managed =
    userId === viewer.user.id || (await isManagedMember(userId, workspaceIds));
  if (!managed) return { ok: false, error: "Compte introuvable." };

  const { error } = await createAdminClient()
    .from("profiles")
    .update({ avatar_url: path } as never)
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/acces");
  return { ok: true, message: "Photo mise à jour." };
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
