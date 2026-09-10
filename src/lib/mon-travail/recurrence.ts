/**
 * Génération des tâches récurrentes : le cycle mensuel de chaque client.
 *
 * La ligne quotidienne fixe se planifiait ici aussi ; elle n'existe plus, seul
 * le cycle par client est encore semé. Toute récurrence porte donc désormais
 * une étape de cycle, et c'est cette absence qui fait reconnaître les
 * anciennes lignes quotidiennes (`isDailyTask`) pour les masquer à la lecture.
 *
 * Fonctions pures, zéro import Supabase : le cron et le seed matérialisent ce
 * que ces fonctions planifient, et les tests les exercent sans base. La clé
 * d'idempotence (`dedupe_key`) fait tout le travail de dédoublonnage — deux
 * passages du cron produisent le même plan, et l'index unique de `work_tasks`
 * ignore ce qui existe déjà, y compris une occurrence cochée ou supprimée.
 */

import { lastDayOfMonth } from "./dates";
import type { WorkCycleStep, WorkTask } from "./types";

/** Une tâche planifiée, prête à être insérée dans `work_tasks`. */
export type PlannedTask = {
  org_id: string;
  workspace_id: string | null;
  cycle_step_id: string | null;
  title: string;
  source: "recurring";
  due_date: string;
  dedupe_key: string;
};

/**
 * Échéance de la semaine N d'un mois : le jour `7 × N`, borné au dernier jour
 * du mois. La semaine 1 se termine le 7, la semaine 4 le 28 — et la semaine 5
 * d'un mois qui n'en a pas se replie sur le dernier jour. Règle simple et
 * prévisible plutôt que des semaines ISO : le cycle parle en « semaine 1 du
 * mois », pas en numéros de semaine calendaire.
 */
export function dueDateForWeek(monthKey: string, week: number): string {
  const day = Math.min(week * 7, lastDayOfMonth(monthKey));
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}

/** Une étape hebdomadaire se matérialise sur ces semaines du mois. */
export const WEEKLY_WEEKS = [1, 2, 3, 4];

export type CycleForPlanning = {
  workspace_id: string;
  steps: Pick<WorkCycleStep, "id" | "label" | "week_of_month">[];
};

/**
 * Le plan d'un mois : une occurrence par étape datée, quatre par étape
 * hebdomadaire. Les cycles inactifs ne doivent pas être passés ici — c'est le
 * lecteur qui filtre, la planification ne connaît pas l'activation.
 */
export function planCycleTasks(options: {
  orgId: string;
  monthKey: string;
  cycles: CycleForPlanning[];
}): PlannedTask[] {
  const planned: PlannedTask[] = [];

  for (const cycle of options.cycles) {
    for (const step of cycle.steps) {
      if (step.week_of_month === null) {
        for (const week of WEEKLY_WEEKS) {
          planned.push({
            org_id: options.orgId,
            workspace_id: cycle.workspace_id,
            cycle_step_id: step.id,
            title: step.label,
            source: "recurring",
            due_date: dueDateForWeek(options.monthKey, week),
            dedupe_key: `cycle:${step.id}:${options.monthKey}:w${week}`,
          });
        }
      } else {
        planned.push({
          org_id: options.orgId,
          workspace_id: cycle.workspace_id,
          cycle_step_id: step.id,
          title: step.label,
          source: "recurring",
          due_date: dueDateForWeek(options.monthKey, step.week_of_month),
          dedupe_key: `cycle:${step.id}:${options.monthKey}`,
        });
      }
    }
  }

  return planned;
}

/**
 * Une tâche non faite à la fin du jour J reste à sa date et devient un
 * retard : elle ne glisse jamais silencieusement au lendemain.
 */
export function isOverdue(
  task: Pick<WorkTask, "status" | "due_date">,
  today: string,
): boolean {
  return task.status === "pending" && task.due_date < today;
}
