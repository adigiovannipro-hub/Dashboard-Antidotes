"use client";

import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Clock,
  MessageSquare,
  Plus,
  X,
} from "lucide-react";

import {
  removeVisual,
  reorderVisuals,
  updateSubject,
  uploadVisual,
} from "@/app/actions/planning";
import {
  ChipSelect,
  DateCell,
  OwnerAvatar,
  TextCell,
  useCellAction,
} from "@/components/planning/cells";
import { VisualLightbox } from "@/components/planning/lightbox";
import { CommentThread, type Scope } from "@/components/planning/subject-row";
import { PlatformIcon } from "@/components/planning/platform-icon";
import { Button } from "@/components/ui/button";
import type { ColumnDef, ColumnLabel } from "@/lib/planning/columns";
import { isImagePath } from "@/lib/planning/storage";
import type {
  PlanningActivity,
  PlanningOwner,
  SubjectRow,
} from "@/lib/planning/types";
import { cn } from "@/lib/utils";

/**
 * Le panneau latéral d'une publication — l'écran d'ouverture d'un élément sur
 * Monday, en une colonne à droite.
 *
 * Trois zones, dans l'ordre où on les regarde : le visuel (grand, sur fond
 * sombre — une créa se juge sur un aplat neutre, pas sur du blanc), le contenu
 * (sujet, wording, statut, type, date), et les deux fils — retours du client,
 * journal d'activité.
 */
