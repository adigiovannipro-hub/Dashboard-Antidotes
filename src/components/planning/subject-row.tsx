"use client";

import { useState } from "react";
import { AtSign, MessageSquare, MessageSquarePlus, Plus, X } from "lucide-react";

import {
  addComment,
  bulkUpdateSubjects,
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
  VisualsCell,
  WordingCell,
  useCellAction,
} from "@/components/planning/cells";
import { Button } from "@/components/ui/button";
import type { ColumnDef, ColumnLabel } from "@/lib/planning/columns";
import type {
  PlanningComment,
  PlanningOwner,
  SubjectRow as Row,
} from "@/lib/planning/types";
import { cn } from "@/lib/utils";

export type Scope = { workspace: string; board: string };

/** Champs qu'une modification de cellule propage à toute la sélection. */
const BULK_FIELDS: EditableField[] = [
  "status",
  "format",
  "scheduled_on",
  "sponsoring",
  "ad_objective",
  "ad_status",
  "owner_id",
];

function toOptions(labels: ColumnLabel[] | null) {
  return (labels ?? []).map((label) => ({
    value: label.id,
    label: label.label,
    color: label.color,
  }));
}

/**
 * Une ligne du tableau, rendue colonne par colonne depuis le registre.
 *
 * Le clic sur la ligne — hors cellule éditable — ouvre le panneau latéral ;
 * l'icône de retours l'ouvre directement sur le fil, curseur dans le champ.
 * Et quand la ligne fait partie d'une sélection multiple, modifier une de ses
 * cellules applique la valeur à toute la sélection : c'est le geste Monday,
 * cocher puis corriger une seule fois.
 *
 * Les filets verticaux entre colonnes viennent du conteneur (`[&>*+*]`) : les
 * cellules portent leur propre hauteur (`py-1`, conteneur sans padding
 * vertical), sans quoi chaque filet s'arrêterait à 4 px du bord de sa ligne.
 */
