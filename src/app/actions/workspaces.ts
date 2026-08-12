"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getViewer, getWorkspace } from "@/lib/auth";
import { ASSETS_BUCKET } from "@/lib/context/storage";
import { VISUALS_BUCKET } from "@/lib/planning/storage";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { listWorkspacePages, listWorkspacePartners } from "@/lib/workspaces/queries";
import { uniqueSlug } from "@/lib/workspaces/slug";
import type { WorkspacePage, WorkspacePartner } from "@/lib/workspaces/types";

/**
 * Administration d'un espace depuis le rail : renommer, dupliquer,
 * supprimer, et régler les droits d'un partenaire page par page.
 *
 * Réservé à l'owner de l'organisation. La garde rend le même message neutre
 * qu'un espace inexistant, et la RLS reste l'autorité derrière elle.
 */

export type WorkspaceResult =
  | { ok: true; message: string; slug?: string }
  | { ok: false; error: string };

export type WorkspaceAdminResult =
  | { ok: true; pages: WorkspacePage[]; partners: WorkspacePartner[] }
  | { ok: false; error: string };

type Scope = { workspace: string };

async function guardOwner(scope: Scope) {
  const viewer = await getViewer();
  if (!viewer) throw new Error("Session expirée.");

  const workspace = await getWorkspace(scope.workspace);
  if (!workspace || workspace.role !== "owner") throw new Error("Action indisponible.");

  return { viewer, workspace };
}

function fail(error: unknown): { ok: false; error: string } {
  return { ok: false, error: (error as Error).message };
}

const nameSchema = z
  .string()
  .trim()
  .min(2, "Le nom doit faire au moins deux caractères.")
  .max(80, "Le nom est trop long.");

// --- Renommer -------------------------------------------------------------

/**
 * Le nom affiché change, le slug ne bouge pas.
 *
 * Un slug qui suivrait le nom casserait les liens déjà partagés et les
 * favoris du client, pour un gain purement cosmétique dans la barre d'URL.
 */
export async function renameWorkspace(
  scope: Scope,
  input: { name: string },
): Promise<WorkspaceResult> {
  const parsed = nameSchema.safeParse(input.name);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Nom invalide." };
  }

  try {
    const { workspace } = await guardOwner(scope);
    const supabase = await createClient();

    const { error } = await supabase
      .from("workspaces")
      .update({ name: parsed.data })
      .eq("id", workspace.id);
    if (error) throw new Error(error.message);

    revalidatePath("/", "layout");
    return { ok: true, message: `Espace renommé en ${parsed.data}.` };
  } catch (error) {
    return fail(error);
  }
}

// --- Dupliquer ------------------------------------------------------------

/**
 * Duplique la **configuration**, jamais le contenu.
 *
 * Ce qu'on recopie en ouvrant un client : ses tableaux avec leurs colonnes
 * personnalisées et leur vocabulaire, ses tableaux de bord. Ce qu'on ne
 * recopie jamais : publications, mois, documents, brief. Un nouveau client
 * qui hériterait du contexte d'un autre produirait des générations fausses,
 * et la confusion serait invisible.
 */
export async function duplicateWorkspace(
  scope: Scope,
  input: { name: string },
): Promise<WorkspaceResult> {
  const parsed = nameSchema.safeParse(input.name);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Nom invalide." };
  }

  try {
    const { viewer, workspace } = await guardOwner(scope);
    const supabase = await createClient();

    const taken = new Set(
      viewer.workspaces
        .filter((entry) => entry.org_id === workspace.org_id)
        .map((entry) => entry.slug),
    );

    const { data: created, error: createError } = await supabase
      .from("workspaces")
      .insert({
        org_id: workspace.org_id,
        type: workspace.type,
        slug: uniqueSlug(parsed.data, taken),
        name: parsed.data,
        accent_color: workspace.accent_color,
      })
      .select("id, slug")
      .single();
    if (createError) throw new Error(createError.message);

    await copyBoards(supabase, workspace.id, created.id);
    await copyDashboards(supabase, workspace.id, created.id);

    revalidatePath("/", "layout");
    return {
      ok: true,
      slug: created.slug,
      message: `${parsed.data} créé avec la même configuration, sans contenu.`,
    };
  } catch (error) {
    return fail(error);
  }
}

