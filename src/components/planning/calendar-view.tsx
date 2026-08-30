"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { PlatformIcon } from "@/components/planning/platform-icon";
import { isImagePath } from "@/lib/planning/storage";
import {
  PLATFORM_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  type MonthWithLanes,
  type PlanningPlatform,
  type PlanningStatus,
  type SubjectRow,
} from "@/lib/planning/types";
import { cn } from "@/lib/utils";

/**
 * La vue calendrier du planning : un mois en grille de jours, les mois
 * voisins au bout des flèches — la page glisse de l'un à l'autre.
 *
 * Chaque publication tient en une ligne compacte : la marque du réseau, la
 * première créa en vignette, le sujet. Le clic ouvre le panneau habituel —
 * c'est lui qui porte le détail, la case n'a pas à le répéter. La colonne de
 * droite compte le mois affiché : total, réseaux, statuts.
 *
 * Tous les calculs de dates sont en UTC, comme partout : un mois qui
 * commencerait à minuit heure de Paris décalerait la grille entière.
 */

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

type CalendarSubject = SubjectRow & { platform: PlanningPlatform };

/** Les publications du mois, rangées par jour `YYYY-MM-DD`. */
function subjectsByDay(month: MonthWithLanes): Map<string, CalendarSubject[]> {
  const byDay = new Map<string, CalendarSubject[]>();
  for (const lane of month.lanes) {
    for (const subject of lane.subjects) {
      if (subject.status === "dropped" || !subject.scheduled_on) continue;
      const list = byDay.get(subject.scheduled_on) ?? [];
      list.push(subject as CalendarSubject);
      byDay.set(subject.scheduled_on, list);
    }
  }
  return byDay;
}

function undatedCount(month: MonthWithLanes): number {
  return month.lanes.reduce(
    (count, lane) =>
      count +
      lane.subjects.filter(
        (subject) => subject.status !== "dropped" && !subject.scheduled_on,
      ).length,
    0,
  );
}

