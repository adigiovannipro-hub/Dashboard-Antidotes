"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireViewer } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/**
 * Ma fiche : prénom, nom, photo.
 *
 * La différence avec `actions/access.ts`, qui édite la fiche **d'un autre**
 * depuis la gestion des accès : ici la garde n'est pas « es-tu owner ? » mais
 * « est-ce bien ta ligne ? ». Une élève de l'Academy n'est owner de rien et
 * doit pourtant pouvoir se nommer et poser sa photo — c'est le seul écran de
 * réglage auquel elle a droit.
 *
 * L'identifiant du compte ne vient jamais du formulaire : il est lu de la
 * session. Un champ caché serait un champ modifiable.
 */

export type ProfilResult = { ok: true; message: string } | { ok: false; error: string };

const nameSchema = z.object({
  firstName: z.string().trim().max(80),
  lastName: z.string().trim().max(80),
});

/** « Prénom Nom », sans double espace quand l'un des deux manque. */
function composeFullName(firstName: string, lastName: string): string | null {
  const full = [firstName, lastName].filter((part) => part !== "").join(" ");
  return full === "" ? null : full;
}

export async function updateMyProfile(
  _previous: ProfilResult | null,
  formData: FormData,
): Promise<ProfilResult> {
  const viewer = await requireViewer();

  const parsed = nameSchema.safeParse({
    firstName: formData.get("firstName") ?? "",
    lastName: formData.get("lastName") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const { firstName, lastName } = parsed.data;

  // `profiles_update_own` (0002) borne déjà l'écriture à sa propre ligne ; le
  // `.eq` explicite tient le même rôle en accès ouvert, où le client bascule
  // en `service_role` et où la politique ne s'applique plus.
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: firstName || null,
      last_name: lastName || null,
      full_name: composeFullName(firstName, lastName),
    } as never)
    .eq("id", viewer.user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/mon-profil");
  revalidatePath("/academy", "layout");
  return { ok: true, message: "Fiche mise à jour." };
}

const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export type AvatarUpload =
  | { ok: true; path: string; url: string }
  | { ok: false; error: string };

/**
 * Signe l'envoi de ma photo — le fichier part du navigateur droit au bucket.
 * Client admin : `member-avatars` n'a aucune politique `authenticated`, il ne
 * s'ouvre que depuis le serveur, après la garde de session ci-dessus.
 */
export async function prepareMyAvatarUpload(input: {
  name: string;
  type: string;
  size: number;
}): Promise<AvatarUpload> {
  const viewer = await requireViewer();

  if (input.size > MAX_AVATAR_BYTES) {
    return { ok: false, error: "Trop lourde : 2 Mo maximum." };
  }
  if (!AVATAR_TYPES.includes(input.type)) {
    return { ok: false, error: "Format non accepté : PNG, JPG ou WebP." };
  }

  // Un nom stable par extension : remplacer la photo écrase la précédente,
  // et le dossier porte l'identifiant du compte — un chemin hors de ce
  // dossier n'est jamais signé.
  const extension = input.type.split("/")[1]!;
  const path = `${viewer.user.id}/avatar.${extension}`;

  const { data, error } = await createAdminClient()
    .storage.from("member-avatars")
    .createSignedUploadUrl(path, { upsert: true });
  if (error) return { ok: false, error: error.message };

  return { ok: true, path, url: data.signedUrl };
}

/** Accroche le chemin que le navigateur vient de remplir. */
export async function attachMyAvatar(input: { path: string }): Promise<ProfilResult> {
  const viewer = await requireViewer();

  if (!input.path.startsWith(`${viewer.user.id}/`)) {
    return { ok: false, error: "Chemin de fichier inattendu." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: input.path } as never)
    .eq("id", viewer.user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/mon-profil");
  return { ok: true, message: "Photo mise à jour." };
}

/** Retire la photo — la fiche retombe sur les initiales. */
export async function removeMyAvatar(): Promise<ProfilResult> {
  const viewer = await requireViewer();

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: null } as never)
    .eq("id", viewer.user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/mon-profil");
  return { ok: true, message: "Photo retirée." };
}
