"use client";

import { useRef, useState } from "react";
import {
  AtSign,
  Check,
  GripVertical,
  MessageSquare,
  MessageSquarePlus,
  X,
} from "lucide-react";

import {
  addComment,
  bulkUpdateSubjects,
  removeVisual,
  updateCustomValue,
  updateSubject,
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
import { uploadVisualsFromBrowser } from "@/lib/planning/upload-client";
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

/** Le format que porte un drag de ligne dans `dataTransfer`. */
export const SUBJECT_DRAG_TYPE = "text/x-antidotes-subject";

/**
 * Une ligne du tableau, rendue colonne par colonne depuis le registre.
 *
 * Le clic sur la ligne — hors cellule éditable — ouvre le panneau latéral ;
 * l'icône de retours l'ouvre directement sur le fil, curseur dans le champ.
 * La poignée de gauche se saisit : la ligne se dépose ailleurs dans son
 * couloir, dans un autre réseau, dans un autre mois. Et quand la ligne fait
 * partie d'une sélection multiple, modifier une de ses cellules applique la
 * valeur à toute la sélection : le geste Monday, cocher puis corriger une
 * seule fois.
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
  onEditLabels,
  dropIndicator,
  onRowDragOver,
  onRowDragLeave,
  onRowDrop,
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
  /** Ouvre l'éditeur d'étiquettes de la colonne cliquée. */
  onEditLabels: (column: ColumnDef) => void;
  /** Le filet de dépôt pendant un drag — au-dessus ou en dessous. */
  dropIndicator: "avant" | "apres" | null;
  onRowDragOver: (subjectId: string, after: boolean) => void;
  onRowDragLeave: () => void;
  onRowDrop: (subjectId: string, after: boolean, draggedId: string) => void;
}) {
  const { run, pending } = useCellAction();
  const [dragging, setDragging] = useState(false);

  const edit = (field: EditableField, value: unknown) => {
    if (bulkTargets && bulkTargets.length > 1 && BULK_FIELDS.includes(field)) {
      run(() =>
        bulkUpdateSubjects(scope, { subjectIds: bulkTargets, field, value }),
      );
      return;
    }
    run(() => updateSubject(scope, { subjectId: row.id, field, value }));
  };

  const isAfter = (event: React.DragEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY > rect.top + rect.height / 2;
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
      onDragOver={(event) => {
        if (![...event.dataTransfer.types].includes(SUBJECT_DRAG_TYPE)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onRowDragOver(row.id, isAfter(event));
      }}
      onDragLeave={onRowDragLeave}
      onDrop={(event) => {
        const draggedId = event.dataTransfer.getData(SUBJECT_DRAG_TYPE);
        if (!draggedId) return;
        event.preventDefault();
        onRowDrop(row.id, isAfter(event), draggedId);
      }}
      className={cn(
        "group/row border-border/60 [&>*+*]:border-border/50 grid cursor-pointer border-b px-2 transition-colors [&>*+*]:border-l",
        selected ? "bg-brand-mint/40" : "hover:bg-muted/40",
        pending && "opacity-60",
        // Pendant le drag, l'original s'estompe : c'est la copie sous le
        // curseur qui porte la ligne.
        dragging && "opacity-30",
        // Le filet de dépôt : là où la ligne va se poser.
        dropIndicator === "avant" && "shadow-[inset_0_2px_0_0_var(--accent-ink)]",
        dropIndicator === "apres" && "shadow-[inset_0_-2px_0_0_var(--accent-ink)]",
      )}
      style={{ gridTemplateColumns: gridTemplate }}
    >
      {/* Poignée de drag + coche de sélection */}
      <span
        onClick={(event) => event.stopPropagation()}
        className="flex items-center justify-center gap-0.5 py-1"
      >
        <span
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData(SUBJECT_DRAG_TYPE, row.id);
            event.dataTransfer.effectAllowed = "move";
            // C'est toute la ligne qui suit le curseur, pas la poignée seule.
            const rowElement = event.currentTarget.closest('[role="row"]');
            if (rowElement instanceof HTMLElement) {
              const rect = rowElement.getBoundingClientRect();
              event.dataTransfer.setDragImage(
                rowElement,
                event.clientX - rect.left,
                event.clientY - rect.top,
              );
            }
            setDragging(true);
          }}
          onDragEnd={() => setDragging(false)}
          aria-label={`Déplacer ${row.name || "la publication"}`}
          title="Glisser pour déplacer"
          className="text-muted-foreground/60 hover:text-foreground cursor-grab opacity-0 transition-opacity group-hover/row:opacity-100 active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" aria-hidden />
        </span>
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
          onOpenSubject={() => onOpen(row.id)}
          onEditLabels={() => onEditLabels(column)}
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
  onOpenSubject,
  onEditLabels,
}: {
  scope: Scope;
  column: ColumnDef;
  row: Row;
  owners: PlanningOwner[];
  edit: (field: EditableField, value: unknown) => void;
  run: ReturnType<typeof useCellAction>["run"];
  pending: boolean;
  onOpenRetours: () => void;
  onOpenSubject: () => void;
  onEditLabels: () => void;
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
          onEditLabels={onEditLabels}
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
          onEditLabels={onEditLabels}
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
          onOpen={onOpenSubject}
          onUpload={(files) =>
            run(() => uploadVisualsFromBrowser(scope, row.id, files))
          }
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
          onEditLabels={onEditLabels}
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
          onEditLabels={onEditLabels}
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
          onEditLabels={onEditLabels}
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
 * Taper `@` dans la bulle ouvre une petite fenêtre à côté du champ : on y
 * saisit ou choisit une adresse, elle se tague dans le texte, et le retour
 * lui part par e-mail à l'envoi.
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
  const [mentionOpen, setMentionOpen] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  // Position du `@` tapé, pour y écrire l'adresse validée.
  const mentionAt = useRef(0);
  const { run, pending } = useCellAction();

  const removeRecipient = (email: string) =>
    setRecipients((current) => current.filter((candidate) => candidate !== email));

  const validateMention = (raw: string) => {
    const email = raw.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return;
    // Le `@` tapé devient `@adresse` dans le texte du retour.
    const at = mentionAt.current;
    setBody((current) =>
      current.slice(0, at) + `@${email} ` + current.slice(at + 1),
    );
    if (!recipients.includes(email)) {
      setRecipients((current) => [...current, email]);
    }
    setEmailDraft("");
    setMentionOpen(false);
  };

  const suggestions = members.filter((member) => {
    const needle = emailDraft.trim().toLowerCase();
    if (!needle) return true;
    return (
      member.email.toLowerCase().includes(needle) ||
      (member.full_name ?? "").toLowerCase().includes(needle)
    );
  });

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
        <div className="relative">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "@") {
                mentionAt.current = event.currentTarget.selectionStart;
                setMentionOpen(true);
              }
            }}
            onFocus={() => setMentionOpen(false)}
            rows={3}
            // Depuis l'icône de la ligne, le curseur arrive directement ici.
            autoFocus={autoFocus}
            aria-label="Nouveau retour"
            placeholder="Ce qui doit changer, et pourquoi. @ pour taguer une adresse."
            className="border-input bg-background focus-visible:ring-brand w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
          />

          {mentionOpen ? (
            <div className="border-border bg-background absolute top-2 left-3 z-20 w-64 rounded-md border p-2 shadow-lg">
              <p className="text-muted-foreground mb-1.5 flex items-center gap-1 text-[11px]">
                <AtSign className="size-3" aria-hidden />
                Envoyer ce retour par e-mail à
              </p>
              <div className="flex items-center gap-1">
                <input
                  type="email"
                  autoFocus
                  value={emailDraft}
                  onChange={(event) => setEmailDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      validateMention(emailDraft);
                    }
                    if (event.key === "Escape") {
                      event.stopPropagation();
                      setMentionOpen(false);
                    }
                  }}
                  aria-label="Adresse e-mail à taguer"
                  placeholder="email@client.fr"
                  className="border-input bg-background focus-visible:ring-brand h-7 w-full rounded-md border px-2 text-xs focus-visible:ring-2 focus-visible:outline-none"
                />
                <button
                  type="button"
                  onClick={() => validateMention(emailDraft)}
                  aria-label="Valider cette adresse"
                  className="bg-foreground text-background hover:bg-foreground/85 rounded-md p-1.5"
                >
                  <Check className="size-3.5" aria-hidden />
                </button>
              </div>
              {suggestions.length > 0 ? (
                <ul className="mt-1.5 space-y-0.5">
                  {suggestions.slice(0, 4).map((member) => (
                    <li key={member.id}>
                      <button
                        type="button"
                        onClick={() => validateMention(member.email)}
                        className="hover:bg-muted flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs"
                      >
                        <OwnerAvatar owner={member} />
                        <span className="min-w-0 flex-1 truncate">
                          {member.full_name ?? member.email}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        {recipients.length > 0 ? (
          <p className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
            Partira par e-mail à
            {recipients.map((email) => (
              <span
                key={email}
                className="border-border rounded-pill flex items-center gap-1 border px-2 py-0.5"
              >
                {email}
                <button
                  type="button"
                  onClick={() => removeRecipient(email)}
                  aria-label={`Ne pas envoyer à ${email}`}
                  className="hover:text-foreground"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            ))}
          </p>
        ) : null}

        <Button type="button" size="sm" onClick={submit} disabled={pending}>
          {pending
            ? "Envoi…"
            : recipients.length > 0
              ? `Ajouter et envoyer (${recipients.length})`
              : "Ajouter le retour"}
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
