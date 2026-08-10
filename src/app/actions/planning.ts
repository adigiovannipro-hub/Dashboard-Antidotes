"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getViewer, getWorkspace } from "@/lib/auth";
import { defaultLabelsFor } from "@/lib/planning/columns";
import type { ColumnType } from "@/lib/planning/columns";
import { monthGroupLabel } from "@/lib/planning/monday-mapping";
import {
  ACCEPTED_VISUAL_TYPES,
  MAX_VISUAL_BYTES,
  VISUALS_BUCKET,
  isOwnedVisualPath,
  visualPath,
} from "@/lib/planning/storage";
import { sendCommentEmails } from "@/lib/planning/notify";
import { PLATFORM_LABELS, PLATFORM_ORDER } from "@/lib/planning/types";
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
  // « Mon travail » réplique les lignes du jour sur la page d'accueil : les
  // deux vues lisent la même ligne, toute écriture doit rafraîchir les deux.
  revalidatePath("/");
}

function fail(error: unknown): PlanningResult {
  return { ok: false, error: (error as Error).message };
}

/**
 * Trace une modification au journal, et tamponne la ligne.
 *
 * En dehors de la transaction de la modification elle-même — Supabase JS n'en
 * offre pas — donc en tolérance d'échec : perdre une ligne de journal ne doit
 * jamais faire échouer la modification qu'elle décrit.
 */
async function logActivity(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  subjectId: string;
  workspaceId: string;
  actorId: string;
  field: string;
  before?: unknown;
  after?: unknown;
}) {
  const asText = (value: unknown): string | null =>
    value === null || value === undefined || value === "" ? null : String(value);

  try {
    await input.supabase.from("planning_activity").insert({
      subject_id: input.subjectId,
      workspace_id: input.workspaceId,
      actor_id: input.actorId,
      field: input.field,
      before: asText(input.before),
      after: asText(input.after),
    });
    await input.supabase
      .from("planning_subjects")
      .update({ updated_by: input.actorId })
      .eq("id", input.subjectId);
  } catch {
    // Voir plus haut : le journal est un témoin, pas un verrou.
  }
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
    const { viewer, workspace } = await guard(scope);
    const supabase = await createClient();

    const { data: last } = await supabase
      .from("planning_subjects")
      .select("position")
      .eq("lane_id", input.laneId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Créée vide : on tape directement dans la cellule, comme dans un tableur.
    const { data: created } = await supabase
      .from("planning_subjects")
      .insert({
        lane_id: input.laneId,
        month_id: input.monthId,
        board_id: input.boardId,
        workspace_id: workspace.id,
        name: "",
        position: (last?.position ?? -1) + 1,
      })
      .select("id")
      .single();

    if (created) {
      await logActivity({
        supabase,
        subjectId: created.id,
        workspaceId: workspace.id,
        actorId: viewer.user.id,
        field: "created",
      });
    }

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
  // Identifiants d'étiquette, libres depuis la migration 0029 : les valeurs
  // connues (published, reel…) comme celles de « + Nouvelle étiquette ».
  status: z.string().min(1).max(60),
  format: z.string().min(1).max(60),
  scheduled_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  wording: z.string().max(20_000).nullable(),
  sponsoring: z.number().nonnegative().nullable(),
  ad_objective: z.string().max(80).nullable(),
  ad_status: z.string().min(1).max(60).nullable(),
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
    const { viewer, workspace } = await guard(scope);
    const supabase = await createClient();

    // L'ancienne valeur, pour le journal : « À VALIDER → EN ATTENTE » ne se
    // reconstruit pas après coup.
    const { data: before } = await supabase
      .from("planning_subjects")
      .select(input.field)
      .eq("id", input.subjectId)
      .maybeSingle();

    // La clé est dynamique mais bornée : `input.field` vient d'être validé
    // contre `EDITABLE_FIELDS`, seule porte d'entrée de cette fonction.
    const patch = { [input.field]: parsed.data } as Partial<PlanningSubjectRow>;

    const { error } = await supabase
      .from("planning_subjects")
      .update(patch)
      .eq("id", input.subjectId);

    if (error) throw new Error(error.message);

    await logActivity({
      supabase,
      subjectId: input.subjectId,
      workspaceId: workspace.id,
      actorId: viewer.user.id,
      field: input.field,
      before: (before as Record<string, unknown> | null)?.[input.field],
      after: parsed.data,
    });

    revalidate(scope);
    return OK;
  } catch (error) {
    return fail(error);
  }
}

