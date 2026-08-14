"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getViewer, getWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Affectation des comptes sociaux à un client.
 *
 * Brancher Meta rapporte tout ce que le login de l'agence atteint ; c'est ici
 * qu'on dit, espace par espace, **sur quel compte on publie** et **quel compte
 * publicitaire alimente le Reporting**. Un compte par réseau : la clé primaire
 * de `workspace_social_accounts` l'impose, il n'y a jamais deux réponses.
 *
 * Réservé au propriétaire de l'espace. La RLS reste l'autorité — la garde ici
 * sert à rendre une erreur lisible.
 */

export type SocialResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const linkSchema = z.object({
  kind: z.enum([
    "instagram",
    "facebook_page",
    "meta_ad_account",
    "linkedin",
    "tiktok",
  ]),
  /** Chaîne vide : on retire l'affectation. */
  accountId: z.union([z.uuid(), z.literal("")]),
});

export async function linkSocialAccount(
  workspaceSlug: string,
  input: { kind: string; accountId: string },
): Promise<SocialResult> {
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choix invalide." };

  try {
    const viewer = await getViewer();
    if (!viewer) throw new Error("Session expirée.");

    const workspace = await getWorkspace(workspaceSlug);
    // Message neutre : ne pas confirmer l'existence d'un espace inaccessible.
    if (!workspace || workspace.role !== "owner") {
      throw new Error("Action indisponible.");
    }

    const supabase = await createClient();
    const { kind, accountId } = parsed.data;

    if (accountId === "") {
      const { error } = await supabase
        .from("workspace_social_accounts")
        .delete()
        .eq("workspace_id", workspace.id)
        .eq("kind", kind);
      if (error) throw new Error(error.message);

      return { ok: true, message: "Compte retiré de cet espace." };
    }

    // Le compte doit appartenir à l'inventaire de la même organisation :
    // sans cette vérification, une affectation fabriquée à la main pourrait
    // pointer le compte d'un autre client.
    const { data: account } = await supabase
      .from("social_accounts")
      .select("id, org_id, kind")
      .eq("id", accountId)
      .maybeSingle();

    const found = account as { org_id: string; kind: string } | null;
    if (!found || found.org_id !== workspace.org_id || found.kind !== kind) {
      throw new Error("Compte introuvable.");
    }

    const { error } = await supabase
      .from("workspace_social_accounts")
      .upsert(
        {
          workspace_id: workspace.id,
          kind,
          account_id: accountId,
          org_id: workspace.org_id,
          assigned_by: viewer.user.id,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "workspace_id,kind" },
      );
    if (error) throw new Error(error.message);

    revalidatePath(`/espace/${workspaceSlug}`, "layout");

    return { ok: true, message: "Compte affecté à cet espace." };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