async function copyBoards(
  supabase: SupabaseClient<Database>,
  sourceId: string,
  targetId: string,
) {
  const { data: boards } = await supabase
    .from("planning_boards")
    .select("id, kind, slug, name, year, position, settings")
    .eq("workspace_id", sourceId)
    .order("position");

  for (const board of boards ?? []) {
    const { data: copy, error } = await supabase
      .from("planning_boards")
      .insert({
        workspace_id: targetId,
        kind: board.kind,
        slug: board.slug,
        name: board.name,
        year: board.year,
        position: board.position,
        settings: board.settings,
      })
      .select("id")
      .single();
    if (error || !copy) continue;

    const { data: columns } = await supabase
      .from("planning_columns")
      .select("builtin_key, type, label, position, hidden, settings")
      .eq("board_id", board.id);

    if (!columns || columns.length === 0) continue;
    await supabase.from("planning_columns").insert(
      columns.map((column) => ({
        board_id: copy.id,
        workspace_id: targetId,
        builtin_key: column.builtin_key,
        type: column.type,
        label: column.label,
        position: column.position,
        hidden: column.hidden,
        settings: column.settings,
      })),
    );
  }
}

async function copyDashboards(
  supabase: SupabaseClient<Database>,
  sourceId: string,
  targetId: string,
) {
  const { data: dashboards } = await supabase
    .from("dashboards")
    .select("slug, name, layout, position")
    .eq("workspace_id", sourceId)
    .order("position");

  if (!dashboards || dashboards.length === 0) return;
  await supabase.from("dashboards").insert(
    dashboards.map((dashboard) => ({
      workspace_id: targetId,
      slug: dashboard.slug,
      name: dashboard.name,
      layout: dashboard.layout,
      position: dashboard.position,
    })),
  );
}

// --- Supprimer ------------------------------------------------------------

/**
 * Suppression définitive, et elle emporte tout : planning, documents, brief,
 * tableaux de bord, accès. Le nom exact doit être saisi pour l'obtenir — une
 * entrée de menu qui détruit un an de travail sur un clic de trop n'est pas
 * une commodité.
 */
export async function deleteWorkspace(
  scope: Scope,
  input: { confirmation: string },
): Promise<WorkspaceResult> {
  try {
    const { viewer, workspace } = await guardOwner(scope);

    if (workspace.type === "personal") {
      return { ok: false, error: "L'espace personnel ne se supprime pas." };
    }
    if (input.confirmation.trim() !== workspace.name) {
      return { ok: false, error: "Le nom saisi ne correspond pas à celui de l'espace." };
    }

    const supabase = await createClient();

    // Les fichiers d'abord : la suppression de la ligne emporte les tables
    // liées, jamais les objets du stockage. Un échec ici ne bloque pas la
    // suppression, il laisse des octets orphelins et c'est tout.
    await removeFolder(supabase, ASSETS_BUCKET, workspace.id);
    await removeFolder(supabase, VISUALS_BUCKET, workspace.id);

    const { error } = await supabase.from("workspaces").delete().eq("id", workspace.id);
    if (error) throw new Error(error.message);

    await createAdminClient()
      .from("audit_log")
      .insert({
        actor_id: viewer.user.id,
        org_id: workspace.org_id,
        action: "workspace.delete",
        target: workspace.slug,
        metadata: { name: workspace.name },
      });

    revalidatePath("/", "layout");
    return { ok: true, message: `${workspace.name} a été supprimé.` };
  } catch (error) {
    return fail(error);
  }
}

/** Vide un dossier du stockage, sous-dossiers compris. */
async function removeFolder(
  supabase: SupabaseClient<Database>,
  bucket: string,
  prefix: string,
  depth = 0,
): Promise<void> {
  if (depth > 3) return;

  const { data } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  const files: string[] = [];

  for (const entry of data ?? []) {
    // Supabase rend un `id` nul pour un dossier, un identifiant pour un objet.
    if (entry.id === null) {
      await removeFolder(supabase, bucket, `${prefix}/${entry.name}`, depth + 1);
    } else {
      files.push(`${prefix}/${entry.name}`);
    }
  }

  if (files.length > 0) await supabase.storage.from(bucket).remove(files);
}

// --- Partenaires et droits par page ---------------------------------------

/**
 * Lecture à la demande, ouverte par le dialogue des partenaires.
 *
 * Une Server Action plutôt qu'un chargement dans le rail : le rail est rendu
 * sur chaque page de l'application, et charger la liste des partenaires de
 * tous les espaces à chaque rendu coûterait des requêtes que personne ne
 * regarde.
 */
