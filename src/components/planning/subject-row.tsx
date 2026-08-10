"use client";

import { useState } from "react";
import { MessageSquare, MessageSquarePlus } from "lucide-react";

import {
  addComment,
  removeVisual,
  updateCustomValue,
  updateSubject,
  uploadVisual,
  type EditableField,
} from "@/app/actions/planning";
import {
  CheckboxCell,
  ChipSelect,
  DateCell,
  LastUpdateCell,
  NumberCell,
  OwnerCell,
  OwnerAvatar,
  TextCell,
  TextSelect,
  VisualsCell,
  WordingCell,
  useCellAction,
} from "@/components/planning/cells";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ColumnDef } from "@/lib/planning/columns";
import {
  COMMENT_SCOPE_LABELS,
} from "@/lib/planning/types";
import type {
  PlanningAdStatus,
  PlanningComment,
  PlanningCommentScope,
  PlanningFormat,
  PlanningOwner,
  PlanningStatus,
  SubjectRow as Row,
} from "@/lib/planning/types";
import { cn } from "@/lib/utils";

export type Scope = { workspace: string; board: string };

/**
 * Une ligne du tableau, rendue colonne par colonne depuis le registre.
 *
 * Le clic sur la ligne — hors cellule éditable — ouvre le panneau latéral.
 * C'est le geste Monday : la cellule pour la retouche rapide, le panneau pour
 * tout le reste. La distinction se fait au niveau des cellules, qui coupent la
 * propagation : ce qui remonte jusqu'à la ligne est un clic « à côté ».
 */
export function SubjectRowView({
  scope,
  row,
  columns,
  gridTemplate,
  owners,
  objectives,
  selected,
  onToggleSelect,
  onOpen,
}: {
  scope: Scope;
  row: Row;
  columns: ColumnDef[];
  gridTemplate: string;
  owners: PlanningOwner[];
  objectives: string[];
  selected: boolean;
  onToggleSelect: (subjectId: string) => void;
  onOpen: (subjectId: string) => void;
}) {
  const { run, pending } = useCellAction();

  const edit = (field: EditableField, value: unknown) =>
    run(() => updateSubject(scope, { subjectId: row.id, field, value }));

  return (
    <div
      role="row"
      onClick={() => onOpen(row.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === event.currentTarget) {
          onOpen(row.id);
        }
      }}
      tabIndex={0}
      className={cn(
        "group/row border-border/60 grid cursor-pointer items-center gap-x-1 border-b px-2 py-0.5 transition-colors",
        selected ? "bg-brand-mint/40" : "hover:bg-muted/40",
        pending && "opacity-60",
      )}
      style={{ gridTemplateColumns: gridTemplate }}
    >
      {/* Coche de sélection */}
      <span onClick={(event) => event.stopPropagation()} className="flex justify-center">
        <input
          type="checkbox"
          checked={selected}
          aria-label={`Sélectionner ${row.name || "la publication"}`}
          onChange={() => onToggleSelect(row.id)}
          className="accent-brand size-3.5"
        />
      </span>

      {columns.map((column) => (
        <Cell
          key={column.id}
          scope={scope}
          column={column}
          row={row}
          owners={owners}
          objectives={objectives}
          edit={edit}
          run={run}
          pending={pending}
        />
      ))}

      {/* La piste du « + » d'en-tête : vide sur les lignes. */}
      <span aria-hidden />
    </div>
  );
}

