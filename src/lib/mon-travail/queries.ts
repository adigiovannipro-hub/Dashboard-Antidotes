import "server-only";

import { resolveVisuals } from "@/lib/planning/queries";
import type { PlanningLane, PlanningSubject } from "@/lib/planning/types";
import { createClient } from "@/lib/supabase/server";
import type { PublicationRow, TaskWorkspace, WorkTask } from "./types";

/**
 * Lectures de « Mon travail ».
 *
 * La section « À publier » ne duplique rien : elle lit les lignes des
 * plannings éditoriaux, telles quelles, à travers la RLS. Un client connecté
 * n'a de toute façon jamais cette page — mais si ces requêtes tournaient sous
 * sa session, il ne verrait que son propre espace, par construction.
 */

/**
 * Habille des publications brutes de ce que l'affichage réclame : réseau,
 * client, visuels signés, tableau d'origine.
 *
 * Partagé par les deux lectures de publications — celles du jour et celles
 * qui suivent — pour qu'un même sujet s'affiche à l'identique où qu'il
 * apparaisse.
 */
async function decorate(subjects: PlanningSubject[]): Promise<PublicationRow[]> {
  if (subjects.length === 0) return [];

  const supabase = await createClient();
  const laneIds = [...new Set(subjects.map((subject) => subject.lane_id))];
  const boardIds = [...new Set(subjects.map((subject) => subject.board_id))];
  const workspaceIds = [...new Set(subjects.map((subject) => subject.workspace_id))];

  const [{ data: lanes }, { data: boards }, { data: workspaces }, visualsById] =
    await Promise.all([
      supabase.from("planning_lanes").select("*").in("id", laneIds),
      supabase.from("planning_boards").select("id, slug").in("id", boardIds),
      supabase
        .from("workspaces")
        .select("id, slug, name, accent_color")
        .in("id", workspaceIds),
      resolveVisuals(subjects),
    ]);

  const laneById = new Map(
    ((lanes ?? []) as unknown as PlanningLane[]).map((lane) => [lane.id, lane]),
  );
  const boardSlugById = new Map((boards ?? []).map((board) => [board.id, board.slug]));
  const workspaceById = new Map(
    ((workspaces ?? []) as unknown as TaskWorkspace[]).map((workspace) => [
      workspace.id,
      workspace,
    ]),
  );

  const rows: PublicationRow[] = [];
  for (const subject of subjects) {
    const lane = laneById.get(subject.lane_id);
    const workspace = workspaceById.get(subject.workspace_id);
    const boardSlug = boardSlugById.get(subject.board_id);
    if (!lane || !workspace || !boardSlug) continue;

    rows.push({
      subject,
      platform: lane.platform,
      lane_name: lane.name,
      visuals: visualsById.get(subject.id) ?? [],
      workspace,
      board_slug: boardSlug,
    });
  }

  return rows;
}

export async function listDayPublications(options: {
  day: string;
  limit?: number;
}): Promise<PublicationRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("planning_subjects")
    .select("*")
    .eq("scheduled_on", options.day)
    // Un contenu non retenu n'a jamais existé pour le lecteur.
    .neq("status", "dropped")
    .order("created_at")
    .limit(options.limit ?? 100);

  const rows = await decorate((data ?? []) as unknown as PlanningSubject[]);

  // Une lecture par client, puis par réseau : l'ordre dans lequel on vérifie.
  return rows.sort((a, b) => {
    if (a.workspace.name !== b.workspace.name) {
      return a.workspace.name.localeCompare(b.workspace.name, "fr");
    }
    return a.platform.localeCompare(b.platform);
  });
}

/**
 * Les prochaines publications après un jour donné.
 *
 * Sert le repli de la section « À publier » : quand la journée est vide, une
 * page qui affiche « rien à publier aujourd'hui » et s'arrête là occupe sa
 * meilleure zone pour ne rien dire. Montrer ce qui vient ensuite répond à la
 * question suivante avant qu'elle soit posée.
 */
export async function listNextPublications(options: {
  after: string;
  limit?: number;
}): Promise<PublicationRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("planning_subjects")
    .select("*")
    .gt("scheduled_on", options.after)
    .neq("status", "dropped")
    .neq("status", "published")
    .order("scheduled_on")
    .limit(options.limit ?? 3);

  return decorate((data ?? []) as unknown as PlanningSubject[]);
}

/**
 * Les tâches encore ouvertes jusqu'à l'horizon donné — retards compris,
 * puisqu'une tâche en attente d'avant aujourd'hui est passée sous `until`.
 */
export async function listOpenTasks(options: {
  until: string;
  limit?: number;
}): Promise<WorkTask[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("work_tasks")
    .select("*")
    .eq("status", "pending")
    .lte("due_date", options.until)
    .order("due_date")
    .order("created_at")
    .limit(options.limit ?? 200);

  return (data ?? []) as unknown as WorkTask[];
}

/** Les dernières tâches faites, pour la section « Archivé » en bas de page. */
export async function listArchivedTasks(options: {
  limit?: number;
}): Promise<WorkTask[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("work_tasks")
    .select("*")
    .eq("status", "done")
    .order("done_at", { ascending: false })
    .limit(options.limit ?? 40);

  return (data ?? []) as unknown as WorkTask[];
}
