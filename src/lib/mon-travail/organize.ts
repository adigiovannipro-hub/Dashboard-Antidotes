/**
 * Mise en ordre des tâches pour la page d'accueil : les retards en tête,
 * aujourd'hui, puis les quatre jours suivants groupés par jour.
 *
 * Fonction pure : la page lit la base, ce module range. L'échéance étant un
 * jour sans heure, le tri « par échéance » à l'intérieur d'un jour retombe
 * sur un ordre stable — la ligne quotidienne d'abord, puis l'ordre de
 * création.
 */

import { addDays } from "./dates";
import { isOverdue } from "./recurrence";
import { isDailyTask, type WorkTask } from "./types";

export type DayGroup = { day: string; tasks: WorkTask[] };

export type OrganizedTasks = {
  /** Non faites avant aujourd'hui — en tête d'« Aujourd'hui », en rouge. */
  overdue: WorkTask[];
  today: WorkTask[];
  /** Les jours suivants qui ont au moins une tâche, dans l'ordre. */
  upcoming: DayGroup[];
};

/** « À venir » couvre les quatre jours qui suivent aujourd'hui. */
export const UPCOMING_DAYS = 4;

function byDay(tasks: WorkTask[]): Map<string, WorkTask[]> {
  const grouped = new Map<string, WorkTask[]>();
  for (const task of tasks) {
    const bucket = grouped.get(task.due_date);
    if (bucket) bucket.push(task);
    else grouped.set(task.due_date, [task]);
  }
  return grouped;
}

function inDayOrder(a: WorkTask, b: WorkTask): number {
  if (isDailyTask(a) !== isDailyTask(b)) return isDailyTask(a) ? -1 : 1;
  return a.created_at.localeCompare(b.created_at);
}

export function organizeTasks(tasks: WorkTask[], today: string): OrganizedTasks {
  const pending = tasks.filter((task) => task.status === "pending");

  const overdue = pending
    .filter((task) => isOverdue(task, today))
    .sort((a, b) => {
      // Le retard le plus ancien d'abord : c'est lui qui crie le plus fort.
      if (a.due_date !== b.due_date) return a.due_date.localeCompare(b.due_date);
      return inDayOrder(a, b);
    });

  const grouped = byDay(pending);
  const todayTasks = (grouped.get(today) ?? []).sort(inDayOrder);

  const upcoming: DayGroup[] = [];
  for (let offset = 1; offset <= UPCOMING_DAYS; offset += 1) {
    const day = addDays(today, offset);
    const dayTasks = grouped.get(day);
    if (dayTasks && dayTasks.length > 0) {
      upcoming.push({ day, tasks: [...dayTasks].sort(inDayOrder) });
    }
  }

  return { overdue, today: todayTasks, upcoming };
}
