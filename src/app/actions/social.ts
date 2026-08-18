"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getViewer, getWorkspace } from "@/lib/auth";
import { normalizeDeliverables } from "@/lib/context/deliverables";
import { networkKey } from "@/lib/context/types";
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
    "youtube",
    "pinterest",
    "x",
    "threads",
    "snapchat",
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

/**
 * Déclare un réseau de plus pour ce client, depuis l'écran des connexions.
 *
 * Il rejoint les **livrables du Contexte**, et pas une liste parallèle propre
 * aux connexions. C'est le point de tout ce chantier : la liste des réseaux
 * d'un client a une seule source, et les trois écrans qui la lisent —
 * Contexte, couloirs du planning, connexions — disent donc la même chose.
 *
 * Sans quantités : on déclare qu'on est sur ce réseau, le volume se pose au
 * contrat, dans le Contexte. Un réseau déjà présent ne rend pas d'erreur —
 * l'ajouter deux fois n'est pas une faute, c'est un non-événement.
 */
export async function addClientNetwork(
  workspaceSlug: string,
  input: { nom: string },
): Promise<SocialResult> {
  const parsed = z.string().trim().min(1).max(60).safeParse(input.nom);
  if (!parsed.success) return { ok: false, error: "Nom de réseau invalide." };

  try {
    const viewer = await getViewer();
    if (!viewer) throw new Error("Session expirée.");

    const workspace = await getWorkspace(workspaceSlug);
    if (!workspace || workspace.role !== "owner") {
      throw new Error("Action indisponible.");
    }

    const supabase = await createClient();
    const nom = parsed.data;

    const { data: active } = await supabase
      .from("client_context")
      .select("id, deliverables")
      .eq("workspace_id", workspace.id)
      .eq("is_active", true)
      .maybeSingle();

    const row = active as { id: string; deliverables: unknown } | null;
    const current = normalizeDeliverables(row?.deliverables);

    if (current.reseaux.some((reseau) => networkKey(reseau.nom) === networkKey(nom))) {
      return { ok: true, message: `${nom} est déjà déclaré.` };
    }

    const deliverables = {
      ...current,
      reseaux: [...current.reseaux, { nom, publications: [] }],
    };

    if (row) {
      const { error } = await supabase
        .from("client_context")
        .update({ deliverables } as never)
        .eq("id", row.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("client_context").insert({
        workspace_id: workspace.id,
        deliverables,
        created_by: viewer.user.id,
      } as never);
      if (error) throw new Error(error.message);
    }

    revalidatePath(`/espace/${workspaceSlug}`, "layout");

    return {
      ok: true,
      message: `${nom} ajouté aux réseaux du client. Ses quantités se posent au Contexte.`,
    };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

/**
 * Donne son rôle à un événement personnalisé : achat, panier, ou aucun.
 *
 * Réglage **par compte publicitaire**, appliqué à la lecture : les lignes
 * collectées restent fidèles à ce que Meta a répondu, et changer d'avis ne
 * demande pas de resynchroniser un an d'historique.
 *
 * Le défaut reste « aucun ». Un événement personnalisé n'est pas une vente
 * dans le cas général — chez I-WAY, « Validation Shop » l'est, et
 * « Validation Resa » est une mise au panier. C'est au client de trancher,
 * compte par compte, et pas au produit d'imposer une règle.
 */
export type ConversionRole = "achat" | "panier" | "aucun";

export async function setConversionRole(
  workspaceSlug: string,
  input: { name: string; role: ConversionRole },
): Promise<SocialResult> {
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(200),
      role: z.enum(["achat", "panier", "aucun"]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Événement invalide." };

  try {
    const viewer = await getViewer();
    if (!viewer) throw new Error("Session expirée.");

    const workspace = await getWorkspace(workspaceSlug);
    if (!workspace || workspace.role !== "owner") {
      throw new Error("Action indisponible.");
    }

    const supabase = await createClient();
    const { name, role } = parsed.data;

    const { data: sources, error: readError } = await supabase
      .from("data_sources")
      .select("id, purchase_event_names, add_to_cart_event_names")
      .eq("workspace_id", workspace.id)
      .eq("provider", "meta_ads");
    if (readError) throw new Error(readError.message);

    const rows = (sources ?? []) as unknown as {
      id: string;
      purchase_event_names: string[] | null;
      add_to_cart_event_names: string[] | null;
    }[];
    if (rows.length === 0) throw new Error("Aucun compte publicitaire branché.");

    // Un événement n'a qu'un rôle : on le retire des deux listes avant de le
    // remettre dans la bonne. Sans ça, passer d'« achat » à « panier » le
    // ferait compter deux fois.
    for (const row of rows) {
      const sansLui = (liste: string[] | null) =>
        (liste ?? []).filter((entry) => entry !== name);

      const achats = sansLui(row.purchase_event_names);
      const paniers = sansLui(row.add_to_cart_event_names);
      if (role === "achat") achats.push(name);
      if (role === "panier") paniers.push(name);

      const { error } = await supabase
        .from("data_sources")
        .update({
          purchase_event_names: achats,
          add_to_cart_event_names: paniers,
        } as never)
        .eq("id", row.id);
      if (error) throw new Error(error.message);
    }

    revalidatePath(`/espace/${workspaceSlug}`, "layout");

    const dit: Record<ConversionRole, string> = {
      achat: `« ${name} » compte désormais comme un achat.`,
      panier: `« ${name} » compte désormais comme une mise au panier.`,
      aucun: `« ${name} » ne compte plus dans les conversions.`,
    };
    return { ok: true, message: dit[role] };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
