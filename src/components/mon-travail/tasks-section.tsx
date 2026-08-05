import { ListChecks } from "lucide-react";

import { QuickAdd } from "@/components/mon-travail/quick-add";
import { TaskRowView } from "@/components/mon-travail/task-row";
import { dayLabel, upcomingDayLabel } from "@/lib/mon-travail/dates";
import type { OrganizedTasks } from "@/lib/mon-travail/organize";
import type { TaskWorkspace, WorkTask } from "@/lib/mon-travail/types";

/**
 * « Mon travail » : aujourd'hui — les retards en tête, en rouge — puis les
 * quatre jours suivants groupés par jour. Une tâche non faite ne glisse
 * jamais au lendemain : elle reste à sa date et remonte ici comme retard.
 */
export function TasksSection({
  groups,
  today,
  workspacesById,
  clientWorkspaces,
}: {
  groups: OrganizedTasks;
  today: string;
  workspacesById: Record<string, TaskWorkspace>;
  clientWorkspaces: TaskWorkspace[];
}) {
  const todayEmpty = groups.overdue.length === 0 && groups.today.length === 0;

  return (
    <section className="space-y-3">
      <h2 className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
        <ListChecks className="size-3.5" aria-hidden />
        Mon travail
      </h2>

      <QuickAdd clientWorkspaces={clientWorkspaces} today={today} />

      <div className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">
            Aujourd&apos;hui
            <span className="text-muted-foreground ml-2 text-xs font-normal">
              {dayLabel(today)}
            </span>
          </h3>

          {todayEmpty ? (
            <p className="border-border text-muted-foreground rounded-xl border border-dashed p-5 text-sm">
              Rien pour aujourd&apos;hui.
            </p>
          ) : (
            <div className="border-border overflow-hidden rounded-xl border">
              {groups.overdue.map((task) => (
                <Row
                  key={task.id}
                  task={task}
                  variant="overdue"
                  workspacesById={workspacesById}
                  clientWorkspaces={clientWorkspaces}
                />
              ))}
              {groups.today.map((task) => (
                <Row
                  key={task.id}
                  task={task}
                  variant="normal"
                  workspacesById={workspacesById}
                  clientWorkspaces={clientWorkspaces}
                />
              ))}
            </div>
          )}
        </div>

        {groups.upcoming.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">À venir</h3>
            {groups.upcoming.map((group) => (
              <div key={group.day} className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium">
                  {upcomingDayLabel(group.day, today)}
                </p>
                <div className="border-border overflow-hidden rounded-xl border">
                  {group.tasks.map((task) => (
                    <Row
                      key={task.id}
                      task={task}
                      variant="normal"
                      workspacesById={workspacesById}
                      clientWorkspaces={clientWorkspaces}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Row({
  task,
  variant,
  workspacesById,
  clientWorkspaces,
}: {
  task: WorkTask;
  variant: "normal" | "overdue";
  workspacesById: Record<string, TaskWorkspace>;
  clientWorkspaces: TaskWorkspace[];
}) {
  return (
    <TaskRowView
      task={task}
      variant={variant}
      workspace={task.workspace_id ? (workspacesById[task.workspace_id] ?? null) : null}
      clientWorkspaces={clientWorkspaces}
    />
  );
}
