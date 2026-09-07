/**
 * Modèle du module « Mon travail ».
 *
 * Aligné sur `supabase/migrations/0014_mon_travail_schema.sql`. Alias de type
 * et non `interface` : TypeScript ne donne d'index signature implicite qu'aux
 * premiers, et postgrest-js en a besoin pour inférer les résultats de requête.
 */

import type {
  PlanningPlatform,
  PlanningSubject,
  ResolvedVisual,
} from "@/lib/planning/types";

export type WorkTaskSource = "manual" | "fathom" | "email" | "recurring" | "antidotes";

export const WORK_SOURCE_LABELS: Record<WorkTaskSource, string> = {
  manual: "Manuel",
  fathom: "Fathom",
  email: "Mail",
  recurring: "Récurrent",
  antidotes: "Prospection",
};

export type WorkTaskStatus = "pending" | "done" | "deleted";

export const WORK_STATUS_LABELS: Record<WorkTaskStatus, string> = {
  pending: "À faire",
  done: "Fait",
  deleted: "Supprimée",
};

/** La ligne quotidienne fixe, 7 j/7 — une seule ligne, une seule coche. */
export const DAILY_TASK_TITLE = "Modération, publications, ads";

/**
 * Le cycle de production mensuel par défaut, semé pour chaque client actif.
 *
 * C'est un point de départ, pas une constante d'affichage : le modèle réel vit
 * dans `work_cycles` / `work_cycle_steps` et s'édite en base, par client, sans
 * redéploiement. `week: null` = toutes les semaines.
 */
export const DEFAULT_CYCLE_STEPS: { label: string; week: number | null }[] = [
  { label: "Reporting et analyse", week: 1 },
  { label: "Intentions de publication", week: 2 },
  { label: "Création des publications", week: 3 },
  { label: "Validation et programmation", week: 4 },
  { label: "Monitoring et modération", week: null },
];

// --- Lignes de la base -------------------------------------------------------

export type WorkCycle = {
  id: string;
  org_id: string;
  workspace_id: string;
  active: boolean;
  created_at: string;
};

export type WorkCycleStep = {
  id: string;
  cycle_id: string;
  org_id: string;
  workspace_id: string;
  label: string;
  /** Nulle : l'étape est hebdomadaire et se matérialise chaque semaine. */
  week_of_month: number | null;
  position: number;
  created_at: string;
};

export type WorkTask = {
  id: string;
  org_id: string;
  workspace_id: string | null;
  cycle_step_id: string | null;
  title: string;
  source: WorkTaskSource;
  status: WorkTaskStatus;
  /** Jour métier `YYYY-MM-DD`, sans heure. */
  due_date: string;
  done_at: string | null;
  dedupe_key: string | null;
  source_url: string | null;
  source_label: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * La ligne quotidienne est la seule récurrence sans étape de cycle : c'est ce
 * qui la distingue, sans colonne supplémentaire à maintenir.
 */
export function isDailyTask(
  task: Pick<WorkTask, "source" | "cycle_step_id">,
): boolean {
  return task.source === "recurring" && task.cycle_step_id === null;
}

/** L'espace rattaché à une tâche, tel que l'affichage en a besoin. */
export type TaskWorkspace = {
  id: string;
  slug: string;
  name: string;
  accent_color: string | null;
};

/**
 * Une ligne de planning telle que « À publier » l'affiche : la publication
 * source, intacte, plus ce qu'il faut pour la situer — client, réseau,
 * visuels résolus et tableau d'origine.
 */
export type PublicationRow = {
  subject: PlanningSubject;
  platform: PlanningPlatform;
  lane_name: string;
  visuals: ResolvedVisual[];
  workspace: TaskWorkspace;
  board_slug: string;
  /**
   * Les objectifs publicitaires proposés par le tableau d'origine.
   *
   * Ils vivent dans `planning_boards.settings` et diffèrent d'un client à
   * l'autre : la colonne « Objectif » ne peut pas être une liste partagée.
   */
  objectives: string[];
  /** Le compteur de retours du board, pour l'icône de la ligne. */
  comments_count: number;
  /** En retard : datée avant aujourd'hui et toujours pas partie — en rouge. */
  late?: boolean;
};
