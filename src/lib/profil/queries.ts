import "server-only";

import { cache } from "react";

import { getViewer } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/database.types";

/**
 * La fiche de la personne connectée.
 *
 * `profiles_select` (0002) rend déjà la ligne de `auth.uid()`, mais le filtre
 * `id` est explicite : en accès ouvert le client de lecture est `service_role`
 * et ne filtre plus rien — sans lui, l'écran afficherait la fiche de quelqu'un
 * d'autre, ce qui est exactement le contraire du sujet.
 */
export const getMyProfile = cache(async (): Promise<Profile | null> => {
  const viewer = await getViewer();
  if (!viewer) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", viewer.user.id)
    .maybeSingle();

  return (data as unknown as Profile) ?? null;
});

/** Une heure : au-delà, l'onglet laissé ouvert affiche une image morte. */
const TTL_SECONDS = 60 * 60;

/**
 * L'URL d'affichage d'une photo de profil.
 *
 * Client admin : le bucket `member-avatars` (0065) n'a **aucune** politique
 * `storage.objects` — il ne se touche que depuis le serveur, après la garde.
 * On signe donc avec la clé de service, comme le fait déjà la gestion des
 * accès, jamais depuis le navigateur.
 */
export async function signAvatarUrl(path: string | null): Promise<string | null> {
  if (!path) return null;

  const { data } = await createAdminClient()
    .storage.from("member-avatars")
    .createSignedUrl(path, TTL_SECONDS);

  return data?.signedUrl ?? null;
}
