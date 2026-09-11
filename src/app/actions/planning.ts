"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getViewer, getWorkspace } from "@/lib/auth";
import { defaultLabelsFor } from "@/lib/planning/columns";
import type { ColumnType } from "@/lib/planning/columns";
import { monthGroupLabel } from "@/lib/planning/monday-mapping";
import { evaluateMonthSlot, type MonthSlotRow } from "@/lib/planning/month-slot";
import {
  MAX_VISUAL_BYTES,
  VISUALS_BUCKET,
  isAcceptedVisual,
  isOwnedVisualPath,
  previewPathFor,
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
    const label = monthGroupLabel(parsed.data.month);

    // La corbeille laisse la ligne en place et l'unicité `(board_id, month)`
    // ne la distingue pas : sans ce coup d'œil, recréer un mois supprimé se
    // heurte au 23505 et le mois ne revient jamais.
    const { data: row } = await supabase
      .from("planning_months")
      .select("id, deleted_at")
      .eq("board_id", parsed.data.boardId)
      .eq("month", parsed.data.month)
      .maybeSingle();

    const slot = evaluateMonthSlot(row as unknown as MonthSlotRow | null);

    if (slot.action === "keep") {
      // Le tableau de l'appelant est simplement en retard : on le rafraîchit.
      revalidate(scope);
      return { ok: true, message: `${label} est déjà au tableau.` };
    }

    const { data: last } = await supabase
      .from("planning_months")
      .select("position")
      .eq("board_id", parsed.data.boardId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const position = (last?.position ?? -1) + 1;

    if (slot.action === "restore") {
      // Libellé et position repris du menu : c'est le mois que l'écran a
      // proposé, pas celui qu'on avait renommé avant de le jeter.
      const { error } = await supabase
        .from("planning_months")
        .update({ deleted_at: null, label, position })
        .eq("id", slot.monthId);
      if (error) throw new Error(error.message);

      revalidate(scope);
      return { ok: true, message: `${label} sorti de la corbeille.` };
    }

    const { error } = await supabase.from("planning_months").insert({
      board_id: parsed.data.boardId,
      workspace_id: workspace.id,
      label,
      month: parsed.data.month,
      position,
    });

    // Seuls deux clics partis en même temps peuvent encore buter sur
    // l'unicité, et le mois est alors bien là. Tout autre refus remonte :
    // l'avaler sur le mot « duplicate » rendait un toast vert sur une
    // création qui n'avait pas eu lieu.
    if (error && error.code !== "23505") throw new Error(error.message);

    revalidate(scope);
    return { ok: true, message: `${label} ajouté.` };
  } catch (error) {
    return fail(error);
  }
}

export type YearBoardResult =
  | { ok: true; slug: string; message: string }
  | { ok: false; error: string };

/**
 * Prolonge le planning d'une année : un tableau 2027 à côté du 2026.
 *
 * **La configuration, jamais le contenu** — même règle que la duplication
 * d'un espace : colonnes, vocabulaire d'étiquettes et réglages suivent, les
 * douze mois se créent vides, aucune publication n'est copiée.
 */