export function SubjectRowView({
  scope,
  row,
  columns,
  gridTemplate,
  owners,
  selected,
  /** Les identifiants de la sélection, quand cette ligne en fait partie. */
  bulkTargets,
  onToggleSelect,
  onOpen,
}: {
  scope: Scope;
  row: Row;
  columns: ColumnDef[];
  gridTemplate: string;
  owners: PlanningOwner[];
  selected: boolean;
  bulkTargets: string[] | null;
  onToggleSelect: (subjectId: string) => void;
  onOpen: (subjectId: string, focusRetours?: boolean) => void;
}) {
  const { run, pending } = useCellAction();

  const edit = (field: EditableField, value: unknown) => {
    if (bulkTargets && bulkTargets.length > 1 && BULK_FIELDS.includes(field)) {
      run(() =>
        bulkUpdateSubjects(scope, { subjectIds: bulkTargets, field, value }),
      );
      return;
    }
    run(() => updateSubject(scope, { subjectId: row.id, field, value }));
  };

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
        "group/row border-border/60 [&>*+*]:border-border/50 grid cursor-pointer border-b px-2 transition-colors [&>*+*]:border-l",
        selected ? "bg-brand-mint/40" : "hover:bg-muted/40",
        pending && "opacity-60",
      )}
      style={{ gridTemplateColumns: gridTemplate }}
    >
      {/* Coche de sélection */}
      <span
        onClick={(event) => event.stopPropagation()}
        className="flex items-center justify-center py-1"
      >
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
          edit={edit}
          run={run}
          pending={pending}
          onOpenRetours={() => onOpen(row.id, true)}
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
  edit,
  run,
  pending,
  onOpenRetours,
}: {
  scope: Scope;
  column: ColumnDef;
  row: Row;
  owners: PlanningOwner[];
  edit: (field: EditableField, value: unknown) => void;
  run: ReturnType<typeof useCellAction>["run"];
  pending: boolean;
  onOpenRetours: () => void;
}) {
  const stop = (node: React.ReactNode) => (
    <span
      onClick={(event) => event.stopPropagation()}
      className="flex min-w-0 items-center px-1 py-1"
    >
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
          {stop(<CommentsBadge row={row} onOpen={onOpenRetours} />)}
        </>
      );

    case "status":
      return stop(
        <ChipSelect<string>
          value={row.status === "idea" ? null : row.status}
          options={toOptions(column.labels)}
          ariaLabel="Statut de la publication"
          allowClear
          onSelect={(next) => edit("status", next ?? "idea")}
        />,
      );

    case "format":
      return stop(
        <ChipSelect<string>
          value={row.format === "other" ? null : row.format}
          options={toOptions(column.labels)}
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
          onUpload={(files) => {
            const formData = new FormData();
            formData.set("subjectId", row.id);
            for (const file of files) formData.append("file", file);
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
        <ChipSelect<string>
          value={row.ad_objective}
          options={toOptions(column.labels)}
          ariaLabel="Objectif de l'annonce"
          allowClear
          onSelect={(next) => edit("ad_objective", next)}
        />,
      );

    case "ad_status":
      return stop(
        <ChipSelect<string>
          value={row.ad_status}
          options={toOptions(column.labels)}
          ariaLabel="Statut de l'annonce"
          allowClear
          onSelect={(next) => edit("ad_status", next)}
        />,
      );

    case "updated":
      return (
        <span className="flex min-w-0 items-center justify-center px-1 py-1">
          <LastUpdateCell updater={row.updater} label={row.updated_label} />
        </span>
      );
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
          options={toOptions(column.labels)}
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
 * L'icône de retours de la ligne — la colonne « + » du board. Le clic ouvre le
 * panneau latéral directement sur le fil, curseur posé dans le champ.
 */
function CommentsBadge({ row, onOpen }: { row: Row; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Retours sur ${row.name || "la publication"} (${row.comments.length})`}
      className={cn(
        "hover:bg-muted focus-visible:ring-brand relative flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-2",
        row.comments.length > 0 ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {row.comments.length > 0 ? (
        <>
          <MessageSquare className="size-3.5" aria-hidden />
          {/* L'encre, pas la teinte vive : du blanc sur le vert de marque
              tombe à 2,71:1 — illisible à 8 px. */}
          <span className="bg-accent-ink absolute -top-0.5 -right-0.5 flex size-3 items-center justify-center rounded-full text-[8px] font-bold text-white tabular-nums">
            {row.comments.length}
          </span>
        </>
      ) : (
        <MessageSquarePlus className="size-3.5 opacity-40" aria-hidden />
      )}
    </button>
  );
}

/**
 * Le fil de retours, dans le panneau latéral.
 *
 * Un seul fil, sans catégorie : « général / visuel / wording » ajoutait un
 * choix avant chaque message pour un classement que personne ne relisait.
 * En dessous du champ, les adresses à prévenir : les membres du tableau en un
 * clic, n'importe quelle adresse au clavier — le retour leur part par e-mail.
 */
export function CommentThread({
  scope,
  subjectId,
  comments,
  members,
  autoFocus,
}: {
  scope: Scope;
  subjectId: string;
  comments: PlanningComment[];
  members: PlanningOwner[];
  autoFocus?: boolean;
}) {
  const [body, setBody] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [emailDraft, setEmailDraft] = useState("");
  const { run, pending } = useCellAction();

  const toggle = (email: string) =>
    setRecipients((current) =>
      current.includes(email)
        ? current.filter((candidate) => candidate !== email)
        : [...current, email],
    );

  const addFreeEmail = () => {
    const email = emailDraft.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return;
    if (!recipients.includes(email)) setRecipients((current) => [...current, email]);
    setEmailDraft("");
  };

  function submit() {
    if (!body.trim()) return;
    run(async () => {
      const result = await addComment(scope, {
        subjectId,
        scope: "general",
        body,
        mentions: recipients,
      });
      if (result.ok) {
        setBody("");
        setRecipients([]);
      }
      return result;
    });
  }

  const memberEmails = new Set(members.map((member) => member.email));
  const freeRecipients = recipients.filter((email) => !memberEmails.has(email));

  return (
    <div className="space-y-3">
      {comments.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucun retour pour l&apos;instant.
        </p>
      ) : (
        <ul className="max-h-72 space-y-3 overflow-y-auto">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          // Depuis l'icône de la ligne, le curseur arrive directement ici.
          autoFocus={autoFocus}
          aria-label="Nouveau retour"
          placeholder="Ce qui doit changer, et pourquoi."
          className="border-input bg-background focus-visible:ring-brand w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />

        <div className="flex flex-wrap items-center gap-1.5">
          <AtSign className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
          {members.map((member) => (
            <RecipientChip
              key={member.id}
              label={member.full_name ?? member.email}
              selected={recipients.includes(member.email)}
              onClick={() => toggle(member.email)}
            />
          ))}
          {freeRecipients.map((email) => (
            <RecipientChip
              key={email}
              label={email}
              selected
              onClick={() => toggle(email)}
            />
          ))}
          <div className="flex items-center gap-1">
            <input
              type="email"
              value={emailDraft}
              onChange={(event) => setEmailDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addFreeEmail();
                }
              }}
              aria-label="Ajouter une adresse e-mail"
              placeholder="email@client.fr"
              className="border-input bg-background focus-visible:ring-brand h-7 w-36 rounded-md border px-2 text-xs focus-visible:ring-2 focus-visible:outline-none"
            />
            <button
              type="button"
              onClick={addFreeEmail}
              aria-label="Taguer cette adresse"
              className="text-muted-foreground hover:text-foreground focus-visible:ring-brand rounded p-1 focus-visible:ring-2 focus-visible:outline-none"
            >
              <Plus className="size-3.5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={submit} disabled={pending}>
            {pending
              ? "Envoi…"
              : recipients.length > 0
                ? `Ajouter et envoyer (${recipients.length})`
                : "Ajouter le retour"}
          </Button>
          {recipients.length > 0 ? (
            <span className="text-muted-foreground text-xs">
              part aussi par e-mail
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RecipientChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-pill focus-visible:ring-brand flex items-center gap-1 border px-2 py-0.5 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none",
        selected
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      {selected ? <X className="size-3" aria-hidden /> : null}
    </button>
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
        {/* `?? []` : tant que la migration 0030 n'est pas passée en base, la
            colonne n'existe pas et la ligne arrive sans `mentions`. */}
        {(comment.mentions ?? []).length > 0 ? (
          <p className="text-muted-foreground mt-0.5 text-[10px]">
            Envoyé par e-mail à {comment.mentions.join(", ")}
          </p>
        ) : null}
      </div>
    </li>
  );
}
