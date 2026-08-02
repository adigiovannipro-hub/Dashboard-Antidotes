"use client";

import { Fragment } from "react";
import { AlertTriangle, ImageOff, PenLine, Upload } from "lucide-react";

import { FormatBadge, StatusBadge } from "@/components/planning/badges";
import { PLATFORM_LABELS, PLATFORM_ORDER, hasWording } from "@/lib/planning/types";
import type { PlanningPlatform, SubjectWithLane } from "@/lib/planning/types";
import { cn } from "@/lib/utils";

/**
 * Le mois, en couloirs par plateforme.
 *
 * Monday empile les sous-éléments dans des groupes repliés : il faut cliquer
 * partout pour savoir où en est le mois. Ici tout est déplié d'un coup, dans
 * l'ordre des dates, avec les manques visibles sans ouvrir quoi que ce soit.
 */

const WEEKDAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

export function MonthGrid({
  subjects,
  flagged,
  selectedId,
  onSelect,
}: {
  subjects: SubjectWithLane[];
  /** Sujets pointés par une anomalie de cadence. */
  flagged: Set<string>;
  selectedId: string | null;
  onSelect: (subjectId: string) => void;
}) {
  if (subjects.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center p-10 text-sm">
        Aucun contenu pour ce mois.
      </div>
    );
  }

  const platforms = PLATFORM_ORDER.filter((platform) =>
    subjects.some((subject) => subject.platform === platform),
  );

  return (
    <div className="min-w-0 flex-1 overflow-y-auto p-4">
      <div className="space-y-6">
        {platforms.map((platform) => (
          <Lane
            key={platform}
            platform={platform}
            subjects={subjects.filter((subject) => subject.platform === platform)}
            flagged={flagged}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function Lane({
  platform,
  subjects,
  flagged,
  selectedId,
  onSelect,
}: {
  platform: PlanningPlatform;
  subjects: SubjectWithLane[];
  flagged: Set<string>;
  selectedId: string | null;
  onSelect: (subjectId: string) => void;
}) {
  const live = subjects.filter((subject) => subject.status !== "dropped");

  return (
    <section aria-labelledby={`lane-${platform}`}>
      <div className="mb-2 flex items-baseline gap-2">
        <h2
          id={`lane-${platform}`}
          className="text-xs font-medium tracking-wide uppercase"
        >
          {PLATFORM_LABELS[platform]}
        </h2>
        <span className="text-muted-foreground text-xs tabular-nums">
          {live.length} contenu{live.length > 1 ? "s" : ""}
        </span>
      </div>

      <ul className="space-y-1">
        {subjects.map((subject) => (
          <li key={subject.id}>
            <SubjectRow
              subject={subject}
              flagged={flagged.has(subject.id)}
              selected={subject.id === selectedId}
              onSelect={onSelect}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function SubjectRow({
  subject,
  flagged,
  selected,
  onSelect,
}: {
  subject: SubjectWithLane;
  flagged: boolean;
  selected: boolean;
  onSelect: (subjectId: string) => void;
}) {
  const missingWording = !hasWording(subject);
  const missingVisual = subject.visual_urls.length === 0;
  const pending = subject.pending_wording !== null;

  return (
    <button
      type="button"
      onClick={() => onSelect(subject.id)}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
        selected ? "bg-card" : "hover:bg-card/60",
        // Le surlignage d'une anomalie est un filet, pas un fond : il doit se
        // voir sans écraser la lecture de la ligne.
        flagged && "ring-brand-red/30 ring-1 ring-inset",
      )}
    >
      <DayChip date={subject.scheduled_on} />

      <FormatBadge format={subject.format} className="w-16" />

      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm",
          subject.status === "dropped" && "text-muted-foreground line-through",
        )}
      >
        {subject.name}
      </span>

      <span className="text-muted-foreground flex shrink-0 items-center gap-1.5">
        {missingWording ? (
          <PenLine className="size-3.5" aria-label="Wording à écrire" />
        ) : null}
        {missingVisual ? (
          <ImageOff className="size-3.5" aria-label="Visuel manquant" />
        ) : null}
        {pending ? (
          <Upload
            className="text-brand size-3.5"
            aria-label="Wording en attente d'envoi"
          />
        ) : null}
        {flagged ? (
          <AlertTriangle
            className="text-brand-red size-3.5"
            aria-label="Signalé par le contrôle de cadence"
          />
        ) : null}
      </span>

      {subject.sponsoring ? (
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {new Intl.NumberFormat("fr-FR", {
            style: "currency",
            currency: "EUR",
            maximumFractionDigits: 0,
          }).format(subject.sponsoring)}
        </span>
      ) : null}

      <StatusBadge status={subject.status} raw={subject.status_raw} />
    </button>
  );
}

/** Jour et abréviation, ou un tiret pour un contenu sans date. */
function DayChip({ date }: { date: string | null }) {
  if (!date) {
    return (
      <span className="text-muted-foreground w-14 shrink-0 text-xs">
        sans date
      </span>
    );
  }

  const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]!;
  const day = Number(date.slice(8, 10));
  const isWeekend = weekday === "sam." || weekday === "dim.";

  return (
    <span
      className={cn(
        "w-14 shrink-0 text-xs tabular-nums",
        isWeekend ? "text-brand-red" : "text-muted-foreground",
      )}
    >
      <Fragment>
        {weekday} {day}
      </Fragment>
    </span>
  );
}
