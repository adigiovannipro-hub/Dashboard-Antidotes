"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getViewer, getWorkspace } from "@/lib/auth";
import { monthGroupLabel } from "@/lib/planning/monday-mapping";
import {
  ACCEPTED_VISUAL_TYPES,
  MAX_VISUAL_BYTES,
  VISUALS_BUCKET,
  isOwnedVisualPath,
  visualPath,
} from "@/lib/planning/storage";
import {
  AD_STATUS_ORDER,
  FORMAT_ORDER,
  PLATFORM_LABELS,
  PLATFORM_ORDER,
  STATUS_ORDER,
} from "@/lib/planning/types";
import { createClient } from "@/lib/supabase/server";
import type {
  PlanningFaqEntryRow,
  PlanningSubjectRow,
} from "@/lib/supabase/database.types";

export type PlanningResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

/**
 * Actions du Planning Éditorial.
 *
 * Chaque action revalide le tableau plutôt que la page entière : une cellule
 * modifiée ne doit pas recharger le Reporting d'à côté.
 *
 * La RLS reste l'autorité — ces gardes servent à rendre une erreur lisible, pas
 * à protéger les données. Un appel direct à l'API REST se heurterait de toute
 * façon aux politiques de la migration 0007.
 */

const OK: PlanningResult = { ok: true };

type Scope = { workspace: string; board: string };

async function guard(scope: Scope) {
  const viewer = await getViewer();
  if (!viewer) throw new Error("Session expirée.");

  const workspace = await getWorkspace(scope.workspace);
  // Message neutre : ne pas confirmer l'existence d'un espace inaccessible.
  if (!workspace) throw new Error("Action indisponible.");

  return { viewer, workspace };
}

function revalidate(scope: Scope) {
  revalidatePath(`/espace/${scope.workspace}/planning/${scope.board}`);
}

function fail(error: unknown): PlanningResult {
  return { ok: false, error: (error as Error).message };
}

// --- Structure ---------------------------------------------------------------

const monthInput = z.object({
  boardId: z.uuid(),
  /** Premier jour du mois. */
  month: z.string().regex(/^\d{4}-\d{2}-01$/, "Mois invalide."),
});

export async function createMonth(
  scope: Scope,
  input: z.infer<typeof monthInput>,
): Promise<PlanningResult> {
  const parsed = monthInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Mois invalide." };

  try {
    const { workspace } = await guard(scope);
    const supabase = await createClient();

    const { data: last } = await supabase
      .from("planning_months")
      .select("position")
      .eq("board_id", parsed.data.boardId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await supabase.from("planning_months").insert({
      board_id: parsed.data.boardId,
      workspace_id: workspace.id,
      label: monthGroupLabel(parsed.data.month),
      month: parsed.data.month,
      position: (last?.position ?? -1) + 1,
    });

    // Le mois existe déjà : ce n'est pas une erreur, c'est un double clic.
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);

    revalidate(scope);
    return OK;
  } catch (error) {
    return fail(error);
  }
}

export async function renameMonth(
  scope: Scope,
  input: { monthId: string; label: string },
): Promise<PlanningResult> {
  try {
    await guard(scope);
    const supabase = await createClient();
    await supabase
      .from("planning_months")
      .update({ label: input.label.trim().slice(0, 80) || "MOIS" })
      .eq("id", input.monthId);
    revalidate(scope);
    return OK;
  } catch (error) {
    return fail(error);
  }
}

export async function deleteMonth(
  scope: Scope,
  input: { monthId: string },
): Promise<PlanningResult> {
  try {
    await guard(scope);
    const supabase = await createClient();
    await supabase.from("planning_months").delete().eq("id", input.monthId);
    revalidate(scope);
    return OK;
  } catch (error) {
    return fail(error);
  }
}

const laneInput = z.object({
  monthId: z.uuid(),
  boardId: z.uuid(),
  platform: z.enum(PLATFORM_ORDER as [string, ...string[]]),
  name: z.string().max(60).optional(),
});

