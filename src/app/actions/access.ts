"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { sendAccessLink, type AccessSendResult } from "@/lib/access/send-access";
import { siteOrigin } from "@/lib/access/site-origin";
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

export type ActionResult =
  /** `link` : le lien d'accès, quand le courriel n'a pas pu partir — à transmettre à la main. */
  | { ok: true; message: string; link?: string }
  | { ok: false; error: string };

/**
 * Le verdict d'un envoi de lien, en mots. L'accès, lui, est déjà écrit : un
 * courriel qui ne part pas ne défait rien, il laisse le lien à transmettre.
 */
function sendVerdict(email: string, sent: AccessSendResult): ActionResult {
  if (!sent.ok) {
    return { ok: false, error: `Accès enregistré, mais le lien n'a pas pu être fabriqué : ${sent.error}` };
  }
  if (sent.sent) return { ok: true, message: `Accès envoyé à ${email}.` };
  return {
    ok: true,
    message: `Accès enregistré, courriel non parti (${sent.reason ?? "boîte d'envoi indisponible"}). Lien à transmettre ci-dessous.`,
    link: sent.link,
  };
}

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
    .select("id, org_id, name, slug")
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

  // Le courriel, enfin. Jusqu'au 1/10/2026 l'invitation s'arrêtait à la ligne
  // ci-dessus : le client ne recevait rien, et la page de connexion passait
  // par une boîte d'envoi qui ne délivre qu'à l'équipe du projet Supabase.
  const sent = await sendAccessLink({
    kind: "invitation",
    email,
    firstName: firstName || null,
    workspaceName: workspace.name,
    destination: `/espace/${workspace.slug}`,
    siteUrl: await siteOrigin(),
  });

  revalidatePath("/admin/acces");
  return sendVerdict(email, sent);
}

const resendSchema = z.object({
  email: z.email("Adresse email invalide.").transform((value) => value.trim().toLowerCase()),
  workspaceId: z.uuid("Espace invalide."),
});

/**
 * Renvoie le lien d'accès d'une adresse déjà invitée — le bouton de chaque
 * ligne de la gestion des accès. Un lien expire au bout d'une heure ; un
 * client qui l'a laissé passer, ou qui ne l'a jamais reçu, en a besoin d'un
 * neuf.
 *
 * Seulement pour une adresse qui a déjà un accès, ou une invitation en
 * attente, sur un espace du propriétaire : le bouton ne sert pas à ouvrir un
 * accès, c'est le formulaire qui le fait.
 */
export async function resendAccess(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await requireOwner();

  const parsed = resendSchema.safeParse({
    email: formData.get("email"),
    workspaceId: formData.get("workspaceId"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Requête incomplète." };
  }
  const { email, workspaceId } = parsed.data;

  const workspace = viewer.workspaces.find((candidate) => candidate.id === workspaceId);
  if (!workspace || workspace.type === "personal") {
    return { ok: false, error: "Espace introuvable." };
  }

  const admin = createAdminClient();
  const [{ data: profile }, { data: invitation }] = await Promise.all([
    admin.from("profiles").select("id, first_name").ilike("email", email).maybeSingle(),
    admin
      .from("invitations")
      .select("id, first_name")
      .ilike("email", email)
      .eq("workspace_id", workspaceId)
      .is("accepted_at", null)
      .limit(1)
      .maybeSingle(),
  ]);

  let invited = Boolean(invitation);
  if (profile) {
    const { data: membership } = await admin
      .from("memberships")
      .select("user_id")
      .eq("user_id", (profile as { id: string }).id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    invited = invited || Boolean(membership);
  }
  if (!invited) return { ok: false, error: "Aucun accès à cet espace pour cette adresse." };

  // Une invitation expire au bout de trente jours, et le trigger qui la
  // change en accès à la création du compte ignore les expirées : renvoyer
  // le lien sans la prolonger ouvrirait un compte sans espace.
  if (invitation) {
    await admin
      .from("invitations")
      .update({ expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString() } as never)
      .eq("id", (invitation as { id: string }).id);
  }

  const firstName =
    (profile as { first_name: string | null } | null)?.first_name ??
    (invitation as { first_name: string | null } | null)?.first_name ??
    null;

  const sent = await sendAccessLink({
    kind: "invitation",
    email,
    firstName,
    workspaceName: workspace.name,
    destination: `/espace/${workspace.slug}`,
    siteUrl: await siteOrigin(),
  });

  await admin.from("audit_log").insert({
    actor_id: viewer.user.id,
    workspace_id: workspaceId,
    action: "access.resend",
    target: email,
  });

  revalidatePath("/admin/acces");
  return sendVerdict(email, sent);
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
