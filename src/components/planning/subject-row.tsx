"use client";

import { useState } from "react";
import { MessageSquare, MessageSquarePlus } from "lucide-react";

import {
  addComment,
  deleteSubject,
  removeVisual,
  updateSubject,
  uploadVisual,
  type EditableField,
} from "@/app/actions/planning";
import {
  ChipSelect,
  DateCell,
  DeleteRowButton,
  NumberCell,
  OwnerAvatar,
  OwnerCell,
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
import {
  AD_STATUS_COLORS,
  AD_STATUS_LABELS,
  AD_STATUS_ORDER,
  COMMENT_SCOPE_LABELS,
  FORMAT_COLORS,
  FORMAT_LABELS,
  FORMAT_ORDER,
  STATUS_COLORS,
  STATUS_LABELS,
  STATUS_ORDER,
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
 * Gabarit de colonnes, partagé par l'en-tête et les lignes.
 *
 * Une seule déclaration pour les deux : c'est la seule façon de garantir que
 * l'en-tête reste aligné sur les cellules quand une colonne change de largeur.
 */
export const ROW_GRID =
  "grid grid-cols-[minmax(150px,1.6fr)_30px_40px_124px_100px_108px_56px_minmax(150px,1.4fr)_84px_108px_88px_26px] items-center gap-x-1";

const STATUS_OPTIONS = STATUS_ORDER.filter((status) => status !== "idea").map(
  (status) => ({
    value: status,
    label: STATUS_LABELS[status],
    color: STATUS_COLORS[status],
  }),
);

const FORMAT_OPTIONS = FORMAT_ORDER.filter((format) => format !== "other").map(
  (format) => ({
    value: format,
    label: FORMAT_LABELS[format],
    color: FORMAT_COLORS[format],
  }),
);

const AD_STATUS_OPTIONS = AD_STATUS_ORDER.map((status) => ({
  value: status,
  label: AD_STATUS_LABELS[status],
  color: AD_STATUS_COLORS[status],
}));

export function SubjectRowView({
  scope,
  row,
  owners,
  objectives,
  flagged,
}: {
  scope: Scope;
  row: Row;
  owners: PlanningOwner[];
  objectives: string[];
  /** Pointée par le contrôle de cadence. */
  flagged?: boolean;
}) {
  const { run, pending } = useCellAction();

  const edit = (field: EditableField, value: unknown) =>
    run(() => updateSubject(scope, { subjectId: row.id, field, value }));

  return (
    <div
      className={cn(
        "group/row border-border/60 hover:bg-muted/40 border-b px-2 py-0.5 transition-colors",
        ROW_GRID,
        pending && "opacity-60",
        flagged && "ring-brand-red/25 ring-1 ring-inset",
      )}
    >
      {/* Sujet */}
      <TextCell
        value={row.name}
        ariaLabel="Sujet de la publication"
        placeholder="Nouveau sujet…"
        className="font-medium"
        onCommit={(next) => edit("name", next)}
      />

      {/* Retours client */}
      <CommentsDialog scope={scope} row={row} />

      {/* Propriétaire */}
      <OwnerCell
        owner={row.owner}
        candidates={owners}
        onSelect={(ownerId) => edit("owner_id", ownerId)}
      />

      {/* Statut */}
      <ChipSelect<PlanningStatus>
        value={row.status === "idea" ? null : row.status}
        options={STATUS_OPTIONS}
        ariaLabel="Statut de la publication"
        allowClear
        onSelect={(next) => edit("status", next ?? "idea")}
      />

      {/* Type */}
      <ChipSelect<PlanningFormat>
        value={row.format === "other" ? null : row.format}
        options={FORMAT_OPTIONS}
        ariaLabel="Type de contenu"
        allowClear
        onSelect={(next) => edit("format", next ?? "other")}
      />

      {/* Date */}
      <DateCell
        value={row.scheduled_on}
        onCommit={(next) => edit("scheduled_on", next)}
      />

      {/* Visuels */}
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
        onRemove={(path) => run(() => removeVisual(scope, { subjectId: row.id, path }))}
      />

      {/* Wording */}
      <WordingCell
        value={row.wording}
        subjectName={row.name}
        onCommit={(next) => edit("wording", next)}
      />

      {/* Sponsorisation */}
      <NumberCell
        value={row.sponsoring}
        ariaLabel="Budget de sponsorisation"
        onCommit={(next) => edit("sponsoring", next)}
      />

      {/* Objectif de l'annonce */}
      <TextSelect
        value={row.ad_objective}
        options={objectives}
        ariaLabel="Objectif de l'annonce"
        onSelect={(next) => edit("ad_objective", next)}
      />

      {/* Statut de l'annonce */}
      <ChipSelect<PlanningAdStatus>
        value={row.ad_status}
        options={AD_STATUS_OPTIONS}
        ariaLabel="Statut de l'annonce"
        allowClear
        onSelect={(next) => edit("ad_status", next)}
      />

      <DeleteRowButton
        label={row.name || "cette publication"}
        onDelete={() => run(() => deleteSubject(scope, { subjectId: row.id }))}
      />
    </div>
  );
}

/**
 * Le fil de retours d'une publication — la colonne « + » du board.
 *
 * Un retour porte sur le visuel ou sur le wording : ce sont les deux sujets
 * d'une validation client, et ils n'appellent pas la même correction. Le
 * distinguer à l'écriture évite d'avoir à le deviner à la lecture.
 */
function CommentsDialog({ scope, row }: { scope: Scope; row: Row }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [commentScope, setCommentScope] = useState<PlanningCommentScope>("general");
  const { run, pending } = useCellAction();

  function submit() {
    if (!body.trim()) return;
    run(async () => {
      const result = await addComment(scope, {
        subjectId: row.id,
        scope: commentScope,
        body,
      });
      if (result.ok) setBody("");
      return result;
    });
  }

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

        {row.comments.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aucun retour. Le client peut en déposer ici, sur le visuel ou sur le
            wording.
          </p>
        ) : (
          <ul className="max-h-72 space-y-3 overflow-y-auto">
            {row.comments.map((comment) => (
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
      </DialogContent>
    </Dialog>
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
