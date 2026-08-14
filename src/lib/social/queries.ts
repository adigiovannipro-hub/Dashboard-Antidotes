import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  InstagramProfile,
  SocialAccountRow,
  WorkspaceSocialLink,
} from "./types";
import { toInstagramProfile } from "./types";

/**
 * Lectures des comptes sociaux.
 *
 * Comme partout, la RLS fait le cloisonnement : les filtres ici servent à
 * cibler, pas à protéger. Le jeton n'est plus dans cette table depuis 0044 —
 * il n'y a donc rien à filtrer à la main pour éviter de le laisser fuir.
 */

/** L'inventaire de l'agence : tout ce que le login Meta atteint. */
export async function listSocialAccounts(
  orgId: string,
): Promise<SocialAccountRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("org_id", orgId)
    .order("kind")
    .order("display_name");

  return (data ?? []) as unknown as SocialAccountRow[];
}

/** Ce que **ce client** utilise : un compte par réseau, au plus. */
export async function listWorkspaceSocialLinks(
  workspaceId: string,
): Promise<WorkspaceSocialLink[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_social_accounts")
    .select("*")
    .eq("workspace_id", workspaceId);

  return (data ?? []) as unknown as WorkspaceSocialLink[];
}

/**
 * La vitrine du compte Instagram **affecté à cet espace**, pour l'en-tête du
 * feed.
 *
 * Deux requêtes plutôt qu'une jointure : PostgREST rendrait l'imbriqué sous
 * une forme que le cast à plat ne sait pas lire, et l'affectation manquante
 * est le cas courant tant que l'agence n'a pas choisi.
 *
 * L'erreur est volontairement ignorée : tant que les migrations 0043-0044 ne
 * sont pas appliquées, les tables n'existent pas — et une prévisualisation de
 * feed sans en-tête reste utile. L'écran ne doit pas tomber pour ça.
 */
export async function getInstagramProfile(
  workspaceId: string,
): Promise<InstagramProfile | null> {
  const supabase = await createClient();

  const { data: link } = await supabase
    .from("workspace_social_accounts")
    .select("account_id")
    .eq("workspace_id", workspaceId)
    .eq("kind", "instagram")
    .maybeSingle();

  const accountId = (link as { account_id?: string } | null)?.account_id;
  if (!accountId) return null;

  const { data } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("id", accountId)
    .maybeSingle();

  return data ? toInstagramProfile(data as unknown as SocialAccountRow) : null;
}
