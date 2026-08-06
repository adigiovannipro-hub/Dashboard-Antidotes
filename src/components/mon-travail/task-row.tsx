"use client";

import { Check, ExternalLink, Trash2, Users } from "lucide-react";

import {
  deleteTask,
  toggleTask,
  updateTask,
} from "@/app/actions/mon-travail";
import { TextCell, useCellAction } from "@/components/planning/cells";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { shortDate } from "@/lib/mon-travail/dates";
import {
  WORK_SOURCE_LABELS,
  type TaskWorkspace,
  type WorkTask,
} from "@/lib/mon-travail/types";
import { cn } from "@/lib/utils";

/**
 * Une tâche : coche ronde, libellé, client, source, échéance.
 *
 * Tout s'édite en place — y compris les tâches générées, rien n'est
 * verrouillé. La coche archive ; l'archive garde la coche, pour ressusciter
 * une tâche fermée trop vite.
 */
export function TaskRowView({
  task,
  workspace,
  clientWorkspaces,
  variant = "normal",
}: {
  task: WorkTask;
  workspace: TaskWorkspace | null;
  clientWorkspaces: TaskWorkspace[];
  variant?: "normal" | "overdue" | "archived";
}) {
  const { run, pending } = useCellAction();
  const archived = variant === "archived";
  const overdue = variant === "overdue";

  return (
    <div
      className={cn(
        "group/row border-border/60 flex items-center gap-2.5 border-b px-2 py-2 transition-colors md:py-1.5",
        "hover:bg-muted/40",
        pending && "opacity-60",
      )}
    >
      <button
        type="button"
        aria-label={archived ? `Rouvrir « ${task.title} »` : `Marquer « ${task.title} » comme faite`}
        aria-pressed={archived}
        onClick={() => run(() => toggleTask({ taskId: task.id, done: !archived }))}
        className={cn(
          "focus-visible:ring-brand flex size-5 shrink-0 items-center justify-center rounded-full border-2 outline-none focus-visible:ring-2",
          // Encre et non vert de marque : le blanc de la coche ne tient pas
          // le contraste sur `--accent`.
          archived
            ? "border-accent-ink bg-accent-ink text-white"
            : overdue
              ? "border-danger hover:bg-danger-subtle"
              : "border-border-strong hover:border-text-secondary",
        )}
      >
        {archived ? <Check className="size-3" aria-hidden /> : null}
      </button>

      <div className="min-w-0 flex-1">
        {archived ? (
          <p className="text-muted-foreground truncate text-sm line-through">
            {task.title}
          </p>
        ) : (
          <TextCell
            value={task.title}
            ariaLabel="Libellé de la tâche"
            className={cn("-mx-1.5", overdue && "text-brand-red")}
            onCommit={(next) =>
              run(() => updateTask({ taskId: task.id, field: "title", value: next }))
            }
          />
        )}

        <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 px-0 text-[11px]">
          {overdue ? (
            <span className="text-brand-red font-semibold tracking-wide uppercase">
              En retard — {shortDate(task.due_date)}
            </span>
          ) : null}

          <WorkspaceSelect
            task={task}
            workspace={workspace}
            clientWorkspaces={clientWorkspaces}
            disabled={archived}
            onSelect={(workspaceId) =>
              run(() =>
                updateTask({ taskId: task.id, field: "workspace_id", value: workspaceId }),
              )
            }
          />

          <SourceBadge task={task} />

          {!archived ? (
            <input
              type="date"
              value={task.due_date}
              aria-label="Échéance de la tâche"
              onChange={(event) => {
                if (!event.target.value) return;
                run(() =>
                  updateTask({
                    taskId: task.id,
                    field: "due_date",
                    value: event.target.value,
                  }),
                );
              }}
              className={cn(
                "focus-visible:ring-brand w-[6.6rem] rounded-sm bg-transparent tabular-nums outline-none focus-visible:ring-2",
                overdue && "text-brand-red",
              )}
            />
          ) : null}
        </div>
      </div>

      <button
        type="button"
        aria-label={`Supprimer « ${task.title} »`}
        onClick={() => run(() => deleteTask({ taskId: task.id }))}
        className="text-muted-foreground hover:text-brand-red focus-visible:ring-ring rounded p-1 opacity-40 transition group-hover/row:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:outline-none md:opacity-0"
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

/** Le rattachement client — modifiable après coup, comme le reste. */
function WorkspaceSelect({
  task,
  workspace,
  clientWorkspaces,
  disabled,
  onSelect,
}: {
  task: WorkTask;
  workspace: TaskWorkspace | null;
  clientWorkspaces: TaskWorkspace[];
  disabled: boolean;
  onSelect: (workspaceId: string | null) => void;
}) {
  if (disabled) {
    return workspace ? <WorkspaceDot workspace={workspace} /> : null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Client rattaché à « ${task.title} »`}
        className="focus-visible:ring-brand hover:text-foreground flex items-center gap-1 rounded-sm outline-none focus-visible:ring-2"
      >
        {workspace ? (
          <WorkspaceDot workspace={workspace} />
        ) : (
          <Users className="size-3 opacity-50" aria-hidden />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48 min-w-48">
        {clientWorkspaces.map((candidate) => (
          <DropdownMenuItem key={candidate.id} onClick={() => onSelect(candidate.id)}>
            <WorkspaceDot workspace={candidate} />
            {candidate.id === workspace?.id ? (
              <Check className="ml-auto size-3.5" aria-hidden />
            ) : null}
          </DropdownMenuItem>
        ))}
        {workspace ? (
          <DropdownMenuItem onClick={() => onSelect(null)}>Détacher</DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WorkspaceDot({ workspace }: { workspace: TaskWorkspace }) {
  return (
    <span className="flex items-center gap-1">
      <span
        aria-hidden
        className="bg-muted size-2 shrink-0 rounded-full"
        style={
          workspace.accent_color
            ? { backgroundColor: workspace.accent_color }
            : undefined
        }
      />
      {workspace.name}
    </span>
  );
}

/** D'où vient la tâche — et le lien vers sa source quand il existe. */
function SourceBadge({ task }: { task: WorkTask }) {
  if (task.source === "manual") return null;

  const label = WORK_SOURCE_LABELS[task.source];

  if (task.source_url) {
    return (
      <a
        href={task.source_url}
        target="_blank"
        rel="noreferrer"
        title={task.source_label ?? label}
        className="border-border hover:text-foreground focus-visible:ring-brand flex items-center gap-1 rounded-full border px-1.5 py-px outline-none focus-visible:ring-2"
      >
        {label}
        <ExternalLink className="size-2.5" aria-hidden />
      </a>
    );
  }

  return (
    <span
      title={task.source_label ?? undefined}
      className="border-border rounded-full border px-1.5 py-px"
    >
      {label}
    </span>
  );
}
