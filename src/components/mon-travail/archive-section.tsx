import { PublicationRowView } from "@/components/mon-travail/publication-row";
import { TaskRowView } from "@/components/mon-travail/task-row";
import { Panel, PanelHeader, PanelRows } from "@/components/ds/surface";
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
  const total = tasks.length + publications.length;
  if (total === 0) return null;

  return (
    <Panel className="opacity-75 transition-opacity duration-(--motion-duration) ease-standard hover:opacity-100">
      <PanelHeader
        title="Archivé"
        count={total}
        description="Terminé aujourd'hui et les jours précédents."
      />
      <PanelRows>
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
      </PanelRows>
    </Panel>
  );
}
