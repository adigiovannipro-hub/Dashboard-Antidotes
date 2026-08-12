"use client";

import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Loader2,
  MessageSquare,
  Plus,
  X,
} from "lucide-react";

import {
  removeVisual,
  reorderVisuals,
  updateSubject,
} from "@/app/actions/planning";
import {
  ChipSelect,
  DateCell,
  OwnerAvatar,
  TextCell,
  useCellAction,
} from "@/components/planning/cells";
import {
  CarouselArrow,
  VisualLightbox,
  VisualSlideMedia,
  useSnapCarousel,
} from "@/components/planning/lightbox";
import { CommentThread, type Scope } from "@/components/planning/subject-row";
import { PlatformIcon } from "@/components/planning/platform-icon";
import { Button } from "@/components/ui/button";
import type { ColumnDef, ColumnLabel } from "@/lib/planning/columns";
import { isImagePath } from "@/lib/planning/storage";
import { uploadVisualsFromBrowser } from "@/lib/planning/upload-client";
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
  closing,
  onClose,
}: {
  scope: Scope;
  subject: SubjectRow;
  columns: ColumnDef[];
  owners: PlanningOwner[];
  /** `null` : le journal arrive encore du serveur — le panneau, lui, est déjà là. */
  activity: PlanningActivity[] | null;
  /** Depuis l'icône de retours d'une ligne : curseur posé dans le champ. */
  autoFocusComment?: boolean;
  /** Joue la glissade de sortie avant le démontage. */
  closing?: boolean;
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
      className={cn(
        "border-border bg-background fixed inset-y-0 right-0 z-40 flex w-full max-w-xl flex-col border-l shadow-xl motion-reduce:animate-none",
        closing
          ? "animate-out slide-out-to-right fill-mode-forwards duration-200"
          : "animate-in slide-in-from-right duration-300",
      )}
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
          onUpload={(files) =>
            run(() => uploadVisualsFromBrowser(scope, subject.id, files))
          }
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
            <ActivityList activity={activity} columns={columns} owners={owners} />
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
 * Le carrousel du panneau : des cartes qui glissent, la suivante qui dépasse.
 *
 * Pas de flou, pas d'aplat noir : chaque visuel est une carte arrondie et
 * bordée, posée sur le fond du panneau. Le scroll est aimanté, le bord de la
 * carte suivante reste visible — l'invitation à glisser — et le clic sur une
 * image passe en plein écran. La bande de vignettes réordonne : l'ordre des
 * vignettes est l'ordre des slides du carrousel publié.
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
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const visuals = subject.visuals;
  const { trackRef, index, scrollTo, onScroll, prev, next } = useSnapCarousel(
    visuals.length,
  );
  const safeIndex = Math.min(index, Math.max(visuals.length - 1, 0));
  const current = visuals[safeIndex];

  const move = (from: number, to: number) => {
    if (to < 0 || to >= visuals.length) return;
    const paths = visuals.map((visual) => visual.path);
    const [moved] = paths.splice(from, 1);
    paths.splice(to, 0, moved!);
    scrollTo(to, false);
    onReorder(paths);
  };

  return (
    <div className="border-border border-b">
      {visuals.length === 0 ? (
        <p className="border-border text-muted-foreground mx-4 mt-3 rounded-xl border border-dashed px-4 py-8 text-center text-sm">
          Aucun visuel pour l&apos;instant.
        </p>
      ) : (
        <div className="relative">
          <div
            ref={trackRef}
            onScroll={onScroll}
            className="flex snap-x snap-mandatory items-center gap-3 overflow-x-auto px-6 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {/* Largeur de diapo fixe (86 %) pour l'aimantation et l'aperçu de
                la suivante ; à l'intérieur, le média prend toute la place que
                ses proportions permettent — une 4:5 remplit la largeur. */}
            {visuals.map((visual, i) => (
              <div
                key={visual.path}
                className="flex w-[86%] shrink-0 snap-center items-center justify-center"
              >
                <VisualSlideMedia
                  visual={visual}
                  className="max-h-[76vh]"
                  onClick={() => {
                    scrollTo(i, false);
                    setExpanded(true);
                  }}
                />
              </div>
            ))}
          </div>

          {visuals.length > 1 ? (
            <>
              <CarouselArrow direction="prev" disabled={safeIndex === 0} onClick={prev} />
              <CarouselArrow
                direction="next"
                disabled={safeIndex === visuals.length - 1}
                onClick={next}
              />
            </>
          ) : null}

          {/* `right-[14%]` : dans la carte active — posés à ras du bord, ces
              boutons semblaient appartenir à la carte qui dépasse. */}
          {current ? (
            <button
              type="button"
              onClick={() => {
                onRemove(current.path);
                scrollTo(0, false);
              }}
              aria-label={`Retirer ${current.name}`}
              className="absolute top-5 right-[14%] z-20 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}

          {visuals.length > 1 ? (
            <span className="absolute right-[14%] bottom-5 z-20 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white tabular-nums">
              {safeIndex + 1} / {visuals.length}
            </span>
          ) : null}
        </div>
      )}

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
      {visuals.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto px-4 py-2" role="list">
          {visuals.map((visual, i) => (
            <div key={visual.path} role="listitem" className="group/thumb relative shrink-0">
              <button
                type="button"
                onClick={() => scrollTo(i)}
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
          accept="image/*,video/mp4,video/quicktime,video/webm,application/pdf"
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

// --- Journal d'activité -------------------------------------------------------

/**
 * L'onglet « Activités » du board : qui a fait quoi, en toutes lettres —
 * « Alessandro a ajouté un visuel », « a changé le statut » avec les pastilles
 * avant → après. Les valeurs à étiquettes gardent leurs couleurs, et un
 * propriétaire s'affiche par son nom, pas par son identifiant.
 */
function ActivityList({
  activity,
  columns,
  owners,
}: {
  /** `null` : le journal arrive encore du serveur. */
  activity: PlanningActivity[] | null;
  columns: ColumnDef[];
  owners: PlanningOwner[];
}) {
  if (activity === null) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        Chargement du journal…
      </p>
    );
  }

  if (activity.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Rien encore. Chaque modification s&apos;inscrira ici.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {activity.map((entry) => {
        const withValues = !NO_VALUE_FIELDS.has(entry.field);
        return (
          <li
            key={entry.id}
            className="border-border/60 rounded-md border px-2.5 py-2"
          >
            <div className="flex items-center gap-2">
              <OwnerAvatar owner={entry.actor} />
              <p className="min-w-0 flex-1 truncate text-xs">
                <span className="font-medium">
                  {entry.actor?.full_name ?? entry.actor?.email ?? "Quelqu'un"}
                </span>{" "}
                <span className="text-muted-foreground">
                  {FIELD_SENTENCES[entry.field] ?? `a modifié « ${entry.field} »`}
                </span>
              </p>
              <time
                dateTime={entry.created_at}
                className="text-muted-foreground shrink-0 text-[10px] tabular-nums"
              >
                {entry.created_label}
              </time>
            </div>

            {withValues ? (
              <div className="mt-1.5 flex items-center gap-1.5 pl-8">
                <ValueChip
                  field={entry.field}
                  value={entry.before}
                  columns={columns}
                  owners={owners}
                />
                <ArrowRight
                  className="text-muted-foreground size-3 shrink-0"
                  aria-hidden
                />
                <ValueChip
                  field={entry.field}
                  value={entry.after}
                  columns={columns}
                  owners={owners}
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Les gestes qui se suffisent : la phrase dit tout, pas de avant → après. */
const NO_VALUE_FIELDS = new Set([
  "created",
  "archived",
  "restored",
  "deleted",
]);

const FIELD_SENTENCES: Record<string, string> = {
  created: "a créé la publication",
  name: "a renommé le sujet",
  status: "a changé le statut",
  format: "a changé le type",
  scheduled_on: "a déplacé la date",
  wording: "a modifié le wording",
  sponsoring: "a modifié la sponsorisation",
  ad_objective: "a changé l'objectif publicitaire",
  ad_status: "a changé le statut publicitaire",
  owner_id: "a changé le propriétaire",
  visual: "a ajouté un visuel",
  moved: "a déplacé la publication",
  archived: "a archivé la publication",
  restored: "a restauré la publication",
  deleted: "a envoyé la publication à la corbeille",
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
  owners,
}: {
  field: string;
  value: string | null;
  columns: ColumnDef[];
  owners: PlanningOwner[];
}) {
  if (value === null || value === "") {
    return (
      <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]">
        vide
      </span>
    );
  }

  // Un identifiant de propriétaire se lit par son nom.
  if (field === "owner_id") {
    const owner = owners.find((candidate) => candidate.id === value);
    return (
      <span className="text-foreground max-w-40 truncate text-xs">
        {owner?.full_name ?? owner?.email ?? "un membre"}
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