function Cell({
  scope,
  column,
  row,
  owners,
  objectives,
  edit,
  run,
  pending,
}: {
  scope: Scope;
  column: ColumnDef;
  row: Row;
  owners: PlanningOwner[];
  objectives: string[];
  edit: (field: EditableField, value: unknown) => void;
  run: ReturnType<typeof useCellAction>["run"];
  pending: boolean;
}) {
  const stop = (node: React.ReactNode) => (
    <span onClick={(event) => event.stopPropagation()} className="min-w-0">
      {node}
    </span>
  );

  // --- Colonnes de base ---
  switch (column.builtin) {
    case "name":
      return (
        <>
          {stop(
            <TextCell
              value={row.name}
              ariaLabel="Sujet de la publication"
              placeholder="Nouveau sujet…"
              className="font-medium"
              onCommit={(next) => edit("name", next)}
            />,
          )}
          {stop(<CommentsDialog scope={scope} row={row} />)}
        </>
      );

    case "status":
      return stop(
        <ChipSelect<PlanningStatus>
          value={row.status === "idea" ? null : row.status}
          options={(column.labels ?? []).map((label) => ({
            value: label.id as PlanningStatus,
            label: label.label,
            color: label.color,
          }))}
          ariaLabel="Statut de la publication"
          allowClear
          onSelect={(next) => edit("status", next ?? "idea")}
        />,
      );

    case "format":
      return stop(
        <ChipSelect<PlanningFormat>
          value={row.format === "other" ? null : row.format}
          options={(column.labels ?? []).map((label) => ({
            value: label.id as PlanningFormat,
            label: label.label,
            color: label.color,
          }))}
          ariaLabel="Type de contenu"
          allowClear
          onSelect={(next) => edit("format", next ?? "other")}
        />,
      );

    case "date":
      return stop(
        <DateCell
          value={row.scheduled_on}
          onCommit={(next) => edit("scheduled_on", next)}
        />,
      );

    case "visual":
      return stop(
        <VisualsCell
          visuals={row.visuals}
          subjectName={row.name}
          uploading={pending}
          onUpload={(file) => {
            const formData = new FormData();
            formData.set("subjectId", row.id);
            formData.set("file", file);
            run(() => uploadVisual(scope, formData));
          }}
          onRemove={(path) =>
            run(() => removeVisual(scope, { subjectId: row.id, path }))
          }
        />,
      );

    case "wording":
      return stop(
        <WordingCell
          value={row.wording}
          subjectName={row.name}
          onCommit={(next) => edit("wording", next)}
        />,
      );

    case "sponsoring":
      return stop(
        <NumberCell
          value={row.sponsoring}
          ariaLabel="Budget de sponsorisation"
          onCommit={(next) => edit("sponsoring", next)}
        />,
      );

    case "objective":
      return stop(
        <TextSelect
          value={row.ad_objective}
          options={objectives}
          ariaLabel="Objectif de l'annonce"
          onSelect={(next) => edit("ad_objective", next)}
        />,
      );

    case "ad_status":
      return stop(
        <ChipSelect<PlanningAdStatus>
          value={row.ad_status}
          options={(column.labels ?? []).map((label) => ({
            value: label.id as PlanningAdStatus,
            label: label.label,
            color: label.color,
          }))}
          ariaLabel="Statut de l'annonce"
          allowClear
          onSelect={(next) => edit("ad_status", next)}
        />,
      );

    case "updated":
      return <LastUpdateCell updater={row.updater} label={row.updated_label} />;
  }

  // --- Colonnes ajoutées : la valeur vit dans `custom[column.id]` ---
  const value = row.custom[column.id] ?? null;
  const commit = (next: unknown) =>
    run(() =>
      updateCustomValue(scope, { subjectId: row.id, columnId: column.id, value: next }),
    );

  switch (column.type) {
    case "text":
      return stop(
        <TextCell
          value={typeof value === "string" ? value : ""}
          ariaLabel={column.label}
          onCommit={(next) => commit(next || null)}
        />,
      );

    case "number":
      return stop(
        <NumberCell
          value={typeof value === "number" ? value : null}
          ariaLabel={column.label}
          onCommit={commit}
        />,
      );

    case "date":
      return stop(
        <DateCell
          value={typeof value === "string" ? value : null}
          onCommit={commit}
        />,
      );

    case "checkbox":
      return stop(
        <CheckboxCell
          checked={value === true}
          label={column.label}
          onCommit={commit}
        />,
      );

    case "people": {
      const owner = owners.find((candidate) => candidate.id === value) ?? null;
      return stop(<OwnerCell owner={owner} candidates={owners} onSelect={commit} />);
    }

    case "status":
    case "dropdown":
      return stop(
        <ChipSelect<string>
          value={typeof value === "string" ? value : null}
          options={(column.labels ?? []).map((label) => ({
            value: label.id,
            label: label.label,
            color: label.color,
          }))}
          ariaLabel={column.label}
          allowClear
          onSelect={commit}
        />,
      );

    default:
      return <span aria-hidden />;
  }
}

