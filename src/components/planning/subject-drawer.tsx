"use client";

import { useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageSquare,
  Plus,
  X,
} from "lucide-react";

import { removeVisual, updateSubject, uploadVisual } from "@/app/actions/planning";
import {
  ChipSelect,
  DateCell,
  OwnerAvatar,
  useCellAction,
} from "@/components/planning/cells";
import { CommentThread, type Scope } from "@/components/planning/subject-row";
import { Button } from "@/components/ui/button";
import type { ColumnDef } from "@/lib/planning/columns";
import { isImagePath } from "@/lib/planning/storage";
import { PLATFORM_LABELS } from "@/lib/planning/types";
import type {
  PlanningActivity,
  PlanningFormat,
  PlanningStatus,
  SubjectRow,
} from "@/lib/planning/types";
import { cn } from "@/lib/utils";

/**
 * Le panneau latéral d'une publication — l'écran d'ouverture d'un élément sur
 * Monday, en une colonne à droite.
 *
 * Trois zones, dans l'ordre où on les regarde : le visuel (carrousel si
 * plusieurs, lecteur si vidéo), le contenu (wording, date, statut, réseau), et
 * les deux fils — retours du client, journal d'activité.
 */
export function SubjectDrawer({
  scope,
  subject,
  columns,
  activity,
  onClose,
}: {
  scope: Scope;
  subject: SubjectRow;
  columns: ColumnDef[];
  activity: PlanningActivity[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"retours" | "activite">("retours");
  const { run, pending } = useCellAction();
  const [wording, setWording] = useState(subject.wording ?? "");

  const statusColumn = columns.find((column) => column.builtin === "status");
  const formatColumn = columns.find((column) => column.builtin === "format");

  return (
    <aside
      aria-label={`Détail de ${subject.name || "la publication"}`}
      className="border-border bg-background fixed inset-y-0 right-0 z-40 flex w-full max-w-xl flex-col border-l shadow-xl"
    >
      {/* --- En-tête --- */}
      <header className="border-border flex items-start gap-3 border-b p-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le panneau"
          className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-brand rounded-md p-1.5 outline-none focus-visible:ring-2"
        >
          <X className="size-4" aria-hidden />
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            {subject.lane_name || PLATFORM_LABELS[subject.platform]}
          </p>
          <h2 className="truncate text-lg leading-snug font-semibold">
            {subject.name || "Sans sujet"}
          </h2>
        </div>

        <OwnerAvatar owner={subject.owner} />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* --- Visuels --- */}
        <VisualCarousel
          subject={subject}
          uploading={pending}
          onUpload={(file) => {
            const formData = new FormData();
            formData.set("subjectId", subject.id);
            formData.set("file", file);
            run(() => uploadVisual(scope, formData));
          }}
          onRemove={(path) =>
            run(() => removeVisual(scope, { subjectId: subject.id, path }))
          }
        />

        {/* --- Statut, type, date --- */}
        <div className="border-border grid grid-cols-3 gap-2 border-b p-4">
          <div>
            <p className="text-muted-foreground mb-1 text-[11px] uppercase">Statut</p>
            <ChipSelect<PlanningStatus>
              value={subject.status === "idea" ? null : subject.status}
              options={(statusColumn?.labels ?? []).map((label) => ({
                value: label.id as PlanningStatus,
                label: label.label,
                color: label.color,
              }))}
              ariaLabel="Statut"
              allowClear
              onSelect={(next) =>
                run(() =>
                  updateSubject(scope, {
                    subjectId: subject.id,
                    field: "status",
                    value: next ?? "idea",
                  }),
                )
              }
            />
          </div>
          <div>
            <p className="text-muted-foreground mb-1 text-[11px] uppercase">Type</p>
            <ChipSelect<PlanningFormat>
              value={subject.format === "other" ? null : subject.format}
              options={(formatColumn?.labels ?? []).map((label) => ({
                value: label.id as PlanningFormat,
                label: label.label,
                color: label.color,
              }))}
              ariaLabel="Type"
              allowClear
              onSelect={(next) =>
                run(() =>
                  updateSubject(scope, {
                    subjectId: subject.id,
                    field: "format",
                    value: next ?? "other",
                  }),
                )
              }
            />
          </div>
          <div>
            <p className="text-muted-foreground mb-1 text-[11px] uppercase">Date</p>
            <DateCell
              value={subject.scheduled_on}
              onCommit={(next) =>
                run(() =>
                  updateSubject(scope, {
                    subjectId: subject.id,
                    field: "scheduled_on",
                    value: next,
                  }),
                )
              }
            />
          </div>
        </div>

        {/* --- Wording --- */}
        <div className="border-border border-b p-4">
          <p className="text-muted-foreground mb-1 text-[11px] uppercase">Wording</p>
          <textarea
            value={wording}
            onChange={(event) => setWording(event.target.value)}
            onBlur={() => {
              const next = wording.trim();
              if (next === (subject.wording ?? "").trim()) return;
              run(() =>
                updateSubject(scope, {
                  subjectId: subject.id,
                  field: "wording",
                  value: next || null,
                }),
              );
            }}
            rows={7}
            aria-label="Wording"
            placeholder="La caption publiable, ou l'intention en phase de planning."
            className="border-input bg-background focus-visible:ring-brand w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
          />
          <p className="text-muted-foreground mt-1 text-right text-xs tabular-nums">
            {wording.length} caractères
          </p>
        </div>

        {/* --- Retours / Activités --- */}
        <div className="p-4">
          <div
            role="tablist"
            aria-label="Fils de la publication"
            className="mb-3 flex gap-1"
          >
            <TabButton
              active={tab === "retours"}
              onClick={() => setTab("retours")}
              icon={<MessageSquare className="size-3.5" aria-hidden />}
              label={`Retours (${subject.comments.length})`}
            />
            <TabButton
              active={tab === "activite"}
              onClick={() => setTab("activite")}
              icon={<Clock className="size-3.5" aria-hidden />}
              label="Activités"
            />
          </div>

          {tab === "retours" ? (
            <CommentThread
              scope={scope}
              subjectId={subject.id}
              comments={subject.comments}
            />
          ) : (
            <ActivityList activity={activity} columns={columns} />
          )}
        </div>
      </div>
    </aside>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
        active
          ? "bg-card text-foreground font-medium"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// --- Carrousel de visuels ----------------------------------------------------

function VisualCarousel({
  subject,
  uploading,
  onUpload,
  onRemove,
}: {
  subject: SubjectRow;
  uploading: boolean;
  onUpload: (file: File) => void;
  onRemove: (path: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const visuals = subject.visuals;
  // L'index peut dépasser après une suppression : on le ramène, sans effet.
  const current = visuals[Math.min(index, Math.max(visuals.length - 1, 0))];

  return (
    <div className="border-border border-b">
      <div className="bg-card relative flex aspect-video items-center justify-center overflow-hidden">
        {current ? (
          <>
            <VisualMedia path={current.path} url={current.url} name={current.name} />

            {visuals.length > 1 ? (
              <>
                <CarouselArrow
                  direction="prev"
                  onClick={() =>
                    setIndex((i) => (i - 1 + visuals.length) % visuals.length)
                  }
                />
                <CarouselArrow
                  direction="next"
                  onClick={() => setIndex((i) => (i + 1) % visuals.length)}
                />
                <div
                  className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1"
                  role="tablist"
                  aria-label="Visuels"
                >
                  {visuals.map((visual, i) => (
                    <button
                      key={visual.path}
                      type="button"
                      role="tab"
                      aria-selected={i === Math.min(index, visuals.length - 1)}
                      aria-label={`Visuel ${i + 1}`}
                      onClick={() => setIndex(i)}
                      className={cn(
                        "size-1.5 rounded-full transition-colors",
                        i === Math.min(index, visuals.length - 1)
                          ? "bg-white"
                          : "bg-white/40",
                      )}
                    />
                  ))}
                </div>
              </>
            ) : null}

            <button
              type="button"
              onClick={() => {
                onRemove(current.path);
                setIndex(0);
              }}
              aria-label={`Retirer ${current.name}`}
              className="bg-background/90 hover:text-brand-red absolute top-2 right-2 rounded-full p-1.5"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">Aucun visuel</p>
        )}
      </div>

      <div className="flex items-center gap-2 px-4 py-2">
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept="image/*,video/mp4,video/quicktime,application/pdf"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload(file);
            event.target.value = "";
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          <Plus className="size-3.5" aria-hidden />
          {uploading ? "Envoi…" : "Ajouter un visuel"}
        </Button>
        {visuals.length > 0 ? (
          <span className="text-muted-foreground ml-auto text-xs tabular-nums">
            {Math.min(index + 1, visuals.length)} / {visuals.length}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Image, vidéo ou pièce jointe — chacun son rendu. */
function VisualMedia({
  path,
  url,
  name,
}: {
  path: string;
  url: string;
  name: string;
}) {
  if (/\.(mp4|mov|webm)(\?|$)/i.test(path) && url) {
    // Lecteur natif : la créa d'un reel se regarde, pas se télécharge.
    return (
      <video src={url} controls playsInline className="size-full object-contain">
        <track kind="captions" />
      </video>
    );
  }

  if (isImagePath(path) && url) {
    // eslint-disable-next-line @next/next/no-img-element -- URL signée
    return <img src={url} alt={name} className="size-full object-contain" />;
  }

  return (
    <a
      href={url || undefined}
      target="_blank"
      rel="noreferrer"
      className="text-muted-foreground p-6 text-center text-sm break-all underline-offset-2 hover:underline"
    >
      {name}
    </a>
  );
}

function CarouselArrow({
  direction,
  onClick,
}: {
  direction: "prev" | "next";
  onClick: () => void;
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "prev" ? "Visuel précédent" : "Visuel suivant"}
      className={cn(
        "bg-background/90 hover:bg-background absolute top-1/2 -translate-y-1/2 rounded-full p-1.5 shadow",
        direction === "prev" ? "left-2" : "right-2",
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

// --- Journal d'activité -------------------------------------------------------

/**
 * L'onglet « Activités » du board : qui a changé quoi, de quoi vers quoi.
 * Les valeurs de statut sont rendues en pastilles colorées, comme à l'écran
 * d'origine — c'est ce qui rend le journal lisible d'un coup d'œil.
 */
function ActivityList({
  activity,
  columns,
}: {
  activity: PlanningActivity[];
  columns: ColumnDef[];
}) {
  if (activity.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Rien encore. Chaque modification s&apos;inscrira ici.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {activity.map((entry) => (
        <li
          key={entry.id}
          className="border-border/60 flex items-center gap-2 rounded-md border px-2.5 py-2"
        >
          <OwnerAvatar owner={entry.actor} />
          <span className="w-24 shrink-0 truncate text-xs font-medium">
            {FIELD_LABELS[entry.field] ?? entry.field}
          </span>

          <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
            <ValueChip field={entry.field} value={entry.before} columns={columns} />
            {entry.field !== "created" ? (
              <ChevronRight
                className="text-muted-foreground size-3 shrink-0"
                aria-hidden
              />
            ) : null}
            <ValueChip field={entry.field} value={entry.after} columns={columns} />
          </span>

          <time
            dateTime={entry.created_at}
            className="text-muted-foreground shrink-0 text-[10px] tabular-nums"
          >
            {new Intl.DateTimeFormat("fr-FR", {
              day: "numeric",
              month: "short",
              timeZone: "Europe/Paris",
            }).format(new Date(entry.created_at))}
          </time>
        </li>
      ))}
    </ul>
  );
}

const FIELD_LABELS: Record<string, string> = {
  created: "Création",
  name: "Sujet",
  status: "Statut",
  format: "Type",
  scheduled_on: "Date",
  wording: "Wording",
  sponsoring: "Sponsorisation",
  ad_objective: "Objectif Ads",
  ad_status: "Statut Ads",
  owner_id: "Propriétaire",
  visual: "Visuel",
};

function ValueChip({
  field,
  value,
  columns,
}: {
  field: string;
  value: string | null;
  columns: ColumnDef[];
}) {
  if (field === "created") {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  if (value === null || value === "") {
    return (
      <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]">
        vide
      </span>
    );
  }

  // Les champs à étiquettes se rendent en pastille colorée.
  const columnKey = field === "scheduled_on" ? "date" : field;
  const column = columns.find((candidate) => candidate.builtin === columnKey);
  const label = column?.labels?.find((candidate) => candidate.id === value);

  if (label) {
    return (
      <span
        className="max-w-32 truncate rounded px-1.5 py-0.5 text-[10px] font-semibold text-white uppercase"
        style={{ backgroundColor: label.color }}
      >
        {label.label}
      </span>
    );
  }

  return (
    <span className="text-foreground max-w-40 truncate text-xs" title={value}>
      {value}
    </span>
  );
}
