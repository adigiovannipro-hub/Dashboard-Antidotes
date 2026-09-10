"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Panel, PanelBody, PanelHeader } from "@/components/ds/surface";
import { buttonVariants } from "@/components/ui/button";
import { buildCalendarMonth, groupByDay, monthKeyOf, WEEKDAY_LABELS } from "@/lib/antidotes/inbound/calendar";
import { GENERATED_POST_FORMAT_LABELS, type GeneratedPost } from "@/lib/antidotes/types";
import { cn } from "@/lib/utils";

/**
 * Le mois, comme le planning éditorial d'un client : c'est là qu'on décide
 * quand un post part. Un brouillon programmé se pose à sa date, un publié à
 * la sienne — la même grille dit ce qui est fait et ce qui vient.
 *
 * Les jours sont calculés en UTC (`calendar.ts`) ; l'heure d'un post
 * s'affiche en heure de Paris, parce que c'est celle qu'on lit.
 */

const PARIS_TIME = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

export function InboundCalendar({
  month,
  drafts,
  now,
}: {
  month: string;
  drafts: GeneratedPost[];
  /** L'instant de la lecture serveur : le jour surligné doit être le même au
      rendu serveur et après hydratation. */
  now: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const grid = useMemo(() => buildCalendarMonth(month), [month]);
  const dated = useMemo(
    () => drafts.filter((draft) => draft.scheduled_at ?? draft.published_at),
    [drafts],
  );
  const byDay = useMemo(
    () => groupByDay(dated, (draft) => draft.published_at ?? draft.scheduled_at),
    [dated],
  );
  const undated = useMemo(
    () => drafts.filter((draft) => !draft.scheduled_at && !draft.published_at && draft.status !== "rejected"),
    [drafts],
  );
  const today = new Date(now).toISOString().slice(0, 10);

  const monthHref = (key: string) => {
    const query = new URLSearchParams(params.toString());
    query.set("vue", "calendrier");
    query.set("mois", key);
    for (const item of ["post", "brouillon", "sujet", "mien"]) query.delete(item);
    return `${pathname}?${query.toString()}`;
  };

  const openDraft = (id: string) => {
    const query = new URLSearchParams(params.toString());
    for (const item of ["post", "sujet", "mien"]) query.delete(item);
    query.set("brouillon", id);
    router.push(`${pathname}?${query.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader
          title={grid.label}
          count={dated.length}
          action={
            <div className="flex items-center gap-1">
              <Link
                href={monthHref(grid.previous)}
                aria-label="Mois précédent"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden />
              </Link>
              <Link href={monthHref(monthKeyOf(new Date(now)))} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Aujourd&apos;hui
              </Link>
              <Link
                href={monthHref(grid.next)}
                aria-label="Mois suivant"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
              </Link>
            </div>
          }
        />
        <div className="overflow-x-auto">
          <div className="min-w-[44rem] p-5">
            <div className="grid grid-cols-7 gap-px">
              {WEEKDAY_LABELS.map((label) => (
                <p key={label} className="type-overline px-2 pb-2 text-text-secondary">
                  {label}
                </p>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md bg-border-strong">
              {grid.weeks.flat().map((day) => {
                const items = byDay.get(day.date) ?? [];
                return (
                  <div
                    key={day.date}
                    className={cn(
                      "min-h-24 bg-surface p-1.5",
                      !day.inMonth && "bg-surface-sunken",
                      day.date === today && "ring-1 ring-inset ring-accent-ink",
                    )}
                  >
                    <p
                      className={cn(
                        "type-caption px-1 tabular-nums",
                        day.inMonth ? "text-text-secondary" : "text-text-tertiary",
                        day.date === today && "font-medium text-accent-ink",
                      )}
                    >
                      {day.day}
                    </p>
                    <ul className="mt-1 space-y-1">
                      {items.map((draft) => (
                        <li key={draft.id}>
                          <button
                            type="button"
                            onClick={() => openDraft(draft.id)}
                            className="focus-visible:ring-ring w-full rounded-sm bg-surface-sunken p-1.5 text-left transition-colors duration-(--motion-duration) ease-standard hover:bg-muted focus-visible:ring-2 focus-visible:outline-none"
                          >
                            <span className="type-caption flex items-center gap-1.5 text-text-secondary">
                              <span
                                aria-hidden
                                className={cn(
                                  "size-1.5 shrink-0 rounded-pill",
                                  draft.format === "reel_script" ? "bg-[var(--ordinal-2)]" : "bg-[var(--ordinal-1)]",
                                )}
                              />
                              <span className="truncate">
                                {draft.published_at
                                  ? "Publié"
                                  : draft.scheduled_at
                                    ? PARIS_TIME.format(new Date(draft.scheduled_at))
                                    : ""}
                              </span>
                            </span>
                            <span className="type-caption mt-0.5 line-clamp-2 text-text-primary">{draft.content}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            <p className="type-caption mt-3 flex flex-wrap items-center gap-4 text-text-secondary">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-1.5 rounded-pill bg-[var(--ordinal-1)]" />
                {GENERATED_POST_FORMAT_LABELS.linkedin_post}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-1.5 rounded-pill bg-[var(--ordinal-2)]" />
                {GENERATED_POST_FORMAT_LABELS.reel_script}
              </span>
            </p>
          </div>
        </div>
      </Panel>

      {undated.length > 0 ? (
        <Panel>
          <PanelHeader title="Sans date" count={undated.length} description="À poser dans le mois" />
          <PanelBody className="flex flex-wrap gap-2">
            {undated.map((draft) => (
              <button
                key={draft.id}
                type="button"
                onClick={() => openDraft(draft.id)}
                className="focus-visible:ring-ring max-w-xs rounded-md border border-border bg-surface px-3 py-2 text-left transition-colors duration-(--motion-duration) ease-standard hover:bg-muted focus-visible:ring-2 focus-visible:outline-none"
              >
                <span className="type-caption block text-text-secondary">
                  {GENERATED_POST_FORMAT_LABELS[draft.format]}
                </span>
                <span className="type-caption line-clamp-2 text-text-primary">{draft.topic ?? draft.content}</span>
              </button>
            ))}
          </PanelBody>
        </Panel>
      ) : null}
    </div>
  );
}