/**
 * Le fil de retours d'une publication — la colonne « + » du board.
 *
 * Un retour porte sur le visuel ou sur le wording : ce sont les deux sujets
 * d'une validation client, et ils n'appellent pas la même correction.
 */
export function CommentsDialog({ scope, row }: { scope: Scope; row: Row }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        aria-label={`Retours sur ${row.name || "la publication"} (${row.comments.length})`}
        className={cn(
          "hover:bg-muted focus-visible:ring-brand relative flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-2",
          row.comments.length > 0 ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {row.comments.length > 0 ? (
          <>
            <MessageSquare className="size-3.5" aria-hidden />
            <span className="bg-brand absolute -top-0.5 -right-0.5 flex size-3 items-center justify-center rounded-full text-[8px] font-bold text-white tabular-nums">
              {row.comments.length}
            </span>
          </>
        ) : (
          <MessageSquarePlus className="size-3.5 opacity-40" aria-hidden />
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Retours — {row.name || "publication"}</DialogTitle>
        </DialogHeader>
        <CommentThread scope={scope} subjectId={row.id} comments={row.comments} />
      </DialogContent>
    </Dialog>
  );
}

/** Le fil lui-même, partagé entre le dialogue et le panneau latéral. */
export function CommentThread({
  scope,
  subjectId,
  comments,
}: {
  scope: Scope;
  subjectId: string;
  comments: PlanningComment[];
}) {
  const [body, setBody] = useState("");
  const [commentScope, setCommentScope] = useState<PlanningCommentScope>("general");
  const { run, pending } = useCellAction();

  function submit() {
    if (!body.trim()) return;
    run(async () => {
      const result = await addComment(scope, {
        subjectId,
        scope: commentScope,
        body,
      });
      if (result.ok) setBody("");
      return result;
    });
  }

  return (
    <div className="space-y-3">
      {comments.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucun retour. Déposez-en un — général, sur le visuel ou sur le wording.
        </p>
      ) : (
        <ul className="max-h-72 space-y-3 overflow-y-auto">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <div className="flex gap-1">
          {(["general", "visual", "wording"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setCommentScope(value)}
              aria-pressed={commentScope === value}
              className={cn(
                "rounded-md px-2 py-1 text-xs transition-colors",
                commentScope === value
                  ? "bg-card text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {COMMENT_SCOPE_LABELS[value]}
            </button>
          ))}
        </div>

        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          aria-label="Nouveau retour"
          placeholder="Ce qui doit changer, et pourquoi."
          className="border-input bg-background focus-visible:ring-brand w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />

        <Button type="button" size="sm" onClick={submit} disabled={pending}>
          {pending ? "Envoi…" : "Ajouter le retour"}
        </Button>
      </div>
    </div>
  );
}

function CommentItem({ comment }: { comment: PlanningComment }) {
  return (
    <li className="flex gap-2">
      <OwnerAvatar owner={comment.author} />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2 text-xs">
          <span className="font-medium">
            {comment.author?.full_name ?? comment.author?.email ?? "Inconnu"}
          </span>
          <span className="bg-card text-muted-foreground rounded px-1.5 py-0.5 text-[10px]">
            {COMMENT_SCOPE_LABELS[comment.scope]}
          </span>
          <time
            dateTime={comment.created_at}
            className="text-muted-foreground ml-auto text-[10px]"
          >
            {new Intl.DateTimeFormat("fr-FR", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Europe/Paris",
            }).format(new Date(comment.created_at))}
          </time>
        </p>
        <p className="mt-0.5 text-sm whitespace-pre-wrap">{comment.body}</p>
      </div>
    </li>
  );
}
