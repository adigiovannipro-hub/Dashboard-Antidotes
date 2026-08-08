import {
  PublicationHeader,
  PublicationRowView,
} from "@/components/mon-travail/publication-row";
import { TaskHeader, TaskRowView } from "@/components/mon-travail/task-row";
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
 *
 * Les lignes se révèlent en opacité à mesure qu'on descend (`reveal-on-scroll`,
 * voir `globals.css`). Le panneau, lui, est à pleine opacité : le voile de 25 %
 * qu'il portait auparavant s'appliquait aussi au texte déjà gris et le faisait
 * passer sous le seuil de contraste.
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
    /* `overflow-clip` et non `overflow-hidden` : les deux découpent les angles
       arrondis, mais `hidden` fait du panneau un conteneur de défilement, et
       l'apparition ci-dessous se calerait alors sur lui — où chaque ligne est
       toujours entièrement visible. `clip` n'en fait pas un. */
    <Panel className="overflow-clip">
      <PanelHeader
        title="Archivé"
        count={total}
        description="Terminé aujourd'hui et les jours précédents."
      />
      {publications.length > 0 ? (
        /* Le bloc entier plutôt que ligne à ligne : le défilement horizontal
           du tableau est, lui, un vrai conteneur de défilement. */
        <div className="reveal-on-scroll">
          <div className="overflow-x-auto">
            <PublicationHeader />
            <PanelRows>
              {publications.map((row) => (
                <PublicationRowView key={row.subject.id} row={row} />
              ))}
            </PanelRows>
          </div>
        </div>
      ) : null}

      {tasks.length > 0 ? (
        <>
          <TaskHeader />
          <PanelRows>
            {tasks.map((task) => (
              <div key={task.id} className="reveal-on-scroll">
                <TaskRowView
                  task={task}
                  variant="archived"
                  workspace={
                    task.workspace_id
                      ? (workspacesById[task.workspace_id] ?? null)
                      : null
                  }
                  clientWorkspaces={clientWorkspaces}
                />
              </div>
            ))}
          </PanelRows>
        </>
      ) : null}
    </Panel>
  );
}
