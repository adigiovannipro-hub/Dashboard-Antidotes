import { CheckCircle2 } from "lucide-react";

import { AddTask } from "@/components/mon-travail/add-task";
import { TaskHeader, TaskRowView } from "@/components/mon-travail/task-row";
import { Panel, PanelHeader, PanelRows } from "@/components/ds/surface";
import { StatusPill } from "@/components/ds/status-pill";
import { dayLabel, upcomingDayLabel } from "@/lib/mon-travail/dates";
import type { OrganizedTasks } from "@/lib/mon-travail/organize";
import type { TaskWorkspace, WorkTask } from "@/lib/mon-travail/types";

/**
 * « Mon travail » : aujourd'hui — les retards en tête, en rouge — puis les
 * quatre jours suivants groupés par jour. Une tâche non faite ne glisse
 * jamais au lendemain : elle reste à sa date et remonte ici comme retard.
 *
 * Le champ d'ajout est replié dans l'en-tête : posé en travers de la liste,
 * il coupait la lecture pour servir un geste cent fois plus rare.
 */
export function TasksSection({
  groups,
  today,
  workspacesById,
  clientWorkspaces,
  defaultWorkspaceId,
}: {
  groups: OrganizedTasks;
  today: string;
  workspacesById: Record<string, TaskWorkspace>;
  clientWorkspaces: TaskWorkspace[];
  /** Client filtré, préchoisi à l'ajout. */
  defaultWorkspaceId?: string | null;
}) {
  const todayCount = groups.overdue.length + groups.today.length;

  return (
    <Panel className="relative">
      <PanelHeader
        title="Mon travail"
        count={todayCount}
        description={dayLabel(today)}
        action={
          <div className="flex items-center gap-2">
            {groups.overdue.length > 0 ? (
              <StatusPill tone="danger">
                {groups.overdue.length} en retard
              </StatusPill>
            ) : null}
            <AddTask
              clientWorkspaces={clientWorkspaces}
              today={today}
              defaultWorkspaceId={defaultWorkspaceId}
            />
          </div>
        }
      />

      {todayCount === 0 ? (
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <CheckCircle2
            aria-hidden
            strokeWidth={1.75}
            className="size-5 shrink-0 text-text-tertiary"
          />
          <p className="type-body min-w-0 flex-1 text-text-secondary">
            Rien pour aujourd&apos;hui.
            {groups.upcoming.length > 0
              ? " Les jours suivants sont ci-dessous."
              : " Ajoutez une tâche depuis l'en-tête."}
          </p>
        </div>
      ) : (
        <>
          <TaskHeader />
          <PanelRows>
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
          </PanelRows>
        </>
      )}

      {groups.upcoming.map((group) => (
        <div key={group.day}>
          <p className="type-overline border-y border-border bg-surface-sunken px-5 py-2 text-text-secondary">
            {upcomingDayLabel(group.day, today)}
          </p>
          <PanelRows>
            {group.tasks.map((task) => (
              <Row
                key={task.id}
                task={task}
                variant="normal"
                workspacesById={workspacesById}
                clientWorkspaces={clientWorkspaces}
              />
            ))}
          </PanelRows>
        </div>
      ))}
    </Panel>
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
