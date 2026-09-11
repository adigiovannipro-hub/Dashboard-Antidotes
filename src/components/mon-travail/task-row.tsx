"use client";

import { useRef, useState } from "react";
import { Check, ExternalLink, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { deleteTask, toggleTask, updateTask } from "@/app/actions/mon-travail";
import { TextCell, useCellAction } from "@/components/planning/cells";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
 * verrouillé. La coche ferme la tâche, qui quitte la liste au retour du
 * serveur : la rubrique « Archivé » n'existant plus, c'est le toast d'après-coup
 * qui porte la sortie de secours d'une coche trop rapide.
 *
 * Les quatre informations sont en colonnes alignées et titrées. Elles vivaient
 * en vrac sur une seconde ligne, où rien ne disait laquelle était le client et
 * laquelle la source.
 */

/** Gabarit partagé par l'en-tête et les lignes. */
const TASK_GRID =
  "md:grid md:grid-cols-[1rem_minmax(0,1fr)_9rem_7rem_8rem_1.75rem] md:items-center md:gap-x-3";

export function TaskHeader() {
  return (
    <div
      className={cn(
        "type-overline hidden border-b border-border bg-surface-sunken px-3 py-1 text-text-secondary",
        TASK_GRID,
      )}
    >
      {/* Le libellé masqué est **imbriqué** : `sr-only` passe en
          `position: absolute`, et une cellule absolue sort du flux de la
          grille — les cinq colonnes suivantes se décalaient d'un cran. */}
      <span>
        <span className="sr-only">Fait</span>
      </span>
      <span>Tâche</span>
      <span>Client</span>
      <span>Source</span>
      <span>Échéance</span>
      <span>
        <span className="sr-only">Supprimer</span>
      </span>
    </div>
  );
}

export function TaskRowView({
  task,
  workspace,
  clientWorkspaces,
  variant = "normal",
}: {
  task: WorkTask;
  workspace: TaskWorkspace | null;
  clientWorkspaces: TaskWorkspace[];
  variant?: "normal" | "overdue";
}) {
  const { run, pending } = useCellAction();
  // La tâche vient d'être cochée : elle s'affiche validée **sur place**, à sa
  // ligne, avant de descendre dans « Archivé » au retour du serveur. Cocher et
  // voir la ligne s'évaporer ne dit pas ce qui s'est passé — on doute d'avoir
  // cliqué au bon endroit.
  //
  // La coche pleine et le libellé barré suffisent à le dire : le mot
  // « Validé » écrit en dessous ajoutait une ligne à la hauteur du rang, ce qui
  // faisait sauter toutes les suivantes au moment même du clic.
  const [justValidated, setJustValidated] = useState(false);
  const overdue = variant === "overdue" && !justValidated;

  return (
    <div
      className={cn(
        // L'opacité entre dans la transition : le voile d'attente s'installait
        // d'un coup, ce qui se lit comme un défaut d'affichage et non comme
        // « c'est parti ». Les couleurs y étaient déjà.
        // Au doigt, la ligne garde son air : c'est la coche qu'on vise, et
        // vingt pixels sont déjà le minimum. À la souris, la ligne n'a plus de
        // padding propre — c'est la cellule de saisie qui la dimensionne, et
        // le rang tombe de 36 à 28 px.
        "group/row flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/60 px-3 py-2 transition-[background-color,border-color,color,opacity] duration-(--motion-duration) ease-standard motion-reduce:transition-none md:py-0",
        "hover:bg-muted/40",
        TASK_GRID,
        // Pas de voile pendant la validation : la ligne doit rester lisible
        // le temps qu'on lise « validé ».
        pending && !justValidated && "opacity-60",
      )}
    >
      <button
        type="button"
        aria-label={
          justValidated
            ? `Rouvrir « ${task.title} »`
            : `Marquer « ${task.title} » comme faite`
        }
        aria-pressed={justValidated}
        onClick={() => {
          const done = !justValidated;
          setJustValidated(done);
          run(() => toggleTask({ taskId: task.id, done })).then((result) => {
            // Cocher fait sortir la tâche de la liste au retour du serveur :
            // sans ce toast, une coche posée sur la mauvaise ligne serait sans
            // retour. C'est ce que l'ancienne rubrique « Archivé » assurait.
            if (!done || !result.ok) return;
            toast.success("Tâche faite.", {
              action: {
                label: "Annuler",
                onClick: () => {
                  setJustValidated(false);
                  run(() => toggleTask({ taskId: task.id, done: false }));
                },
              },
            });
          });
        }}
        className={cn(
          "focus-visible:ring-ring flex size-5 shrink-0 items-center justify-center rounded-full border-2 outline-none focus-visible:ring-2 md:size-4 md:border",
          // Encre du texte, pas vert de marque : `--accent-ink` passe au vert
          // clair en mode sombre, et la coche blanche y tombait à 1,6:1. Le
          // couple primaire/surface se retourne proprement dans les deux
          // thèmes, et « fait » n'a pas à être une couleur de marque.
          justValidated
            ? "border-text-primary bg-text-primary text-surface"
            : overdue
              ? "border-danger hover:bg-danger-subtle"
              : "border-border-strong hover:border-text-secondary",
        )}
      >
        {justValidated ? <Check className="size-3" strokeWidth={3} aria-hidden /> : null}
      </button>

      <div className="min-w-0 flex-1">
        {justValidated ? (
          /* `py-1` : la hauteur de la boîte de `TextCell`, pour que la ligne
             ne se rétracte pas au moment même où on la coche. */
          <p className="type-body truncate py-1 text-text-secondary line-through">
            {task.title}
          </p>
        ) : (
          <TextCell
            value={task.title}
            ariaLabel="Libellé de la tâche"
            className={cn("-mx-1.5", overdue && "text-danger-ink")}
            onCommit={(next) =>
              run(() => updateTask({ taskId: task.id, field: "title", value: next }))
            }
          />
        )}
      </div>

      {/* Rupture de ligne au téléphone : sans elle, le libellé partageait sa
          ligne avec le client, la source et la date, et se réduisait à deux
          caractères. `md:hidden` la retire du flux de la grille — un élément
          en `display:none` n'est pas une cellule. */}
      <span aria-hidden className="basis-full md:hidden" />

      <div className="type-caption min-w-0 text-text-secondary">
        <WorkspaceSelect
          task={task}
          workspace={workspace}
          clientWorkspaces={clientWorkspaces}
          onSelect={(workspaceId) =>
            run(() =>
              updateTask({
                taskId: task.id,
                field: "workspace_id",
                value: workspaceId,
              }),
            )
          }
        />
      </div>

      <div className="type-caption min-w-0 text-text-secondary">
        <SourceBadge task={task} />
      </div>

      <div className="type-caption text-text-secondary">
        <DueDateCell
          value={task.due_date}
          overdue={overdue}
          onCommit={(next) =>
            run(() =>
              updateTask({ taskId: task.id, field: "due_date", value: next }),
            )
          }
        />
      </div>

      <button
        type="button"
        aria-label={`Supprimer « ${task.title} »`}
        onClick={() => run(() => deleteTask({ taskId: task.id }))}
        className="text-muted-foreground hover:text-danger-ink focus-visible:ring-ring ml-auto rounded p-1 opacity-40 transition group-hover/row:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:outline-none md:ml-0 md:opacity-0"
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

/**
 * L'échéance, éditable.
 *
 * Le clic sur les **chiffres** ouvre le calendrier : viser une cible de douze
 * pixels pour changer une date est une punition, et l'icône native est donc
 * masquée. `showPicker()` n'existe pas partout — sans lui, le champ garde son
 * comportement natif, qui reste éditable au clavier.
 */
function DueDateCell({
  value,
  overdue,
  onCommit,
}: {
  value: string;
  overdue: boolean;
  onCommit: (next: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <input
      ref={inputRef}
      type="date"
      value={value}
      aria-label="Échéance de la tâche"
      onPointerDown={(event) => {
        const input = inputRef.current;
        if (!input || typeof input.showPicker !== "function") return;
        event.preventDefault();
        input.focus();
        input.showPicker();
      }}
      onChange={(event) => {
        if (!event.target.value) return;
        onCommit(event.target.value);
      }}
      className={cn(
        // Le pictogramme natif du champ de date, retiré : douze lignes le
        // répétaient à droite de chaque échéance alors que le clic sur les
        // chiffres ouvre déjà le calendrier. `hidden` ne suffit pas partout
        // (WebKit garde une gouttière), d'où l'opacité en ceinture ;
        // `showPicker()` ne dépend pas de son affichage.
        "[&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:opacity-0",
        "focus-visible:ring-brand w-full cursor-pointer rounded-sm bg-transparent tabular-nums outline-none focus-visible:ring-2",
        overdue && "text-danger-ink",
      )}
    />
  );
}

/** Le rattachement client — modifiable après coup, comme le reste. */
function WorkspaceSelect({
  task,
  workspace,
  clientWorkspaces,
  onSelect,
}: {
  task: WorkTask;
  workspace: TaskWorkspace | null;
  clientWorkspaces: TaskWorkspace[];
  onSelect: (workspaceId: string | null) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Client rattaché à « ${task.title} »`}
        className="focus-visible:ring-brand hover:text-foreground flex min-w-0 items-center gap-1 rounded-sm outline-none focus-visible:ring-2"
      >
        {workspace ? (
          <WorkspaceDot workspace={workspace} />
        ) : (
          <span className="inline-flex items-center gap-1 text-text-tertiary">
            <Users className="size-3" aria-hidden />
            <span className="text-text-secondary">Aucun</span>
          </span>
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
    <span className="flex min-w-0 items-center gap-1.5">
      <span
        aria-hidden
        className="bg-muted size-2 shrink-0 rounded-full"
        style={
          workspace.accent_color
            ? { backgroundColor: workspace.accent_color }
            : undefined
        }
      />
      <span className="truncate">{workspace.name}</span>
    </span>
  );
}

/**
 * D'où vient la tâche — et le lien vers sa source quand il existe.
 *
 * Les trois formes partagent **exactement la même boîte** : même bordure, même
 * rayon, mêmes marges intérieures. « Manuel » n'a pas de pastille visible, mais
 * il en porte le gabarit en transparent — sans quoi il flottait un pixel plus
 * haut et deux pixels plus à gauche que « Récurrent », d'une ligne à l'autre.
 */
const SOURCE_BOX =
  "inline-flex items-center gap-1 rounded-full border px-1.5 py-px leading-5";

function SourceBadge({ task }: { task: WorkTask }) {
  const label = WORK_SOURCE_LABELS[task.source];

  if (task.source === "manual") {
    return (
      <span className={cn(SOURCE_BOX, "border-transparent text-text-secondary")}>
        {label}
      </span>
    );
  }

  if (task.source_url) {
    return (
      <a
        href={task.source_url}
        target="_blank"
        rel="noreferrer"
        title={task.source_label ?? label}
        className={cn(
          SOURCE_BOX,
          "border-border hover:text-foreground focus-visible:ring-ring outline-none focus-visible:ring-2",
        )}
      >
        {label}
        <ExternalLink className="size-2.5" aria-hidden />
      </a>
    );
  }

  return (
    <span
      title={task.source_label ?? undefined}
      className={cn(SOURCE_BOX, "border-border")}
    >
      {label}
    </span>
  );
}
