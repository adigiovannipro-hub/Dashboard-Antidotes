import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleCheck,
  CirclePlay,
  ExternalLink,
} from "lucide-react";

import { LessonTabs } from "@/components/academy/lesson-tabs";
import { MarkDoneButton } from "@/components/academy/mark-done-button";
import { NotesPanel } from "@/components/academy/notes-panel";
import { ScriptView } from "@/components/academy/script-view";
import { AcademyVideoPlayer } from "@/components/academy/video-player";
import { Panel, PanelBody, PanelHeader, PanelRows } from "@/components/ds/surface";
import { StatusPill } from "@/components/ds/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { requireAcademyAccess } from "@/lib/academy/access";
import { lessonHref, loadAcademyOverview } from "@/lib/academy/overview";
import { getLessonById, getMyNote } from "@/lib/academy/queries";
import { RESOURCE_KIND_LABELS } from "@/lib/academy/types";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

type Params = Promise<{ module: string; lesson: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { module: moduleSlug, lesson: lessonSlug } = await params;
  const context = await requireAcademyAccess();
  const overview = await loadAcademyOverview(context);
  const currentModule = overview?.modules.find(
    (candidate) => candidate.slug === moduleSlug,
  );
  const title = overview?.lessons.find(
    (candidate) =>
      candidate.module_id === currentModule?.id && candidate.slug === lessonSlug,
  )?.title;
  return { title: title ? `${title} · Academy` : "Academy" };
}

/**
 * La page de lecture d'une leçon : la vidéo, le script, les ressources, mes
 * notes — et, à droite, le sommaire du module pour se situer.
 */