export async function addYearBoard(scope: Scope): Promise<YearBoardResult> {
  try {
    const { workspace } = await guard(scope);
    const supabase = await createClient();

    // Le dernier tableau éditorial en date : c'est lui qu'on prolonge, avec
    // sa configuration la plus récente.
    const { data: boards } = await supabase
      .from("planning_boards")
      .select("id, slug, year, position, settings")
      .eq("workspace_id", workspace.id)
      .eq("kind", "editorial")
      .order("year", { ascending: false })
      .limit(1);

    const source = (boards ?? [])[0] as
      | { id: string; slug: string; year: number | null; position: number; settings: unknown }
      | undefined;
    if (!source) {
      return { ok: false, error: "Aucun planning éditorial à prolonger." };
    }

    const year = (source.year ?? new Date().getUTCFullYear()) + 1;
    const slug = String(year);

    // Déjà créé — un double clic, pas une erreur : on y va simplement.
    const { data: existing } = await supabase
      .from("planning_boards")
      .select("slug")
      .eq("workspace_id", workspace.id)
      .eq("slug", slug)
      .maybeSingle();
    if (existing) {
      return { ok: true, slug, message: `Le tableau ${year} existe déjà.` };
    }

    const { data: created, error } = await supabase
      .from("planning_boards")
      .insert({
        workspace_id: workspace.id,
        kind: "editorial",
        slug,
        name: slug,
        year,
        position: (source.position ?? 0) + 1,
        settings: source.settings as never,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { data: columns } = await supabase
      .from("planning_columns")
      .select("builtin_key, type, label, position, hidden, settings, width")
      .eq("board_id", source.id);

    if (columns && columns.length > 0) {
      const { error: columnsError } = await supabase.from("planning_columns").insert(
        columns.map((column) => ({
          ...(column as Record<string, unknown>),
          board_id: created.id,
          workspace_id: workspace.id,
        })) as never,
      );
      if (columnsError) throw new Error(columnsError.message);
    }

    const { error: monthsError } = await supabase.from("planning_months").insert(
      Array.from({ length: 12 }, (_, index) => {
        const month = `${year}-${String(index + 1).padStart(2, "0")}-01`;
        return {
          board_id: created.id,
          workspace_id: workspace.id,
          month,
          label: monthGroupLabel(month),
          position: index,
        };
      }),
    );
    if (monthsError) throw new Error(monthsError.message);

    revalidatePath(`/espace/${scope.workspace}/planning/${slug}`);
    revalidate(scope);
    return { ok: true, slug, message: `Tableau ${year} créé, prêt à remplir.` };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

/**
 * Supprime le tableau entier — l'année et tout ce qu'elle contient, en
 * cascade. Pas de corbeille à ce niveau : la politique RLS ne l'accorde
 * qu'au propriétaire, et la boîte de confirmation a déjà dit le prix.
 */
export async function deleteBoard(scope: Scope): Promise<PlanningResult> {
  try {
    const { workspace } = await guard(scope);
    const supabase = await createClient();

    const { data: deleted, error } = await supabase
      .from("planning_boards")
      .delete()
      .eq("workspace_id", workspace.id)
      .eq("slug", scope.board)
      .select("id");
    if (error) throw new Error(error.message);

    // La RLS filtre en silence : zéro ligne veut dire « pas propriétaire »,
    // pas « déjà supprimé ».
    if ((deleted ?? []).length === 0) {
      return { ok: false, error: "La suppression d'un tableau est réservée au propriétaire." };
    }

    revalidatePath(`/espace/${scope.workspace}/planning`);
    return { ok: true, message: "Tableau supprimé." };
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

/**
 * Supprimer un mois l'envoie à la corbeille, d'où il se restaure. Sur une
 * base sans la migration 0031, on retombe sur la suppression réelle plutôt
 * que d'échouer — le comportement d'avant.
 */
export async function deleteMonth(
  scope: Scope,
  input: { monthId: string },
): Promise<PlanningResult> {
  try {
    await guard(scope);
    const supabase = await createClient();
    const { error } = await supabase
      .from("planning_months")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", input.monthId);
    if (error && error.message.includes("deleted_at")) {
      await supabase.from("planning_months").delete().eq("id", input.monthId);
      revalidate(scope);
      return OK;
    }
    if (error) throw new Error(error.message);
    revalidate(scope);
    return { ok: true, message: "Mois envoyé à la corbeille." };
  } catch (error) {
    return fail(error);
  }
}

export async function restoreMonth(
  scope: Scope,
  input: { monthId: string },
): Promise<PlanningResult> {
  try {
    await guard(scope);
    const supabase = await createClient();
    const { error } = await supabase
      .from("planning_months")
      .update({ deleted_at: null })
      .eq("id", input.monthId);
    if (error) throw new Error(error.message);
    revalidate(scope);
    return { ok: true, message: "Mois restauré." };
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

const applySortInput = z.object({
  lanes: z
    .array(
      z.object({
        laneId: z.uuid(),
        subjectIds: z.array(z.uuid()).max(500),
      }),
    )
    .max(200),
});

/**
 * Matérialise l'ordre trié : les positions du tableau sont réécrites pour
 * suivre l'ordre affiché — le geste « Enregistrer » de Monday après un tri.
 * L'ordre manuel redevient alors l'ordre trié, pour tout le monde.
 *
 * `lane_id` dans la condition : un sujet déplacé vers un autre couloir entre
 * le tri et le clic n'est pas réécrit — sa position appartient à son nouveau
 * couloir.
 */
export async function applySortOrder(
  scope: Scope,
  input: z.infer<typeof applySortInput>,
): Promise<PlanningResult> {
  const parsed = applySortInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ordre invalide." };

  try {
    await guard(scope);
    const supabase = await createClient();

    for (const lane of parsed.data.lanes) {
      const updates = lane.subjectIds.map((subjectId, index) =>
        supabase
          .from("planning_subjects")
          .update({ position: index } as never)
          .eq("id", subjectId)
          .eq("lane_id", lane.laneId),
      );
      const results = await Promise.all(updates);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw new Error(failed.error.message);
    }

    revalidate(scope);
    return { ok: true, message: "Ordre enregistré." };
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
  return bulkDeleteSubjects(scope, { subjectIds: [input.subjectId] });
}

/**
 * La suppression est douce : la ligne part à la corbeille (`deleted_at`) et se
 * restaure depuis l'en-tête du tableau. Sur une base sans la migration 0031,
 * on retombe sur la suppression réelle — le comportement d'avant.
 */
export async function bulkDeleteSubjects(
  scope: Scope,
  input: { subjectIds: string[] },
): Promise<PlanningResult> {
  if (input.subjectIds.length === 0 || input.subjectIds.length > 200) {
    return { ok: false, error: "Sélection vide ou trop large." };
  }

  try {
    const { viewer, workspace } = await guard(scope);
    const supabase = await createClient();

    const { error } = await supabase
      .from("planning_subjects")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", input.subjectIds);

    if (error && error.message.includes("deleted_at")) {
      await supabase.from("planning_subjects").delete().in("id", input.subjectIds);
      revalidate(scope);
      return {
        ok: true,
        message: `${input.subjectIds.length} publication${input.subjectIds.length > 1 ? "s" : ""} supprimée${input.subjectIds.length > 1 ? "s" : ""}.`,
      };
    }
    if (error) throw new Error(error.message);

    for (const subjectId of input.subjectIds) {
      await logActivity({
        supabase,
        subjectId,
        workspaceId: workspace.id,
        actorId: viewer.user.id,
        field: "deleted",
      });
    }

    revalidate(scope);
    return {
      ok: true,
      message:
        input.subjectIds.length === 1
          ? "Publication envoyée à la corbeille."
          : `${input.subjectIds.length} publications envoyées à la corbeille.`,
    };
  } catch (error) {
    return fail(error);
  }
}

/** L'archivage : hors du tableau, hors de la corbeille, récupérable. */
export async function bulkArchiveSubjects(
  scope: Scope,
  input: { subjectIds: string[] },
): Promise<PlanningResult> {
  if (input.subjectIds.length === 0 || input.subjectIds.length > 200) {
    return { ok: false, error: "Sélection vide ou trop large." };
  }

  try {
    const { viewer, workspace } = await guard(scope);
    const supabase = await createClient();

    const { error } = await supabase
      .from("planning_subjects")
      .update({ archived_at: new Date().toISOString() })
      .in("id", input.subjectIds);

    if (error?.message.includes("archived_at")) {
      return {
        ok: false,
        error: "La base n'a pas encore la migration 0031 — colle le fichier SQL de rattrapage.",
      };
    }
    if (error) throw new Error(error.message);

    for (const subjectId of input.subjectIds) {
      await logActivity({
        supabase,
        subjectId,
        workspaceId: workspace.id,
        actorId: viewer.user.id,
        field: "archived",
      });
    }

    revalidate(scope);
    return {
      ok: true,
      message:
        input.subjectIds.length === 1
          ? "Publication archivée."
          : `${input.subjectIds.length} publications archivées.`,
    };
  } catch (error) {
    return fail(error);
  }
}

/** Ressort une publication des archives ou de la corbeille. */
export async function restoreSubjects(
  scope: Scope,
  input: { subjectIds: string[] },
): Promise<PlanningResult> {
  if (input.subjectIds.length === 0 || input.subjectIds.length > 200) {
    return { ok: false, error: "Sélection vide ou trop large." };
  }

  try {
    const { viewer, workspace } = await guard(scope);
    const supabase = await createClient();

    const { error } = await supabase
      .from("planning_subjects")
      .update({ archived_at: null, deleted_at: null })
      .in("id", input.subjectIds);
    if (error) throw new Error(error.message);

    for (const subjectId of input.subjectIds) {
      await logActivity({
        supabase,
        subjectId,
        workspaceId: workspace.id,
        actorId: viewer.user.id,
        field: "restored",
      });
    }

    revalidate(scope);
    return { ok: true, message: "Restauré au tableau." };
  } catch (error) {
    return fail(error);
  }
}

// --- Déplacement --------------------------------------------------------------

/**
 * Range une ligne à sa place — le drag & drop du tableau.
 *
 * `index` est la position visée parmi les lignes **visibles** du couloir
 * cible. Les positions du couloir sont réécrites séquentiellement : les
 * volumes (quelques dizaines de lignes par couloir) rendent la boucle plus
 * simple et plus sûre qu'une arithmétique d'interstices.
 */
export async function moveSubject(
  scope: Scope,
  input: { subjectId: string; laneId: string; index: number },
): Promise<PlanningResult> {
  try {
    const { viewer, workspace } = await guard(scope);
    const supabase = await createClient();

    const [{ data: lane }, { data: moved }] = await Promise.all([
      supabase
        .from("planning_lanes")
        .select("id, month_id, board_id, name")
        .eq("id", input.laneId)
        .maybeSingle(),
      supabase
        .from("planning_subjects")
        .select("id, lane_id")
        .eq("id", input.subjectId)
        .maybeSingle(),
    ]);
    if (!lane || !moved) return { ok: false, error: "Ligne ou réseau introuvable." };

    const { data: siblings } = await supabase
      .from("planning_subjects")
      .select("id, position, archived_at, deleted_at")
      .eq("lane_id", lane.id)
      .order("position");

    const visible = ((siblings ?? []) as unknown as {
      id: string;
      position: number;
      archived_at?: string | null;
      deleted_at?: string | null;
    }[]).filter(
      (subject) =>
        !subject.archived_at && !subject.deleted_at && subject.id !== input.subjectId,
    );

    const index = Math.max(0, Math.min(input.index, visible.length));
    const ordered = [
      ...visible.slice(0, index).map((subject) => subject.id),
      input.subjectId,
      ...visible.slice(index).map((subject) => subject.id),
    ];

    for (const [position, id] of ordered.entries()) {
      const patch: Record<string, unknown> = { position };
      if (id === input.subjectId) {
        patch.lane_id = lane.id;
        patch.month_id = lane.month_id;
      }
      const { error } = await supabase
        .from("planning_subjects")
        .update(patch as never)
        .eq("id", id);
      if (error) throw new Error(error.message);
    }

    if (moved.lane_id !== lane.id) {
      const { data: from } = await supabase
        .from("planning_lanes")
        .select("name")
        .eq("id", moved.lane_id)
        .maybeSingle();
      await logActivity({
        supabase,
        subjectId: input.subjectId,
        workspaceId: workspace.id,
        actorId: viewer.user.id,
        field: "moved",
        before: from?.name,
        after: lane.name,
      });
    }

    revalidate(scope);
    return OK;
  } catch (error) {
    return fail(error);
  }
}

/** Déplacement groupé : la sélection rejoint la fin du couloir choisi. */
export async function bulkMoveSubjects(
  scope: Scope,
  input: { subjectIds: string[]; laneId: string },
): Promise<PlanningResult> {
  if (input.subjectIds.length === 0 || input.subjectIds.length > 200) {
    return { ok: false, error: "Sélection vide ou trop large." };
  }

  try {
    const { viewer, workspace } = await guard(scope);
    const supabase = await createClient();

    const { data: lane } = await supabase
      .from("planning_lanes")
      .select("id, month_id, name")
      .eq("id", input.laneId)
      .maybeSingle();
    if (!lane) return { ok: false, error: "Réseau introuvable." };

    const [{ data: last }, { data: movedRows }] = await Promise.all([
      supabase
        .from("planning_subjects")
        .select("position")
        .eq("lane_id", lane.id)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("planning_subjects")
        .select("id, position")
        .in("id", input.subjectIds)
        .order("position"),
    ]);

    let position = (last?.position ?? -1) + 1;
    for (const subject of movedRows ?? []) {
      const { error } = await supabase
        .from("planning_subjects")
        .update({ lane_id: lane.id, month_id: lane.month_id, position })
        .eq("id", subject.id);
      if (error) throw new Error(error.message);
      position += 1;

      await logActivity({
        supabase,
        subjectId: subject.id,
        workspaceId: workspace.id,
        actorId: viewer.user.id,
        field: "moved",
        after: lane.name,
      });
    }

    revalidate(scope);
    return {
      ok: true,
      message: `${input.subjectIds.length} publication${input.subjectIds.length > 1 ? "s" : ""} déplacée${input.subjectIds.length > 1 ? "s" : ""} vers ${lane.name}.`,
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
 * L'envoi d'un visuel ne transite plus par le serveur : le proxy de Next
 * tronque les corps au-delà de 10 Mo — une vidéo arrivait coupée et l'action
 * tombait en 500. Le navigateur téléverse **directement dans le bucket**, en
 * deux temps : le serveur signe des URL d'envoi (le chemin reste construit
 * ici, depuis l'espace réellement accessible), le navigateur pousse les
 * octets, puis `attachVisuals` accroche les chemins à la publication.
 */

export type PreparedUpload = {
  path: string;
  /** URL signée d'envoi — un PUT du fichier brut, et rien d'autre. */
  url: string;
  /** L'emplacement de la miniature, signé d'avance : le navigateur la
      fabrique (1080 px, JPEG) et la pousse à côté de l'original. */
  previewPath: string;
  previewUrl: string;
};

export type PrepareUploadsResult =
  | { ok: true; uploads: PreparedUpload[] }
  | { ok: false; error: string };

export async function prepareVisualUploads(
  scope: Scope,
  input: {
    subjectId: string;
    files: { name: string; type: string; size: number }[];
  },
): Promise<PrepareUploadsResult> {
  if (!input.subjectId || input.files.length === 0) {
    return { ok: false, error: "Aucun fichier." };
  }
  if (input.files.length > 20) {
    return { ok: false, error: "20 fichiers maximum d'un coup." };
  }
  for (const file of input.files) {
    if (file.size > MAX_VISUAL_BYTES) {
      return { ok: false, error: `${file.name} : trop lourd (50 Mo maximum).` };
    }
    if (!isAcceptedVisual(file)) {
      return {
        ok: false,
        error: `${file.name} : format non accepté (${file.type || "inconnu"}).`,
      };
    }
  }

  try {
    const { workspace } = await guard(scope);
    const supabase = await createClient();

    // Deux URL par fichier — l'original et sa miniature — signées en
    // parallèle : la boucle séquentielle coûtait un aller-retour Supabase par
    // fichier, sensible dès qu'un carrousel part en dix morceaux.
    const uploads: PreparedUpload[] = await Promise.all(
      input.files.map(async (file) => {
        const path = visualPath({
          workspaceId: workspace.id,
          subjectId: input.subjectId,
          fileName: file.name,
        });
        const previewPath = previewPathFor(path);
        const [original, preview] = await Promise.all([
          supabase.storage.from(VISUALS_BUCKET).createSignedUploadUrl(path),
          supabase.storage.from(VISUALS_BUCKET).createSignedUploadUrl(previewPath),
        ]);
        if (original.error) throw new Error(original.error.message);
        if (preview.error) throw new Error(preview.error.message);
        return {
          path,
          url: original.data.signedUrl,
          previewPath,
          previewUrl: preview.data.signedUrl,
        };
      }),
    );

    return { ok: true, uploads };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

/** Accroche à la publication des chemins que le navigateur vient de remplir. */
export async function attachVisuals(
  scope: Scope,
  input: { subjectId: string; paths: string[] },
): Promise<PlanningResult> {
  if (input.paths.length === 0 || input.paths.length > 20) {
    return { ok: false, error: "Aucun fichier." };
  }

  try {
    const { viewer, workspace } = await guard(scope);

    // On n'accroche que des chemins de cette publication, dans cet espace —
    // les URL d'envoi sont signées pour eux, et rien d'autre n'a pu être
    // écrit depuis le navigateur.
    for (const path of input.paths) {
      if (!isOwnedVisualPath(path, workspace.id, input.subjectId)) {
        return { ok: false, error: "Chemin de fichier inattendu." };
      }
    }

    const supabase = await createClient();
    const { data: subject } = await supabase
      .from("planning_subjects")
      .select("visual_urls")
      .eq("id", input.subjectId)
      .maybeSingle();

    const { error } = await supabase
      .from("planning_subjects")
      .update({ visual_urls: [...(subject?.visual_urls ?? []), ...input.paths] })
      .eq("id", input.subjectId);
    if (error) throw new Error(error.message);

    await logActivity({
      supabase,
      subjectId: input.subjectId,
      workspaceId: workspace.id,
      actorId: viewer.user.id,
      field: "visual",
      after: input.paths
        .map((path) =>
          decodeURIComponent((path.split("/").pop() ?? path).replace(/^\d+-/, "")),
        )
        .join(", "),
    });

    revalidate(scope);
    return {
      ok: true,
      message:
        input.paths.length === 1
          ? "Visuel ajouté."
          : `${input.paths.length} visuels ajoutés.`,
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
    // importé depuis Monday est une URL externe, pas un objet à nous. La
    // miniature part avec lui — `remove` ignore un chemin absent.
    if (isOwnedVisualPath(input.path, workspace.id, input.subjectId)) {
      await supabase.storage
        .from(VISUALS_BUCKET)
        .remove([input.path, previewPathFor(input.path)]);
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
