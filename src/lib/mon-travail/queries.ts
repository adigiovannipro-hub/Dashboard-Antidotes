import "server-only";

import { resolveVisuals } from "@/lib/planning/queries";
import { DONE_STATUSES, EXCLUDED_STATUSES } from "@/lib/planning/types";
import type {
  PlanningBoard,
  PlanningLane,
  PlanningSubject,
} from "@/lib/planning/types";
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
      supabase.from("planning_boards").select("id, slug, settings").in("id", boardIds),
      supabase
        .from("workspaces")
        .select("id, slug, name, accent_color")
        .in("id", workspaceIds),
      resolveVisuals(subjects),
    ]);

  const laneById = new Map(
    ((lanes ?? []) as unknown as PlanningLane[]).map((lane) => [lane.id, lane]),
  );
  const boardById = new Map(
    ((boards ?? []) as unknown as PlanningBoard[]).map((board) => [board.id, board]),
  );
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
    const board = boardById.get(subject.board_id);
    if (!lane || !workspace || !board) continue;

    rows.push({
      subject,
      platform: lane.platform,
      lane_name: lane.name,
      visuals: visualsById.get(subject.id) ?? [],
      workspace,
      board_slug: board.slug,
      objectives: board.settings.ad_objectives,
    });
  }

  return rows;
}

/**
 * Ce qu'il reste à publier : le jour même **et les jours d'avant**.
 *
 * Une publication datée d'hier et jamais partie ne disparaît pas de l'écran
 * parce que la date a tourné — c'est même la seule qui presse. C'est aussi ce
 * que compte la pastille du rail : un compteur qui annonce des lignes que la
 * page n'affiche pas envoie chercher quelque chose d'introuvable.
 */
export async function listPublicationsToDo(options: {
  /** Date du jour, incluse. Tout ce qui est antérieur est un retard. */
  until: string;
  /** Restreint à un espace client — le filtre de la page d'accueil. */
  workspaceId?: string | null;
  limit?: number;
}): Promise<PublicationRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("planning_subjects")
    .select("*")
    .lte("scheduled_on", options.until)
    // Un contenu non retenu n'a jamais existé pour le lecteur ; un contenu
    // parti n'a plus rien à faire dans une liste de choses à faire. Le filtre
    // est en base et non en mémoire : trié du plus ancien au plus récent, une
    // limite de cent lignes sur un board d'un an couperait le jour même.
    .not("status", "in", `(${[...EXCLUDED_STATUSES, ...DONE_STATUSES].join(",")})`);

  if (options.workspaceId) query = query.eq("workspace_id", options.workspaceId);

  const { data } = await query.order("scheduled_on").limit(options.limit ?? 100);

  return byNetwork(await decorate((data ?? []) as unknown as PlanningSubject[]));
}

/** Les publications parties dans la journée — la section « Archivé ». */
export async function listPublishedOn(options: {
  day: string;
  workspaceId?: string | null;
  limit?: number;
}): Promise<PublicationRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("planning_subjects")
    .select("*")
    .eq("scheduled_on", options.day)
    .in("status", DONE_STATUSES);

  if (options.workspaceId) query = query.eq("workspace_id", options.workspaceId);

  const { data } = await query.limit(options.limit ?? 50);

  return byNetwork(await decorate((data ?? []) as unknown as PlanningSubject[]));
}

/**
 * Tri par date, puis par réseau, puis par client, puis par sujet.
 *
 * La date d'abord parce que le retard passe devant : ce qui aurait dû partir
 * hier se traite avant ce qui doit partir ce soir. À date égale, on publie
 * réseau par réseau — on ouvre Instagram, on vérifie tout ce qui devait y
 * partir, on passe à LinkedIn. Trier par client obligeait à revenir trois fois
 * sur le même onglet.
 */
function byNetwork(rows: PublicationRow[]): PublicationRow[] {
  return [...rows].sort((a, b) => {
    const dateA = a.subject.scheduled_on ?? "";
    const dateB = b.subject.scheduled_on ?? "";
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    if (a.lane_name !== b.lane_name) {
      return a.lane_name.localeCompare(b.lane_name, "fr");
    }
    if (a.workspace.name !== b.workspace.name) {
      return a.workspace.name.localeCompare(b.workspace.name, "fr");
    }
    return a.subject.name.localeCompare(b.subject.name, "fr");
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
  workspaceId?: string | null;
  limit?: number;
}): Promise<PublicationRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("planning_subjects")
    .select("*")
    .gt("scheduled_on", options.after)
    .neq("status", "dropped")
    .neq("status", "published");

  if (options.workspaceId) query = query.eq("workspace_id", options.workspaceId);

  const { data } = await query.order("scheduled_on").limit(options.limit ?? 3);

  // La date prime ici — c'est « et ensuite ? » — puis le réseau départage.
  const rows = await decorate((data ?? []) as unknown as PlanningSubject[]);
  return rows.sort((a, b) => {
    const dateA = a.subject.scheduled_on ?? "";
    const dateB = b.subject.scheduled_on ?? "";
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return a.lane_name.localeCompare(b.lane_name, "fr");
  });
}

/**
 * Les tâches encore ouvertes jusqu'à l'horizon donné — retards compris,
 * puisqu'une tâche en attente d'avant aujourd'hui est passée sous `until`.
 */
export async function listOpenTasks(options: {
  until: string;
  workspaceId?: string | null;
  limit?: number;
}): Promise<WorkTask[]> {
  const supabase = await createClient();

  let query = supabase
    .from("work_tasks")
    .select("*")
    .eq("status", "pending")
    .lte("due_date", options.until);

  if (options.workspaceId) query = query.eq("workspace_id", options.workspaceId);

  const { data } = await query
    .order("due_date")
    .order("created_at")
    .limit(options.limit ?? 200);

  return (data ?? []) as unknown as WorkTask[];
}

/** Les dernières tâches faites, pour la section « Archivé » en bas de page. */
export async function listArchivedTasks(options: {
  workspaceId?: string | null;
  limit?: number;
}): Promise<WorkTask[]> {
  const supabase = await createClient();

  let query = supabase.from("work_tasks").select("*").eq("status", "done");

  if (options.workspaceId) query = query.eq("workspace_id", options.workspaceId);

  const { data } = await query
    .order("done_at", { ascending: false })
    .limit(options.limit ?? 40);

  return (data ?? []) as unknown as WorkTask[];
}
