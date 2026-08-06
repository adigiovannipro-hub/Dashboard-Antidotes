"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getViewer, type Viewer } from "@/lib/auth";
import { todayInParis } from "@/lib/mon-travail/dates";
import { createClient } from "@/lib/supabase/server";
import type { WorkTaskRow } from "@/lib/supabase/database.types";

export type TravailResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

/**
 * Actions de « Mon travail ».
 *
 * Réservées à l'owner de l'organisation : ce module est un outil interne, un
 * client ne le voit jamais — d'où des messages d'erreur neutres qui ne
 * confirment pas son existence. La RLS de la migration 0015 reste l'autorité ;
 * ces gardes rendent l'erreur lisible, elles ne protègent pas les données.
 *
 * Le statut d'une publication, lui, ne se change pas ici : la section
 * « À publier » écrit dans la ligne source du planning via `updateSubject`
 * (`actions/planning.ts`) — une seule source de vérité, deux vues.
 */

const OK: TravailResult = { ok: true };

async function guardOwner(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new Error("Session expirée.");
  if (!viewer.isOwner || viewer.ownedOrgIds.length === 0) {
    throw new Error("Action indisponible.");
  }
  return viewer;
}

function fail(error: unknown): TravailResult {
  return { ok: false, error: (error as Error).message };
}

/** Un rattachement ne peut viser qu'un espace réellement accessible. */
function checkWorkspace(viewer: Viewer, workspaceId: string | null) {
  if (!workspaceId) return;
  if (!viewer.workspaces.some((workspace) => workspace.id === workspaceId)) {
    throw new Error("Espace inconnu.");
  }
}

// --- Ajout rapide -------------------------------------------------------------

const createInput = z.object({
  title: z.string().trim().min(1, "La tâche ne peut pas être vide.").max(300),
  workspaceId: z.uuid().nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
});

export async function createTask(
  _previous: TravailResult | null,
  formData: FormData,
): Promise<TravailResult> {
  const parsed = createInput.safeParse({
    title: formData.get("title"),
    workspaceId: String(formData.get("workspaceId") ?? "") || null,
    dueDate: String(formData.get("dueDate") ?? "") || todayInParis(),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }

  try {
    const viewer = await guardOwner();
    checkWorkspace(viewer, parsed.data.workspaceId);
    const supabase = await createClient();

    const { error } = await supabase.from("work_tasks").insert({
      org_id: viewer.ownedOrgIds[0]!,
      workspace_id: parsed.data.workspaceId,
      title: parsed.data.title,
      source: "manual",
      due_date: parsed.data.dueDate,
    });

    if (error) throw new Error(error.message);

    revalidatePath("/");
    return { ok: true, message: "Tâche ajoutée." };
  } catch (error) {
    return fail(error);
  }
}

// --- Coche ---------------------------------------------------------------------

export async function toggleTask(input: {
  taskId: string;
  done: boolean;
}): Promise<TravailResult> {
  try {
    await guardOwner();
    const supabase = await createClient();

    const { error } = await supabase
      .from("work_tasks")
      .update({
        status: input.done ? "done" : "pending",
        done_at: input.done ? new Date().toISOString() : null,
      })
      .eq("id", input.taskId)
      // Une tâche supprimée ne revit pas par une coche.
      .neq("status", "deleted");

    if (error) throw new Error(error.message);

    revalidatePath("/");
    return OK;
  } catch (error) {
    return fail(error);
  }
}

// --- Édition -------------------------------------------------------------------

/**
 * Champs modifiables d'une tâche. La table est la seule porte d'entrée : tout
 * le reste — statut, source, clé d'idempotence, organisation — est hors de
 * portée du navigateur, quelle que soit la requête.
 */
const EDITABLE_FIELDS = {
  title: z.string().trim().min(1, "La tâche ne peut pas être vide.").max(300),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
  workspace_id: z.uuid().nullable(),
} as const;

export type EditableTaskField = keyof typeof EDITABLE_FIELDS;

export async function updateTask(input: {
  taskId: string;
  field: EditableTaskField;
  value: unknown;
}): Promise<TravailResult> {
  const schema = EDITABLE_FIELDS[input.field];
  if (!schema) return { ok: false, error: "Champ non modifiable." };

  const parsed = schema.safeParse(input.value);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Valeur invalide." };
  }

  try {
    const viewer = await guardOwner();
    if (input.field === "workspace_id") {
      checkWorkspace(viewer, parsed.data as string | null);
    }
    const supabase = await createClient();

    // Clé dynamique mais bornée : `input.field` vient d'être validé contre
    // `EDITABLE_FIELDS`, seule porte d'entrée de cette fonction.
    const patch = { [input.field]: parsed.data } as Partial<WorkTaskRow>;

    const { error } = await supabase
      .from("work_tasks")
      .update(patch)
      .eq("id", input.taskId);

    if (error) throw new Error(error.message);

    revalidatePath("/");
    return OK;
  } catch (error) {
    return fail(error);
  }
}

// --- Suppression ---------------------------------------------------------------

export async function deleteTask(input: { taskId: string }): Promise<TravailResult> {
  try {
    await guardOwner();
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("work_tasks")
      .select("dedupe_key")
      .eq("id", input.taskId)
      .maybeSingle();

    if (existing?.dedupe_key) {
      // Une tâche générée s'efface en statut : réellement supprimée, sa clé
      // redeviendrait libre et le prochain passage du cron la recréerait.
      const { error } = await supabase
        .from("work_tasks")
        .update({ status: "deleted" })
        .eq("id", input.taskId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("work_tasks")
        .delete()
        .eq("id", input.taskId);
      if (error) throw new Error(error.message);
    }

    revalidatePath("/");
    return OK;
  } catch (error) {
    return fail(error);
  }
}