/** Les cases de la grille : nulls d'alignement puis un `YYYY-MM-DD` par jour. */
function monthDays(monthKey: string): (string | null)[] {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7)) - 1;
  const first = new Date(Date.UTC(year, month, 1));
  const dayCount = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  // Semaine française : lundi en tête.
  const lead = (first.getUTCDay() + 6) % 7;

  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= dayCount; day += 1) {
    cells.push(`${monthKey.slice(0, 7)}-${String(day).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function CalendarView({
  months,
  initialMonthKey,
  onOpenSubject,
}: {
  months: MonthWithLanes[];
  /** Le mois ouvert à l'arrivée — le mois courant quand il existe. */
  initialMonthKey: string;
  onOpenSubject: (subjectId: string) => void;
}) {
  const ordered = [...months].sort((a, b) => a.month.localeCompare(b.month));
  const initialIndex = Math.max(
    0,
    ordered.findIndex((month) => month.month === initialMonthKey),
  );
  const [index, setIndex] = useState(initialIndex);
  // La direction d'arrivée du mois : la grille se monte décalée de ce côté,
  // puis glisse en place — voir l'effet ci-dessous.
  const [entering, setEntering] = useState<0 | 1 | -1>(0);

  useEffect(() => {
    if (entering === 0) return;
    const frame = requestAnimationFrame(() => setEntering(0));
    return () => cancelAnimationFrame(frame);
  }, [entering]);

  const current = ordered[Math.min(index, ordered.length - 1)];
  if (!current) {
    return (
      <p className="type-body rounded-lg border border-dashed border-border p-10 text-center text-text-secondary">
        Aucun mois à afficher.
      </p>
    );
  }

  const go = (delta: 1 | -1) => {
    setIndex((currentIndex) => {
      const next = currentIndex + delta;
      if (next < 0 || next >= ordered.length) return currentIndex;
      setEntering(delta);
      return next;
    });
  };

  const byDay = subjectsByDay(current);
  const cells = monthDays(current.month);
  const undated = undatedCount(current);

  const monthSubjects = current.lanes.flatMap((lane) =>
    lane.subjects.filter((subject) => subject.status !== "dropped"),
  );
  const byPlatform = new Map<PlanningPlatform, number>();
  for (const lane of current.lanes) {
    const live = lane.subjects.filter((subject) => subject.status !== "dropped");
    if (live.length > 0) {
      byPlatform.set(lane.platform, (byPlatform.get(lane.platform) ?? 0) + live.length);
    }
  }
  const byStatus = new Map<string, number>();
  for (const subject of monthSubjects) {
    byStatus.set(subject.status, (byStatus.get(subject.status) ?? 0) + 1);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
      <section
        aria-label={`Calendrier de ${current.label}`}
        className="border-border-strong overflow-hidden rounded-xl border bg-surface shadow-card"
      >
        <header className="border-border-strong flex items-center gap-2 border-b px-3 py-2.5">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={index === 0}
            aria-label="Mois précédent"
            className="hover:bg-muted focus-visible:ring-ring rounded p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-30"
          >
            <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden />
          </button>
          <h3 className="type-label min-w-32 text-center font-bold tracking-wider uppercase">
            {current.label}
          </h3>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={index === ordered.length - 1}
            aria-label="Mois suivant"
            className="hover:bg-muted focus-visible:ring-ring rounded p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-30"
          >
            <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
          </button>

          {undated > 0 ? (
            <span className="type-caption ml-auto text-text-secondary">
              {undated} sans date — visibles en vue tableau
            </span>
          ) : null}
        </header>

        {/* Clé sur le mois : la grille remonte entière, décalée du côté d'où
            elle vient, et glisse en place — le geste de feuilleter. */}
        <div className="overflow-hidden">
          <div
            key={current.id}
            className={cn(
              "transition-[transform,opacity] duration-(--motion-duration-slow) ease-exit motion-reduce:transition-none",
              entering === 1 && "translate-x-8 opacity-0",
              entering === -1 && "-translate-x-8 opacity-0",
            )}
          >
            <div className="border-border grid grid-cols-7 border-b bg-surface-sunken">
              {WEEKDAYS.map((day) => (
                <span
                  key={day}
                  className="type-overline px-2 py-1.5 text-center text-text-secondary"
                >
                  {day}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {cells.map((day, cellIndex) => (
                <div
                  key={day ?? `vide-${cellIndex}`}
                  className={cn(
                    "border-border min-h-24 border-b p-1.5",
                    cellIndex % 7 !== 0 && "border-l",
                    !day && "bg-surface-sunken/40",
                  )}
                >
                  {day ? (
                    <>
                      <p className="type-caption mb-1 text-right text-text-secondary tabular-nums">
                        {Number(day.slice(8, 10))}
                      </p>
                      <div className="space-y-1">
                        {(byDay.get(day) ?? []).map((subject) => (
                          <CalendarSubjectChip
                            key={subject.id}
                            subject={subject}
                            onOpen={() => onOpenSubject(subject.id)}
                          />
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Les totaux du mois affiché, à droite de la grille. */}
      <aside
        aria-label={`Totaux de ${current.label}`}
        className="border-border-strong h-fit space-y-4 rounded-xl border bg-surface p-4 shadow-card"
      >
        <div>
          <p className="type-overline text-text-secondary">Publications</p>
          <p className="type-stat mt-0.5 tabular-nums">{monthSubjects.length}</p>
        </div>

        {byPlatform.size > 0 ? (
          <ul className="space-y-1.5">
            {[...byPlatform.entries()].map(([platform, count]) => (
              <li key={platform} className="flex items-center gap-2">
                <PlatformIcon platform={platform} />
                <span className="type-caption min-w-0 flex-1 truncate text-text-secondary">
                  {PLATFORM_LABELS[platform]}
                </span>
                <span className="type-label tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {byStatus.size > 0 ? (
          <ul className="border-border space-y-1 border-t pt-3">
            {[...byStatus.entries()].map(([status, count]) => (
              <li key={status} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-pill"
                  style={{
                    backgroundColor:
                      STATUS_COLORS[status as keyof typeof STATUS_COLORS] ??
                      "var(--border-strong)",
                  }}
                />
                <span className="type-caption min-w-0 flex-1 truncate text-text-secondary">
                  {STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status}
                </span>
                <span className="type-caption tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </aside>
    </div>
  );
}

/**
 * Une publication dans sa case : réseau, vignette de la première créa, sujet.
 * Une ligne, pas plus — le panneau porte le reste.
 */
function CalendarSubjectChip({
  subject,
  onOpen,
}: {
  subject: CalendarSubject;
  onOpen: () => void;
}) {
  const visual = subject.visuals.find((entry) => isImagePath(entry.path));
  const label = subject.name || subject.wording?.replace(/\s+/g, " ") || "Sans titre";

  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${label} — ${STATUS_LABELS[subject.status as PlanningStatus] ?? subject.status}`}
      className="border-border bg-background hover:bg-surface-sunken focus-visible:ring-ring flex w-full min-w-0 items-center gap-1 rounded-md border px-1 py-0.5 text-left transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none"
    >
      <PlatformIcon platform={subject.platform} className="scale-75" />
      {visual ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL signée
        <img
          src={visual.url}
          alt=""
          aria-hidden
          className="size-4 shrink-0 rounded-sm object-cover"
        />
      ) : null}
      <span className="type-caption min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}