export async function createLane(
  scope: Scope,
  input: z.infer<typeof laneInput>,
): Promise<PlanningResult> {
  const parsed = laneInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Réseau invalide." };

  try {
    const { workspace } = await guard(scope);
    const supabase = await createClient();

    const { data: last } = await supabase
      .from("planning_lanes")
      .select("position")
      .eq("month_id", parsed.data.monthId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    await supabase.from("planning_lanes").insert({
      month_id: parsed.data.monthId,
      board_id: parsed.data.boardId,
      workspace_id: workspace.id,
      platform: parsed.data.platform,
      name:
        parsed.data.name?.trim() ||
        PLATFORM_LABELS[parsed.data.platform as keyof typeof PLATFORM_LABELS],
      position: (last?.position ?? -1) + 1,
    });

    revalidate(scope);
    return OK;
  } catch (error) {
    return fail(error);
  }
}

export async function renameLane(
  scope: Scope,
  input: { laneId: string; name: string },
): Promise<PlanningResult> {
  try {
    await guard(scope);
    const supabase = await createClient();
    await supabase
      .from("planning_lanes")
      .update({ name: input.name.trim().slice(0, 60) || "RÉSEAU" })
      .eq("id", input.laneId);
    revalidate(scope);
    return OK;
  } catch (error) {
    return fail(error);
  }
}

export async function deleteLane(
  scope: Scope,
  input: { laneId: string },
): Promise<PlanningResult> {
  try {
    await guard(scope);
    const supabase = await createClient();
    await supabase.from("planning_lanes").delete().eq("id", input.laneId);
    revalidate(scope);
    return OK;
  } catch (error) {
    return fail(error);
  }
}

// --- Publications -------------------------------------------------------------

export async function createSubject(
  scope: Scope,
  input: { laneId: string; monthId: string; boardId: string },
): Promise<PlanningResult> {
  try {
    const { workspace } = await guard(scope);
    const supabase = await createClient();

    const { data: last } = await supabase
      .from("planning_subjects")
      .select("position")
      .eq("lane_id", input.laneId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Créée vide : on tape directement dans la cellule, comme dans un tableur.
    await supabase.from("planning_subjects").insert({
      lane_id: input.laneId,
      month_id: input.monthId,
      board_id: input.boardId,
      workspace_id: workspace.id,
      name: "",
      position: (last?.position ?? -1) + 1,
    });

    revalidate(scope);
    return OK;
  } catch (error) {
    return fail(error);
  }
}

/**
 * Champs modifiables d'une publication, et comment lire la valeur envoyée.
 *
 * La table est la seule porte d'entrée : un champ absent d'ici n'est pas
 * modifiable, quelle que soit la requête. C'est ce qui protège `board_id`,
 * `workspace_id` et les rattachements d'une réécriture depuis le navigateur.
 */
const EDITABLE_FIELDS = {
  name: z.string().max(300),
  status: z.enum(STATUS_ORDER as [string, ...string[]]),
  format: z.enum(FORMAT_ORDER as [string, ...string[]]),
  scheduled_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  wording: z.string().max(20_000).nullable(),
  sponsoring: z.number().nonnegative().nullable(),
  ad_objective: z.string().max(80).nullable(),
  ad_status: z.enum(AD_STATUS_ORDER as [string, ...string[]]).nullable(),
  owner_id: z.uuid().nullable(),
} as const;

export type EditableField = keyof typeof EDITABLE_FIELDS;

export async function updateSubject(
  scope: Scope,
  input: { subjectId: string; field: EditableField; value: unknown },
): Promise<PlanningResult> {
  const schema = EDITABLE_FIELDS[input.field];
  if (!schema) return { ok: false, error: "Colonne non modifiable." };

  const parsed = schema.safeParse(input.value);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Valeur invalide." };
  }

  try {
    await guard(scope);
    const supabase = await createClient();

    // La clé est dynamique mais bornée : `input.field` vient d'être validé
    // contre `EDITABLE_FIELDS`, seule porte d'entrée de cette fonction.
    const patch = { [input.field]: parsed.data } as Partial<PlanningSubjectRow>;

    const { error } = await supabase
      .from("planning_subjects")
      .update(patch)
      .eq("id", input.subjectId);

    if (error) throw new Error(error.message);

    revalidate(scope);
    return OK;
  } catch (error) {
    return fail(error);
  }
}

export async function deleteSubject(
  scope: Scope,
  input: { subjectId: string },
): Promise<PlanningResult> {
  try {
    await guard(scope);
    const supabase = await createClient();
    await supabase.from("planning_subjects").delete().eq("id", input.subjectId);
    revalidate(scope);
    return OK;
  } catch (error) {
    return fail(error);
  }
}

// --- Retours client ------------------------------------------------------------

const commentInput = z.object({
  subjectId: z.uuid(),
  scope: z.enum(["general", "visual", "wording"]),
  body: z.string().trim().min(1, "Le retour ne peut pas être vide.").max(4000),
});

export async function addComment(
  scope: Scope,
  input: z.infer<typeof commentInput>,
): Promise<PlanningResult> {
  const parsed = commentInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Retour invalide." };
  }

  try {
    const { viewer, workspace } = await guard(scope);
    const supabase = await createClient();

    const { error } = await supabase.from("planning_comments").insert({
      subject_id: parsed.data.subjectId,
      workspace_id: workspace.id,
      author_id: viewer.user.id,
      scope: parsed.data.scope,
      body: parsed.data.body,
    });

    if (error) throw new Error(error.message);

    revalidate(scope);
    return OK;
  } catch (error) {
    return fail(error);
  }
}

