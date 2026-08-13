import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { InstagramProfile, SocialAccountRow } from "./types";
import { toInstagramProfile } from "./types";

/**
 * Lectures des comptes sociaux.
 *
 * Comme partout, la RLS fait le cloisonnement : les filtres ici servent à
 * cibler, pas à protéger. Et le jeton chiffré ne sort jamais de ce module —
 * les fonctions publiques rendent la vitrine, pas les identifiants.
 */

export async function listSocialAccounts(
  workspaceId: string,
): Promise<SocialAccountRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("kind");

  return (data ?? []) as unknown as SocialAccountRow[];
}

/**
 * La vitrine du compte Instagram d'un espace, pour l'en-tête du feed.
 *
 * L'erreur est volontairement ignorée : tant que la migration 0040 n'est pas
 * appliquée, la table n'existe pas — et une prévisualisation de feed sans
 * en-tête reste utile. L'écran ne doit pas tomber pour ça.
 */
export async function getInstagramProfile(
  workspaceId: string,
): Promise<InstagramProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("kind", "instagram")
    .eq("status", "connected")
    .limit(1)
    .maybeSingle();

  return data ? toInstagramProfile(data as unknown as SocialAccountRow) : null;
}
