import "server-only";

import { unstable_cache } from "next/cache";
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

/**
 * Signe d'un coup les photos d'une liste de personnes.
 *
 * `avatar_url` porte le **chemin** dans `member-avatars` (0065), jamais une
 * URL : posé tel quel dans un `<img>`, il donnait une image cassée, et le
 * planning retombait sur les initiales sans que personne ne sache pourquoi.
 * Une URL déjà absolue (photo d'un fournisseur d'identité) passe telle quelle.
 */
export async function withSignedAvatars<T extends { avatar_url: string | null }>(
  people: T[],
): Promise<T[]> {
  const paths = [
    ...new Set(
      people
        .map((person) => person.avatar_url)
        .filter((path): path is string => !!path && !path.startsWith("http")),
    ),
  ];
  if (paths.length === 0) return people;

  const signed = new Map(
    await Promise.all(
      paths.map(
        async (path) =>
          [path, await stableAvatarUrl(path).catch(() => null)] as const,
      ),
    ),
  );

  return people.map((person) =>
    person.avatar_url && !person.avatar_url.startsWith("http")
      ? { ...person, avatar_url: signed.get(person.avatar_url) ?? null }
      : person,
  );
}

/**
 * La signature d'une photo, gardée une semaine par chemin (signée pour deux).
 *
 * Signer à chaque rendu changeait l'URL à chaque rafraîchissement — le jeton
 * porte son `iat` —, donc l'empreinte des lignes du planning qui portent un
 * avatar : toutes se redessinaient à chaque modification, et le navigateur
 * bloqué laissait des pans vides (7/10/2026, le même défaut que #57). Même
 * mécanique que `signedVisualUrls`. Un chemin absent lève au lieu de rendre
 * `null` : un échec ne doit pas rester en cache une semaine.
 */
const stableAvatarUrl = unstable_cache(
  async (path: string): Promise<string> => {
    const { data } = await createAdminClient()
      .storage.from("member-avatars")
      .createSignedUrl(path, 14 * 24 * 3600);
    if (!data?.signedUrl) throw new Error(`photo introuvable : ${path}`);
    return data.signedUrl;
  },
  ["avatar-signe"],
  { revalidate: 7 * 24 * 3600 },
);