export async function deleteComment(
  scope: Scope,
  input: { commentId: string },
): Promise<PlanningResult> {
  try {
    await guard(scope);
    const supabase = await createClient();
    await supabase.from("planning_comments").delete().eq("id", input.commentId);
    revalidate(scope);
    return OK;
  } catch (error) {
    return fail(error);
  }
}

// --- Visuels ---------------------------------------------------------------------

/**
 * Envoi d'un visuel.
 *
 * Le fichier transite par le serveur plutôt que d'aller directement au bucket :
 * le chemin est ainsi construit ici, à partir de l'espace réellement accessible,
 * et non d'un identifiant fourni par le navigateur.
 */
export async function uploadVisual(
  scope: Scope,
  formData: FormData,
): Promise<PlanningResult> {
  const subjectId = String(formData.get("subjectId") ?? "");
  const file = formData.get("file");

  if (!subjectId || !(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Aucun fichier." };
  }
  if (file.size > MAX_VISUAL_BYTES) {
    return { ok: false, error: "Fichier trop lourd (50 Mo maximum)." };
  }
  if (!ACCEPTED_VISUAL_TYPES.includes(file.type)) {
    return { ok: false, error: `Format non accepté (${file.type || "inconnu"}).` };
  }

  try {
    const { workspace } = await guard(scope);
    const supabase = await createClient();

    const path = visualPath({
      workspaceId: workspace.id,
      subjectId,
      fileName: file.name,
    });

    const { error: uploadError } = await supabase.storage
      .from(VISUALS_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) throw new Error(uploadError.message);

    const { data: subject } = await supabase
      .from("planning_subjects")
      .select("visual_urls")
      .eq("id", subjectId)
      .maybeSingle();

    await supabase
      .from("planning_subjects")
      .update({ visual_urls: [...(subject?.visual_urls ?? []), path] })
      .eq("id", subjectId);

    revalidate(scope);
    return { ok: true, message: "Visuel ajouté." };
  } catch (error) {
    return fail(error);
  }
}

export async function removeVisual(
  scope: Scope,
  input: { subjectId: string; path: string },
): Promise<PlanningResult> {
  try {
    const { workspace } = await guard(scope);
    const supabase = await createClient();

    const { data: subject } = await supabase
      .from("planning_subjects")
      .select("visual_urls")
      .eq("id", input.subjectId)
      .maybeSingle();

    await supabase
      .from("planning_subjects")
      .update({
        visual_urls: (subject?.visual_urls ?? []).filter(
          (url) => url !== input.path,
        ),
      })
      .eq("id", input.subjectId);

    // Le fichier ne part du bucket que s'il y avait bien été déposé : un visuel
    // importé depuis Monday est une URL externe, pas un objet à nous.
    if (isOwnedVisualPath(input.path, workspace.id, input.subjectId)) {
      await supabase.storage.from(VISUALS_BUCKET).remove([input.path]);
    }

    revalidate(scope);
    return OK;
  } catch (error) {
    return fail(error);
  }
}

// --- FAQ ---------------------------------------------------------------------------

export async function createFaqEntry(
  scope: Scope,
  input: { boardId: string },
): Promise<PlanningResult> {
  try {
    const { workspace } = await guard(scope);
    const supabase = await createClient();

    const { data: last } = await supabase
      .from("planning_faq_entries")
      .select("position")
      .eq("board_id", input.boardId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    await supabase.from("planning_faq_entries").insert({
      board_id: input.boardId,
      workspace_id: workspace.id,
      question: "",
      position: (last?.position ?? -1) + 1,
    });

    revalidate(scope);
    return OK;
  } catch (error) {
    return fail(error);
  }
}

const FAQ_FIELDS = {
  question: z.string().max(500),
  answer: z.string().max(10_000).nullable(),
  category: z.string().max(80).nullable(),
} as const;

export type FaqField = keyof typeof FAQ_FIELDS;

export async function updateFaqEntry(
  scope: Scope,
  input: { entryId: string; field: FaqField; value: unknown },
): Promise<PlanningResult> {
  const schema = FAQ_FIELDS[input.field];
  if (!schema) return { ok: false, error: "Colonne non modifiable." };

  const parsed = schema.safeParse(input.value);
  if (!parsed.success) return { ok: false, error: "Valeur invalide." };

  try {
    await guard(scope);
    const supabase = await createClient();
    const patch = { [input.field]: parsed.data } as Partial<PlanningFaqEntryRow>;
    await supabase.from("planning_faq_entries").update(patch).eq("id", input.entryId);
    revalidate(scope);
    return OK;
  } catch (error) {
    return fail(error);
  }
}

export async function deleteFaqEntry(
  scope: Scope,
  input: { entryId: string },
): Promise<PlanningResult> {
  try {
    await guard(scope);
    const supabase = await createClient();
    await supabase.from("planning_faq_entries").delete().eq("id", input.entryId);
    revalidate(scope);
    return OK;
  } catch (error) {
    return fail(error);
  }
}