export default async function AcademyLessonPage({ params }: { params: Params }) {
  const { module: moduleSlug, lesson: lessonSlug } = await params;
  const context = await requireAcademyAccess();
  const overview = await loadAcademyOverview(context);
  if (!overview) notFound();

  const moduleIndex = overview.modules.findIndex(
    (candidate) => candidate.slug === moduleSlug,
  );
  const currentModule = overview.modules[moduleIndex];
  if (!currentModule) notFound();

  const lite = overview.lessons.find(
    (candidate) =>
      candidate.module_id === currentModule.id && candidate.slug === lessonSlug,
  );
  if (!lite) notFound();

  const [lesson, note] = await Promise.all([
    getLessonById({ lessonId: lite.id }),
    getMyNote({ userId: context.userId, lessonId: lite.id }),
  ]);
  if (!lesson) notFound();

  const position = overview.lessons.findIndex((candidate) => candidate.id === lesson.id);
  const previous = position > 0 ? overview.lessons[position - 1] : null;
  const next =
    position < overview.lessons.length - 1 ? overview.lessons[position + 1] : null;

  const progressRow = overview.progress.get(lesson.id);
  const status = progressRow?.status ?? "not_started";
  const lessonIndexInModule = overview.lessons
    .filter((candidate) => candidate.module_id === currentModule.id)
    .findIndex((candidate) => candidate.id === lesson.id);

  const moduleLessons = overview.lessons.filter(
    (candidate) => candidate.module_id === currentModule.id,
  );

  const adminHref = `/academy/admin?module=${currentModule.slug}&lecon=${lesson.slug}`;

  return (
    <div className="space-y-5">
      <Link
        href={`/academy/${currentModule.slug}`}
        className="type-caption inline-flex items-center gap-1 text-text-secondary hover:text-text-primary"
      >
        <ChevronLeft aria-hidden strokeWidth={1.75} className="size-3.5" />
        Module {moduleIndex + 1} — {currentModule.title}
      </Link>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
          <AcademyVideoPlayer
            lessonId={lesson.id}
            provider={lesson.video_provider}
            videoUrl={lesson.video_url}
            resumeSeconds={progressRow?.watched_seconds ?? 0}
            durationMin={lesson.duration_min}
            initialStatus={status}
            isAdmin={context.isAdmin}
            adminHref={adminHref}
          />

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="type-overline text-text-secondary">
                Leçon {moduleIndex + 1}.{lessonIndexInModule + 1}
              </p>
              <h2 className="type-h2 mt-1 text-text-primary">{lesson.title}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="type-caption text-text-secondary tabular-nums">
                  {formatDuration(lesson.duration_min)}
                </span>
                {status === "completed" ? (
                  <StatusPill tone="positive">Terminée</StatusPill>
                ) : status === "in_progress" ? (
                  <StatusPill tone="info">En cours</StatusPill>
                ) : null}
              </div>
            </div>
            <MarkDoneButton lessonId={lesson.id} done={status === "completed"} />
          </div>

          <div className="flex items-center justify-between gap-3">
            {previous ? (
              <Link
                href={lessonHref(overview, previous)}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "max-w-[45%]")}
              >
                <ChevronLeft data-icon="inline-start" aria-hidden strokeWidth={1.75} />
                <span className="truncate">Leçon précédente</span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={lessonHref(overview, next)}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "max-w-[45%]")}
              >
                <span className="truncate">Leçon suivante</span>
                <ChevronRight data-icon="inline-end" aria-hidden strokeWidth={1.75} />
              </Link>
            ) : (
              <span />
            )}
          </div>

          <Panel>
            <PanelBody>
              <LessonTabs
                resourceCount={lesson.resources.length}
                script={<ScriptView markdown={lesson.script_mdx} />}
                resources={
                  lesson.resources.length === 0 ? (
                    <p className="type-body text-text-secondary">
                      Aucune ressource pour cette leçon.
                    </p>
                  ) : (
                    <ul className="max-w-[72ch] space-y-3">
                      {lesson.resources.map((resource, index) => (
                        <li
                          key={index}
                          className="rounded-md border border-border bg-surface px-4 py-3"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusPill tone="neutral" dot={false}>
                              {RESOURCE_KIND_LABELS[resource.kind] ?? "Ressource"}
                            </StatusPill>
                            {resource.url ? (
                              <a
                                href={resource.url}
                                target="_blank"
                                rel="noreferrer"
                                className="type-body inline-flex items-center gap-1.5 font-medium text-accent-ink underline-offset-2 hover:underline"
                              >
                                {resource.title}
                                <ExternalLink
                                  aria-hidden
                                  strokeWidth={1.75}
                                  className="size-3.5"
                                />
                              </a>
                            ) : (
                              <span className="type-body font-medium text-text-primary">
                                {resource.title}
                              </span>
                            )}
                          </div>
                          {resource.description ? (
                            <p className="type-caption mt-1 text-text-secondary">
                              {resource.description}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )
                }
                notes={
                  <NotesPanel lessonId={lesson.id} initialContent={note?.content ?? ""} />
                }
              />
            </PanelBody>
          </Panel>
        </div>

        <Panel className="lg:sticky lg:top-24">
          <PanelHeader title="Dans ce module" count={moduleLessons.length} />
          <PanelRows>
            {moduleLessons.map((candidate) => {
              const candidateStatus =
                overview.progress.get(candidate.id)?.status ?? "not_started";
              const isCurrent = candidate.id === lesson.id;
              return (
                <Link
                  key={candidate.id}
                  href={lessonHref(overview, candidate)}
                  aria-current={isCurrent ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 px-4 py-2.5 transition-[background-color] duration-(--motion-duration) ease-standard hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                    isCurrent ? "bg-muted" : undefined,
                  )}
                >
                  {candidateStatus === "completed" ? (
                    <CircleCheck
                      aria-hidden
                      strokeWidth={1.75}
                      className="size-4 shrink-0 text-accent-ink"
                    />
                  ) : candidateStatus === "in_progress" ? (
                    <CirclePlay
                      aria-hidden
                      strokeWidth={1.75}
                      className="size-4 shrink-0 text-info-ink"
                    />
                  ) : (
                    <Circle
                      aria-hidden
                      strokeWidth={1.75}
                      className="size-4 shrink-0 text-text-tertiary"
                    />
                  )}
                  <span
                    className={cn(
                      "type-caption min-w-0 flex-1 truncate",
                      isCurrent
                        ? "font-medium text-text-primary"
                        : "text-text-secondary",
                    )}
                  >
                    {candidate.title}
                  </span>
                  <span className="type-caption shrink-0 text-text-tertiary tabular-nums">
                    {candidate.duration_min ? `${candidate.duration_min} min` : ""}
                  </span>
                </Link>
              );
            })}
          </PanelRows>
        </Panel>
      </div>
    </div>
  );
}
