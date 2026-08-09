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
 * Le bloc **se plafonne à quatre lignes** et défile au-delà. Sans plafond, une
 * semaine de travail fait pousser la page vers le bas au fil des jours : ce qui
 * est fait finissait par occuper plus de place que ce qui reste à faire.
 *
 * Il se révèle en opacité à mesure qu'on descend (`reveal-on-scroll`, voir
 * `globals.css`). L'enveloppe qui porte l'animation est **hors** du conteneur
 * de défilement : `view()` se cale sur le premier ancêtre qui défile, et
 * l'intérieur d'une boîte de 4 lignes n'est pas la bonne référence.
 */

/**
 * Quatre lignes visibles, et un liseré de la cinquième.
 *
 * Mesuré au navigateur plutôt que déduit : une ligne de tâche fait 36 px et un
 * en-tête de colonnes 26 — soit 170 px pour quatre lignes titrées. Les six
 * pixels restants laissent dépasser le haut de la suivante, ce qui est la
 * seule chose qui dise qu'il y en a une.
 */
const FOUR_ROWS = "max-h-44";

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
       l'apparition se calerait alors sur lui — où chaque ligne est toujours
       entièrement visible. `clip` n'en fait pas un. */
    <Panel className="overflow-clip">
      <PanelHeader
        title="Archivé"
        count={total}
        description={
          total > 4
            ? "Terminé aujourd'hui et les jours précédents — faites défiler pour la suite."
            : "Terminé aujourd'hui et les jours précédents."
        }
      />

      <div className="reveal-on-scroll">
        <div className={`${FOUR_ROWS} overflow-y-auto`}>
          {publications.length > 0 ? (
            <div className="overflow-x-auto">
              <PublicationHeader />
              <PanelRows>
                {publications.map((row) => (
                  <PublicationRowView key={row.subject.id} row={row} />
                ))}
              </PanelRows>
            </div>
          ) : null}

          {tasks.length > 0 ? (
            <>
              <TaskHeader />
              <PanelRows>
                {tasks.map((task) => (
                  <TaskRowView
                    key={task.id}
                    task={task}
                    variant="archived"
                    workspace={
                      task.workspace_id
                        ? (workspacesById[task.workspace_id] ?? null)
                        : null
                    }
                    clientWorkspaces={clientWorkspaces}
                  />
                ))}
              </PanelRows>
            </>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