/**
 * Modification groupée — la barre d'actions de la sélection multiple.
 *
 * Même porte d'entrée que la modification unitaire : un champ hors
 * `EDITABLE_FIELDS` est rejeté avant toute lecture.
 */
export async function bulkUpdateSubjects(
  scope: Scope,
  input: { subjectIds: string[]; field: EditableField; value: unknown },
): Promise<PlanningResult> {
  const schema = EDITABLE_FIELDS[input.field];
  if (!schema) return { ok: false, error: "Colonne non modifiable." };
  if (input.subjectIds.length === 0 || input.subjectIds.length > 200) {
    return { ok: false, error: "Sélection vide ou trop large." };
  }

  const parsed = schema.safeParse(input.value);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Valeur invalide." };
  }

  try {
    const { viewer, workspace } = await guard(scope);
    const supabase = await createClient();

    const patch = { [input.field]: parsed.data } as Partial<PlanningSubjectRow>;
    const { error } = await supabase
      .from("planning_subjects")
      .update(patch)
      .in("id", input.subjectIds);

    if (error) throw new Error(error.message);

    for (const subjectId of input.subjectIds) {
      await logActivity({
        supabase,
        subjectId,
        workspaceId: workspace.id,
        actorId: viewer.user.id,
        field: input.field,
        after: parsed.data,
      });
    }

    revalidate(scope);
    return {
      ok: true,
      message: `${input.subjectIds.length} publication${input.subjectIds.length > 1 ? "s" : ""} modifiée${input.subjectIds.length > 1 ? "s" : ""}.`,
    };
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

export async function bulkDeleteSubjects(
  scope: Scope,
  input: { subjectIds: string[] },
): Promise<PlanningResult> {
  if (input.subjectIds.length === 0 || input.subjectIds.length > 200) {
    return { ok: false, error: "Sélection vide ou trop large." };
  }

  try {
    await guard(scope);
    const supabase = await createClient();
    await supabase.from("planning_subjects").delete().in("id", input.subjectIds);
    revalidate(scope);
    return {
      ok: true,
      message: `${input.subjectIds.length} publication${input.subjectIds.length > 1 ? "s" : ""} supprimée${input.subjectIds.length > 1 ? "s" : ""}.`,
    };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Duplication groupée — le « Dupliquer » de la barre de sélection.
 *
 * La copie arrive en fin de son couloir, nommée « (copie) », et référence les
 * mêmes visuels : les fichiers ne sont pas recopiés, et la suppression d'un
 * visuel ne retire du bucket que les chemins propres à la publication
 * (`isOwnedVisualPath`), l'original garde donc les siens.
 */
export async function bulkDuplicateSubjects(
  scope: Scope,
  input: { subjectIds: string[] },
): Promise<PlanningResult> {
  if (input.subjectIds.length === 0 || input.subjectIds.length > 50) {
    return { ok: false, error: "Sélection vide ou trop large." };
  }

  try {
    const { viewer, workspace } = await guard(scope);
    const supabase = await createClient();

    const { data } = await supabase
      .from("planning_subjects")
      .select("*")
      .in("id", input.subjectIds)
      .order("position");
    const originals = (data ?? []) as unknown as PlanningSubjectRow[];
    if (originals.length === 0) return { ok: false, error: "Rien à dupliquer." };

    // Une position de départ par couloir, au-delà de l'existant.
    const laneIds = [...new Set(originals.map((subject) => subject.lane_id))];
    const nextPosition = new Map<string, number>();
    for (const laneId of laneIds) {
      const { data: last } = await supabase
        .from("planning_subjects")
        .select("position")
        .eq("lane_id", laneId)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      nextPosition.set(laneId, (last?.position ?? -1) + 1);
    }

    const copies = originals.map((subject) => {
      const position = nextPosition.get(subject.lane_id) ?? 0;
      nextPosition.set(subject.lane_id, position + 1);
      return {
        lane_id: subject.lane_id,
        month_id: subject.month_id,
        board_id: subject.board_id,
        workspace_id: workspace.id,
        name: subject.name ? `${subject.name} (copie)` : "(copie)",
        status: subject.status,
        format: subject.format,
        scheduled_on: subject.scheduled_on,
        wording: subject.wording,
        sponsoring: subject.sponsoring,
        ad_objective: subject.ad_objective,
        ad_status: subject.ad_status,
        owner_id: subject.owner_id,
        visual_urls: subject.visual_urls,
        custom: subject.custom,
        position,
      };
    });

    const { data: created, error } = await supabase
      .from("planning_subjects")
      .insert(copies as never)
      .select("id");
    if (error) throw new Error(error.message);

    for (const row of created ?? []) {
      await logActivity({
        supabase,
        subjectId: row.id,
        workspaceId: workspace.id,
        actorId: viewer.user.id,
        field: "created",
      });
    }

    revalidate(scope);
    return {
      ok: true,
      message: `${copies.length} publication${copies.length > 1 ? "s" : ""} dupliquée${copies.length > 1 ? "s" : ""}.`,
    };
  } catch (error) {
    return fail(error);
  }
}

// --- Valeurs des colonnes ajoutées -------------------------------------------

const customValue = z.union([
  z.string().max(2000),
  z.number(),
  z.boolean(),
  z.null(),
]);

/**
 * Écrit la valeur d'une colonne ajoutée dans le jsonb `custom`.
 *
 * La colonne doit exister sur ce tableau : on n'écrit pas dans un champ
 * arbitraire du jsonb, sinon `custom` deviendrait un fourre-tout que rien ne
 * relit.
 */
export async function updateCustomValue(
  scope: Scope,
  input: { subjectId: string; columnId: string; value: unknown },
): Promise<PlanningResult> {
  const parsed = customValue.safeParse(input.value);
  if (!parsed.success) return { ok: false, error: "Valeur invalide." };

  try {
    const { viewer, workspace } = await guard(scope);
    const supabase = await createClient();

    const { data: column } = await supabase
      .from("planning_columns")
      .select("id, label")
      .eq("id", input.columnId)
      .is("builtin_key", null)
      .maybeSingle();

    if (!column) return { ok: false, error: "Colonne inconnue." };

    const { data: subject } = await supabase
      .from("planning_subjects")
      .select("custom")
      .eq("id", input.subjectId)
      .maybeSingle();

    const custom = {
      ...((subject?.custom ?? {}) as Record<string, unknown>),
      [input.columnId]: parsed.data,
    };

    const { error } = await supabase
      .from("planning_subjects")
      .update({ custom: custom as never })
      .eq("id", input.subjectId);

    if (error) throw new Error(error.message);

    await logActivity({
      supabase,
      subjectId: input.subjectId,
      workspaceId: workspace.id,
      actorId: viewer.user.id,
      field: column.label ?? "colonne",
      before: (subject?.custom as Record<string, unknown> | undefined)?.[
        input.columnId
      ],
      after: parsed.data,
    });

    revalidate(scope);
    return OK;
  } catch (error) {
    return fail(error);
  }
}

// --- Colonnes ---------------------------------------------------------------

const BUILTIN_KEYS = [
  "name",
  "status",
  "format",
  "date",
  "visual",
  "wording",
  "sponsoring",
  "objective",
  "ad_status",
  "updated",
] as const;

const labelSchema = z.object({
  id: z.string().min(1).max(60),
  label: z.string().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide."),
});

const columnPatch = z.object({
  label: z.string().trim().min(1).max(60).optional(),
  hidden: z.boolean().optional(),
  position: z.number().int().min(0).max(10_000).optional(),
  labels: z.array(labelSchema).max(30).optional(),
  /** Posée par la poignée de redimensionnement. Bornes de la contrainte SQL. */
  width: z.number().int().min(60).max(900).optional(),
});

/**
 * Retouche une colonne — renommage, masquage, déplacement, étiquettes.
 *
 * Pour une colonne de base, la ligne d'écart est créée au premier écart : un
 * tableau jamais retouché n'a rien en base, et c'est voulu.
 */
export async function updateColumn(
  scope: Scope,
  input: {
    /** Clé de base (`status`…) ou uuid d'une colonne ajoutée. */
    columnId: string;
    patch: z.infer<typeof columnPatch>;
  },
): Promise<PlanningResult> {
  const parsed = columnPatch.safeParse(input.patch);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Retouche invalide." };
  }

  try {
    const { workspace } = await guard(scope);
    const supabase = await createClient();

    const { data: board } = await supabase
      .from("planning_boards")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("slug", scope.board)
      .maybeSingle();
    if (!board) return { ok: false, error: "Tableau introuvable." };

    const isBuiltin = (BUILTIN_KEYS as readonly string[]).includes(input.columnId);

    const patch: Record<string, unknown> = {};
    if (parsed.data.label !== undefined) patch.label = parsed.data.label;
    if (parsed.data.hidden !== undefined) patch.hidden = parsed.data.hidden;
    if (parsed.data.position !== undefined) patch.position = parsed.data.position;
    if (parsed.data.labels !== undefined) {
      patch.settings = { labels: parsed.data.labels };
    }
    if (parsed.data.width !== undefined) patch.width = parsed.data.width;

    if (isBuiltin) {
      const { error } = await supabase.from("planning_columns").upsert(
        {
          board_id: board.id,
          workspace_id: workspace.id,
          builtin_key: input.columnId,
          ...patch,
        } as never,
        { onConflict: "board_id,builtin_key" },
      );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("planning_columns")
        .update(patch as never)
        .eq("id", input.columnId)
        .eq("board_id", board.id);
      if (error) throw new Error(error.message);
    }

    revalidate(scope);
    return OK;
  } catch (error) {
    return fail(error);
  }
}

const ADDABLE: ColumnType[] = [
  "status",
  "dropdown",
  "text",
  "date",
  "people",
  "number",
  "checkbox",
];

export async function addColumn(
  scope: Scope,
  input: { boardId: string; type: ColumnType; label: string },
): Promise<PlanningResult> {
  if (!ADDABLE.includes(input.type)) {
    return { ok: false, error: "Type de colonne inconnu." };
  }
  const label = input.label.trim().slice(0, 60);
  if (!label) return { ok: false, error: "La colonne doit avoir un nom." };

  try {
    const { workspace } = await guard(scope);
    const supabase = await createClient();

    const { data: last } = await supabase
      .from("planning_columns")
      .select("position")
      .eq("board_id", input.boardId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const labels = defaultLabelsFor(input.type);
    const { error } = await supabase.from("planning_columns").insert({
      board_id: input.boardId,
      workspace_id: workspace.id,
      builtin_key: null,
      type: input.type,
      label,
      // Après les colonnes de base (0 à 90) et les ajouts précédents.
      position: Math.max(1000, (last?.position ?? 999) + 10),
      settings: (labels ? { labels } : {}) as never,
    });
    if (error) throw new Error(error.message);

    revalidate(scope);
    return OK;
  } catch (error) {
    return fail(error);
  }
}

/** Supprime une colonne ajoutée. Les colonnes de base se masquent, point. */
export async function removeColumn(
  scope: Scope,
  input: { columnId: string },
): Promise<PlanningResult> {
  try {
    await guard(scope);
    const supabase = await createClient();
    await supabase
      .from("planning_columns")
      .delete()
      .eq("id", input.columnId)
      .is("builtin_key", null);
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
  /** Adresses taguées : le retour leur part aussi par e-mail. */
  mentions: z.array(z.email()).max(10).default([]),
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

    let { error } = await supabase.from("planning_comments").insert({
      subject_id: parsed.data.subjectId,
      workspace_id: workspace.id,
      author_id: viewer.user.id,
      scope: parsed.data.scope,
      body: parsed.data.body,
      mentions: parsed.data.mentions,
    });

    // Base pas encore migrée (0030) : le retour s'écrit sans la colonne
    // plutôt que d'échouer — l'e-mail, lui, part quand même.
    if (error && error.message.includes("mentions")) {
      ({ error } = await supabase.from("planning_comments").insert({
        subject_id: parsed.data.subjectId,
        workspace_id: workspace.id,
        author_id: viewer.user.id,
        scope: parsed.data.scope,
        body: parsed.data.body,
      }));
    }

    if (error) throw new Error(error.message);

    // L'e-mail part après l'écriture, jamais à sa place : un Gmail en panne
    // laisse le retour dans le fil, avec un message qui dit ce qui n'est pas
    // parti.
    let message: string | undefined;
    if (parsed.data.mentions.length > 0) {
      const [{ data: subject }, { data: profile }] = await Promise.all([
        supabase
          .from("planning_subjects")
          .select("name, lane_id")
          .eq("id", parsed.data.subjectId)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("full_name")
          .eq("id", viewer.user.id)
          .maybeSingle(),
      ]);
      const { data: lane } = subject?.lane_id
        ? await supabase
            .from("planning_lanes")
            .select("name")
            .eq("id", subject.lane_id)
            .maybeSingle()
        : { data: null };

      const outcome = await sendCommentEmails({
        recipients: parsed.data.mentions,
        workspaceSlug: scope.workspace,
        workspaceName: workspace.name,
        boardSlug: scope.board,
        subjectId: parsed.data.subjectId,
        subjectName: subject?.name ?? "",
        laneName: lane?.name ?? "",
        authorName: profile?.full_name ?? viewer.email,
        body: parsed.data.body,
      });

      if (outcome.sent.length > 0 && outcome.failed.length === 0) {
        message = `Retour envoyé à ${outcome.sent.join(", ")}.`;
      } else if (outcome.sent.length > 0) {
        message = `Retour envoyé à ${outcome.sent.join(", ")} — échec pour ${outcome.failed.join(", ")}.`;
      } else {
        message = `Retour enregistré, e-mail non parti : ${outcome.reason ?? "envoi refusé"}`;
      }
    }

    revalidate(scope);
    return { ok: true, message };
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
  const files = formData
    .getAll("file")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!subjectId || files.length === 0) {
    return { ok: false, error: "Aucun fichier." };
  }
  if (files.length > 20) {
    return { ok: false, error: "20 fichiers maximum d'un coup." };
  }
  for (const file of files) {
    if (file.size > MAX_VISUAL_BYTES) {
      return { ok: false, error: `${file.name} : trop lourd (50 Mo maximum).` };
    }
    if (!ACCEPTED_VISUAL_TYPES.includes(file.type)) {
      return {
        ok: false,
        error: `${file.name} : format non accepté (${file.type || "inconnu"}).`,
      };
    }
  }

  try {
    const { viewer, workspace } = await guard(scope);
    const supabase = await createClient();

    // Les envois s'enchaînent, puis la liste s'écrit en une fois : un échec au
    // troisième fichier garde les deux premiers.
    const uploaded: string[] = [];
    for (const file of files) {
      const path = visualPath({
        workspaceId: workspace.id,
        subjectId,
        fileName: file.name,
      });
      const { error: uploadError } = await supabase.storage
        .from(VISUALS_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) {
        if (uploaded.length === 0) throw new Error(uploadError.message);
        break;
      }
      uploaded.push(path);
    }

    const { data: subject } = await supabase
      .from("planning_subjects")
      .select("visual_urls")
      .eq("id", subjectId)
      .maybeSingle();

    await supabase
      .from("planning_subjects")
      .update({ visual_urls: [...(subject?.visual_urls ?? []), ...uploaded] })
      .eq("id", subjectId);

    await logActivity({
      supabase,
      subjectId,
      workspaceId: workspace.id,
      actorId: viewer.user.id,
      field: "visual",
      after: files.map((file) => file.name).join(", "),
    });

    revalidate(scope);
    return {
      ok: true,
      message:
        uploaded.length === 1
          ? "Visuel ajouté."
          : `${uploaded.length} visuels ajoutés.`,
    };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Réordonne les visuels d'une publication — l'ordre des slides du carrousel.
 *
 * La liste complète est reçue puis validée contre l'existante : mêmes chemins,
 * même nombre. On réordonne, on n'injecte pas.
 */
export async function reorderVisuals(
  scope: Scope,
  input: { subjectId: string; paths: string[] },
): Promise<PlanningResult> {
  try {
    await guard(scope);
    const supabase = await createClient();

    const { data: subject } = await supabase
      .from("planning_subjects")
      .select("visual_urls")
      .eq("id", input.subjectId)
      .maybeSingle();

    const current = subject?.visual_urls ?? [];
    const sameSet =
      current.length === input.paths.length &&
      [...current].sort().join("\n") === [...input.paths].sort().join("\n");

    if (!sameSet) return { ok: false, error: "La liste des visuels a changé." };

    await supabase
      .from("planning_subjects")
      .update({ visual_urls: input.paths })
      .eq("id", input.subjectId);

    revalidate(scope);
    return OK;
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