export function SubjectDrawer({
  scope,
  subject,
  columns,
  owners,
  activity,
  autoFocusComment,
  onClose,
}: {
  scope: Scope;
  subject: SubjectRow;
  columns: ColumnDef[];
  owners: PlanningOwner[];
  activity: PlanningActivity[];
  /** Depuis l'icône de retours d'une ligne : curseur posé dans le champ. */
  autoFocusComment?: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"retours" | "activite">("retours");
  const { run, pending } = useCellAction();
  const [wording, setWording] = useState(subject.wording ?? "");

  const labelsOf = (builtin: string) =>
    (columns.find((column) => column.builtin === builtin)?.labels ?? []).map(
      (label) => ({ value: label.id, label: label.label, color: label.color }),
    );

  return (
    <aside
      aria-label={`Détail de ${subject.name || "la publication"}`}
      className="border-border bg-background animate-in slide-in-from-right fixed inset-y-0 right-0 z-40 flex w-full max-w-xl flex-col border-l shadow-xl duration-300 motion-reduce:animate-none"
    >
      {/* --- En-tête : le sujet s'y modifie, comme dans le tableau --- */}
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
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs tracking-wide uppercase">
            <PlatformIcon platform={subject.platform} />
            {subject.lane_name}
          </p>
          <TextCell
            value={subject.name}
            ariaLabel="Sujet de la publication"
            placeholder="Sans sujet…"
            className="text-lg leading-snug font-semibold"
            onCommit={(next) =>
              run(() =>
                updateSubject(scope, {
                  subjectId: subject.id,
                  field: "name",
                  value: next,
                }),
              )
            }
          />
        </div>

        <OwnerAvatar owner={subject.owner} />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <VisualCarousel
          subject={subject}
          uploading={pending}
          onUpload={(files) => {
            const formData = new FormData();
            formData.set("subjectId", subject.id);
            for (const file of files) formData.append("file", file);
            run(() => uploadVisual(scope, formData));
          }}
          onRemove={(path) =>
            run(() => removeVisual(scope, { subjectId: subject.id, path }))
          }
          onReorder={(paths) =>
            run(() => reorderVisuals(scope, { subjectId: subject.id, paths }))
          }
        />

        {/* --- Statut, type, date --- */}
        <div className="border-border grid grid-cols-3 gap-2 border-b p-4">
          <div>
            <p className="text-muted-foreground mb-1 text-[11px] uppercase">Statut</p>
            <ChipSelect<string>
              value={subject.status === "idea" ? null : subject.status}
              options={labelsOf("status")}
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
            <ChipSelect<string>
              value={subject.format === "other" ? null : subject.format}
              options={labelsOf("format")}
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
              members={owners}
              autoFocus={autoFocusComment}
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

/**
 * Le carrousel : grand média sur fond sombre, et la bande de vignettes en
 * dessous — scrollable à l'horizontale, chaque vignette déplaçable de ses deux
 * flèches. L'ordre des vignettes est l'ordre des slides du carrousel publié :
 * le réordonner ici, c'est réordonner la publication.
 */
function VisualCarousel({
  subject,
  uploading,
  onUpload,
  onRemove,
  onReorder,
}: {
  subject: SubjectRow;
  uploading: boolean;
  onUpload: (files: File[]) => void;
  onRemove: (path: string) => void;
  onReorder: (paths: string[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const visuals = subject.visuals;
  const safeIndex = Math.min(index, Math.max(visuals.length - 1, 0));
  const current = visuals[safeIndex];
  const currentIsImage = current ? isImagePath(current.path) && !!current.url : false;

  const move = (from: number, to: number) => {
    if (to < 0 || to >= visuals.length) return;
    const paths = visuals.map((visual) => visual.path);
    const [moved] = paths.splice(from, 1);
    paths.splice(to, 0, moved!);
    setIndex(to);
    onReorder(paths);
  };

  return (
    <div className="border-border border-b">
      {/* Une créa se regarde en grand — et sans bandes mortes sur les côtés :
          le fond est le visuel lui-même, couvrant et flouté. Le clic sur
          l'image passe en plein écran. Sans visuel, l'aplat sombre se réduit :
          420 px de noir vide écrasaient le panneau. */}
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden bg-neutral-950",
          current ? "h-[420px]" : "h-28",
        )}
      >
        {current ? (
          <>
            {currentIsImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL signée
              <img
                src={current.url}
                alt=""
                aria-hidden
                className="absolute inset-0 size-full scale-110 object-cover opacity-50 blur-2xl"
              />
            ) : null}

            {currentIsImage ? (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                title="Afficher en plein écran"
                aria-label={`Afficher ${current.name} en plein écran`}
                className="relative z-10 flex size-full cursor-zoom-in items-center justify-center outline-none"
              >
                <VisualMedia path={current.path} url={current.url} name={current.name} />
              </button>
            ) : (
              <span className="relative z-10 flex size-full items-center justify-center">
                <VisualMedia path={current.path} url={current.url} name={current.name} />
              </span>
            )}

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
              </>
            ) : null}

            <button
              type="button"
              onClick={() => {
                onRemove(current.path);
                setIndex(0);
              }}
              aria-label={`Retirer ${current.name}`}
              className="absolute top-2 right-2 z-10 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
            >
              <X className="size-3.5" aria-hidden />
            </button>

            <span className="absolute bottom-2 right-2 z-10 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white tabular-nums">
              {safeIndex + 1} / {visuals.length}
            </span>
          </>
        ) : (
          <p className="text-sm text-neutral-400">Aucun visuel</p>
        )}
      </div>

      {expanded ? (
        <VisualLightbox
          visuals={visuals}
          initialIndex={safeIndex}
          subjectName={subject.name}
          uploading={uploading}
          onClose={() => setExpanded(false)}
          onUpload={onUpload}
          onRemove={onRemove}
        />
      ) : null}

      {/* La bande de vignettes : scroll horizontal, flèches de réordonnancement. */}
      {visuals.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto px-4 py-2" role="list">
          {visuals.map((visual, i) => (
            <div key={visual.path} role="listitem" className="group/thumb relative shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Visuel ${i + 1}`}
                aria-current={i === safeIndex}
                className={cn(
                  "block size-14 overflow-hidden rounded-md border-2 transition-colors",
                  i === safeIndex ? "border-brand" : "border-transparent",
                )}
              >
                {isImagePath(visual.path) && visual.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL signée
                  <img
                    src={visual.url}
                    alt=""
                    className="size-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="bg-card text-muted-foreground flex size-full items-center justify-center p-1 text-center text-[8px] break-all">
                    {visual.name.slice(0, 18)}
                  </span>
                )}
              </button>

              <span className="absolute inset-x-0 -bottom-0.5 flex justify-center gap-0.5 opacity-0 transition-opacity group-hover/thumb:opacity-100">
                <button
                  type="button"
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                  aria-label={`Avancer le visuel ${i + 1}`}
                  className="rounded bg-black/70 p-0.5 text-white disabled:opacity-30"
                >
                  <ArrowLeft className="size-3" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, i + 1)}
                  disabled={i === visuals.length - 1}
                  aria-label={`Reculer le visuel ${i + 1}`}
                  className="rounded bg-black/70 p-0.5 text-white disabled:opacity-30"
                >
                  <ArrowRight className="size-3" aria-hidden />
                </button>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-2 px-4 pt-1 pb-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          accept="image/*,video/mp4,video/quicktime,application/pdf"
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            if (files.length > 0) onUpload(files);
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
          {uploading ? "Envoi…" : "Ajouter des visuels"}
        </Button>
        <span className="text-muted-foreground text-xs">
          Plusieurs fichiers à la fois. Les flèches d&apos;une vignette changent
          l&apos;ordre du carrousel.
        </span>
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
      className="p-6 text-center text-sm break-all text-neutral-300 underline-offset-2 hover:underline"
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
  const Icon = direction === "prev" ? ArrowLeft : ArrowRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "prev" ? "Visuel précédent" : "Visuel suivant"}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80",
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
 * Les valeurs à étiquettes se rendent en pastilles colorées — c'est ce qui rend
 * le journal lisible d'un coup d'œil.
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
            {entry.created_label}
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

const FIELD_TO_BUILTIN: Record<string, string> = {
  status: "status",
  format: "format",
  ad_objective: "objective",
  ad_status: "ad_status",
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

  const builtin = FIELD_TO_BUILTIN[field];
  const column = columns.find((candidate) => candidate.builtin === builtin);
  const label: ColumnLabel | undefined = column?.labels?.find(
    (candidate) => candidate.id === value,
  );

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