export async function loadWorkspaceAdmin(scope: Scope): Promise<WorkspaceAdminResult> {
  try {
    const { workspace } = await guardOwner(scope);
    const [pages, partners] = await Promise.all([
      listWorkspacePages(workspace.id),
      listWorkspacePartners(workspace.id),
    ]);
    return { ok: true, pages, partners };
  } catch (error) {
    return fail(error);
  }
}

const partnerSchema = z.object({
  email: z.email("Adresse email invalide.").transform((value) => value.trim().toLowerCase()),
  role: z.enum(["contributor", "client"]),
  hiddenPages: z.array(z.string().max(120)).max(50),
});

/**
 * Ouvre ou met à jour l'accès d'un partenaire, et ses droits page par page.
 *
 * Les droits sont enregistrés en même temps que l'invitation, sur l'adresse :
 * ils valent donc avant la première connexion, sans reprise à faire quand le
 * compte s'ouvre.
 */
export async function savePartner(
  scope: Scope,
  input: { email: string; role: string; hiddenPages: string[] },
): Promise<WorkspaceResult> {
  const parsed = partnerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  try {
    const { viewer, workspace } = await guardOwner(scope);
    const { email, role, hiddenPages } = parsed.data;
    const admin = createAdminClient();

    // Les pages réellement offertes, pour ne pas enregistrer un droit sur une
    // page qui n'existe pas — et pour ne jamais toucher au Contexte.
    const pages = await listWorkspacePages(workspace.id);
    const keys = new Set(pages.map((page) => page.key));
    const hidden = hiddenPages.filter((key) => keys.has(key));

    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    if (profile) {
      const { error } = await admin
        .from("memberships")
        .upsert({ user_id: profile.id, workspace_id: workspace.id, role });
      if (error) throw new Error(error.message);
    } else {
      const { data: pending } = await admin
        .from("invitations")
        .select("id")
        .eq("workspace_id", workspace.id)
        .ilike("email", email)
        .is("accepted_at", null)
        .maybeSingle();

      if (pending) {
        const { error } = await admin
          .from("invitations")
          .update({ role })
          .eq("id", pending.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await admin.from("invitations").insert({
          email,
          org_id: workspace.org_id,
          workspace_id: workspace.id,
          role,
          invited_by: viewer.user.id,
        });
        if (error) throw new Error(error.message);
      }
    }

    // Table remise à plat : seules les pages masquées y laissent une ligne,
    // l'absence valant visible.
    await admin
      .from("workspace_page_grants")
      .delete()
      .eq("workspace_id", workspace.id)
      .eq("email", email);

    if (hidden.length > 0) {
      const { error } = await admin.from("workspace_page_grants").insert(
        hidden.map((key) => ({
          workspace_id: workspace.id,
          email,
          page_key: key,
          visible: false,
        })),
      );
      if (error) throw new Error(error.message);
    }

    await admin.from("audit_log").insert({
      actor_id: viewer.user.id,
      org_id: workspace.org_id,
      workspace_id: workspace.id,
      action: "access.partner",
      target: email,
      metadata: { role, hidden },
    });

    revalidatePath("/", "layout");
    return {
      ok: true,
      message: profile
        ? `Droits de ${email} enregistrés.`
        : `Invitation enregistrée pour ${email}. L'accès s'ouvrira à sa première connexion.`,
    };
  } catch (error) {
    return fail(error);
  }
}

/** Retire un partenaire de l'espace : adhésion, invitation en attente et droits. */
export async function removePartner(
  scope: Scope,
  input: { email: string },
): Promise<WorkspaceResult> {
  const parsed = z.email().safeParse(input.email.trim().toLowerCase());
  if (!parsed.success) return { ok: false, error: "Adresse inconnue." };

  try {
    const { viewer, workspace } = await guardOwner(scope);
    const email = parsed.data;
    const admin = createAdminClient();

    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    if (profile) {
      await admin
        .from("memberships")
        .delete()
        .eq("user_id", profile.id)
        .eq("workspace_id", workspace.id);
    }

    await admin
      .from("invitations")
      .delete()
      .eq("workspace_id", workspace.id)
      .ilike("email", email)
      .is("accepted_at", null);

    await admin
      .from("workspace_page_grants")
      .delete()
      .eq("workspace_id", workspace.id)
      .eq("email", email);

    await admin.from("audit_log").insert({
      actor_id: viewer.user.id,
      org_id: workspace.org_id,
      workspace_id: workspace.id,
      action: "access.revoke",
      target: email,
    });

    revalidatePath("/", "layout");
    return { ok: true, message: `${email} n'a plus accès à cet espace.` };
  } catch (error) {
    return fail(error);
  }
}
