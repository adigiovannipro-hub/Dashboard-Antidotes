import { Archive } from "lucide-react";

import { PublicationRowView } from "@/components/mon-travail/publication-row";
import { TaskRowView } from "@/components/mon-travail/task-row";
import type {
  PublicationRow,
  TaskWorkspace,
  WorkTask,
} from "@/lib/mon-travail/types";

/**
 * « Archivé », en bas de page : ce qui est fait. Les tâches cochées y
 * descendent — et s'y décochent, pour rattraper une coche trop rapide — et
 * les publications du jour déjà parties y attendent, statut modifiable si le
 * réel dit autre chose.
 */
export function ArchiveSection({
  tasks,
  publications,
  workspacesById,
  clientWorkspaces,
}: {
  tasks: WorkTask[];
  publications: PublicationRow[];
  workspacesById: Record<string, TaskWorkspace>;
  clientWorkspaces: TaskWorkspace[];
}) {
  if (tasks.length === 0 && publications.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
        <Archive className="size-3.5" aria-hidden />
        Archivé
      </h2>

      <div className="border-border overflow-hidden rounded-xl border">
        {publications.map((row) => (
          <PublicationRowView key={row.subject.id} row={row} archived />
        ))}
        {tasks.map((task) => (
          <TaskRowView
            key={task.id}
            task={task}
            variant="archived"
            workspace={
              task.workspace_id ? (workspacesById[task.workspace_id] ?? null) : null
            }
            clientWorkspaces={clientWorkspaces}
          />
        ))}
      </div>
    </section>
  );
}
