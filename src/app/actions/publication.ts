"use server";

import { z } from "zod";

import { updateSubject, type PlanningResult } from "@/app/actions/planning";
import { getViewer, getWorkspace } from "@/lib/auth";
import { formatDayFr } from "@/lib/format";
import {
  isDueNow,
  isPublishWindow,
  parisStamp,
  PUBLISH_TIME_ZONE_LABEL,
  PUBLISH_TRIGGER_STATUS,
  PUBLISHABLE_NOW_STATUSES,
} from "@/lib/publishing/readiness";
import { requestSubjectPublication } from "@/lib/publishing/trigger";
import { createClient } from "@/lib/supabase/server";

/**
 * Les deux boutons qui apparaissent au survol d'une ligne « Validé » du
 * planning : **Programmer** (elle partira à sa date, 16h00 heure de Bali) et
 * **Publier** (tout de suite, sur tous les réseaux de son couloir).
 *
 * L'agence seule : « Validé » est l'accord du client, armer la publication
 * est le geste de l'agence — les boutons ne sont pas rendus au client, et ces
 * actions le refusent aussi.
 */

type Scope = { workspace: string; board: string };

async function guard(scope: Scope) {
  const viewer = await getViewer();
  if (!viewer) throw new Error("Session expirée.");
  const workspace = await getWorkspace(scope.workspace);
  // Message neutre : ne pas confirmer l'existence d'un espace inaccessible.
  if (!workspace || workspace.role !== "owner") throw new Error("Action indisponible.");
  return { viewer, workspace };
}

type SubjectState = {
  status: string;
  scheduled_on: string | null;
  format: string;
  deleted_at: string | null;
  archived_at: string | null;
};

async function readSubject(subjectId: string, workspaceId: string): Promise<SubjectState> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planning_subjects")
    .select("status, scheduled_on, format, deleted_at, archived_at")
    .eq("id", subjectId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as unknown as SubjectState | null;
  if (!row || row.deleted_at || row.archived_at) throw new Error("Publication introuvable.");
  return row;
}

/**
 * Programmer : la ligne passe « Programmé » et partira à sa date. Une date
 * passée ou absente est refusée par `updateSubject`, en rouge, avec la sortie
 * — changer la date ou publier maintenant.
 */
export async function scheduleSubject(scope: Scope, subjectId: string): Promise<PlanningResult> {
  if (!z.uuid().safeParse(subjectId).success) return { ok: false, error: "Publication introuvable." };
  try {
    const { workspace } = await guard(scope);
    const result = await updateSubject(scope, {
      subjectId,
      field: "status",
      value: PUBLISH_TRIGGER_STATUS,
    });
    if (!result.ok) return result;

    const row = await readSubject(subjectId, workspace.id);
    const now = new Date();
    if (isDueNow(row, now)) return { ok: true, message: "Programmée : publication lancée." };
    const day =
      row.scheduled_on === parisStamp(now).date && !isPublishWindow(now)
        ? "aujourd'hui"
        : `le ${formatDayFr(row.scheduled_on)}`;
    return { ok: true, message: `Programmée : part ${day} à 16h00, ${PUBLISH_TIME_ZONE_LABEL}.` };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

/**
 * Publier : tout de suite, sur tous les réseaux du couloir, quelle que soit
 * la date de la ligne. La publication tourne dans la route de publication —
 * un reel dépasse la minute d'une action serveur — et la ligne passe
 * « Publié » quand les réseaux ont confirmé.
 */
export async function publishSubjectNow(scope: Scope, subjectId: string): Promise<PlanningResult> {
  if (!z.uuid().safeParse(subjectId).success) return { ok: false, error: "Publication introuvable." };
  try {
    const { workspace } = await guard(scope);
    const row = await readSubject(subjectId, workspace.id);
    if (!PUBLISHABLE_NOW_STATUSES.includes(row.status)) {
      return { ok: false, error: "Seule une publication « Validé » ou « Programmé » se publie." };
    }
    if (row.format === "story") {
      return { ok: false, error: "Une story se publie à la main : l'API ne pose pas ses widgets." };
    }

    await requestSubjectPublication({ subjectId, workspaceId: workspace.id });
    return {
      ok: true,
      message: "Publication lancée : la ligne passe « Publié » dès que les réseaux ont confirmé.",
    };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
