"use client";

import Link from "next/link";

import {
  removeVisual,
  updateSubject,
  uploadVisual,
  type EditableField,
} from "@/app/actions/planning";
import {
  ChipSelect,
  DateCell,
  TextCell,
  VisualsCell,
  WordingCell,
  useCellAction,
} from "@/components/planning/cells";
import type { TaskWorkspace } from "@/lib/mon-travail/types";
import type { PublicationRow as Row } from "@/lib/mon-travail/types";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  STATUS_ORDER,
  type PlanningStatus,
} from "@/lib/planning/types";
import { cn } from "@/lib/utils";

/**
 * Une ligne d'« À publier » : la publication du planning éditorial, entière et
 * éditable, sur la page d'accueil.
 *
 * Les cellules sont **celles du planning** — même pastille de statut, même
 * dialogue de wording, mêmes visuels — et les écritures passent par les mêmes
 * actions, sur la même ligne en base. La synchronisation entre les deux vues
 * n'est pas un mécanisme : c'est l'absence de copie.
 */

const STATUS_OPTIONS = STATUS_ORDER.filter((status) => status !== "idea").map(
  (status) => ({
    value: status,
    label: STATUS_LABELS[status],
    color: STATUS_COLORS[status],
  }),
);

/** Gabarit desktop : client, réseau, sujet, visuel, caption, date, statut. */
const ROW_GRID =
  "md:grid md:grid-cols-[minmax(120px,1fr)_92px_minmax(150px,1.5fr)_56px_minmax(170px,1.8fr)_118px_136px] md:items-center md:gap-x-1";

export function PublicationRowView({
  row,
  archived,
}: {
  row: Row;
  /** Une publication partie est grisée dans « Archivé », mais reste éditable. */
  archived?: boolean;
}) {
  const { run, pending } = useCellAction();
  const scope = { workspace: row.workspace.slug, board: row.board_slug };

  const edit = (field: EditableField, value: unknown) =>
    run(() => updateSubject(scope, { subjectId: row.subject.id, field, value }));

  return (
    <div
      className={cn(
        "group/row border-border/60 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-2 py-2.5 transition-colors md:py-1",
        "hover:bg-muted/40",
        ROW_GRID,
        pending && "opacity-60",
        archived && "opacity-60",
      )}
    >
      <WorkspaceChip workspace={row.workspace} boardSlug={row.board_slug} />

      <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
        {row.lane_name}
      </span>

      <div className="basis-full md:basis-auto">
        <TextCell
          value={row.subject.name}
          ariaLabel={`Sujet de la publication de ${row.workspace.name}`}
          placeholder="Sujet…"
          className="font-medium"
          onCommit={(next) => edit("name", next)}
        />
      </div>

      <VisualsCell
        visuals={row.visuals}
        subjectName={row.subject.name}
        uploading={pending}
        onUpload={(file) => {
          const formData = new FormData();
          formData.set("subjectId", row.subject.id);
          formData.set("file", file);
          run(() => uploadVisual(scope, formData));
        }}
        onRemove={(path) =>
          run(() => removeVisual(scope, { subjectId: row.subject.id, path }))
        }
      />

      <div className="min-w-0 flex-1 md:flex-none">
        <WordingCell
          value={row.subject.wording}
          subjectName={row.subject.name}
          onCommit={(next) => edit("wording", next)}
        />
      </div>

      {/* Le planning n'a pas d'heure de publication : la date est l'échéance. */}
      <div className="w-[7.5rem] md:w-full">
        <DateCell
          value={row.subject.scheduled_on}
          onCommit={(next) => edit("scheduled_on", next)}
        />
      </div>

      <div className="basis-full md:basis-auto">
        <ChipSelect<PlanningStatus>
          value={row.subject.status === "idea" ? null : row.subject.status}
          options={STATUS_OPTIONS}
          ariaLabel={`Statut de la publication de ${row.workspace.name}`}
          allowClear
          onSelect={(next) => edit("status", next ?? "idea")}
        />
      </div>
    </div>
  );
}

/** Le client de la ligne, cliquable vers son planning d'origine. */
function WorkspaceChip({
  workspace,
  boardSlug,
}: {
  workspace: TaskWorkspace;
  boardSlug: string;
}) {
  return (
    <Link
      href={`/espace/${workspace.slug}/planning/${boardSlug}`}
      className="focus-visible:ring-brand flex min-w-0 items-center gap-1.5 rounded-sm text-sm font-medium outline-none hover:underline focus-visible:ring-2"
      title={`Ouvrir le planning de ${workspace.name}`}
    >
      <span
        aria-hidden
        className="bg-muted size-2.5 shrink-0 rounded-full"
        style={
          workspace.accent_color
            ? { backgroundColor: workspace.accent_color }
            : undefined
        }
      />
      <span className="truncate">{workspace.name}</span>
    </Link>
  );
}
