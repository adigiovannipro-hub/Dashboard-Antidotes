import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { ProgressBar } from "@/components/academy/progress-bar";
import { Panel, PanelHeader, PanelRows, SectionHeader } from "@/components/ds/surface";
import { StatusPill, type StatusTone } from "@/components/ds/status-pill";
import { requireAcademyAccess } from "@/lib/academy/access";
import { loadAcademyOverview } from "@/lib/academy/overview";
import { completionOf } from "@/lib/academy/progress";
import type { AcademyProgressStatus } from "@/lib/academy/types";
import { formatMinutes } from "@/lib/format";

type Params = Promise<{ module: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { module: moduleSlug } = await params;
  const context = await requireAcademyAccess();
  const overview = await loadAcademyOverview(context);
  const title = overview?.modules.find((module) => module.slug === moduleSlug)?.title;
  return { title: title ? `${title} · Academy` : "Academy" };
}

const ROW_TONES: Record<AcademyProgressStatus, { tone: StatusTone; label: string }> = {
  completed: { tone: "positive", label: "Terminée" },
  in_progress: { tone: "info", label: "En cours" },
  not_started: { tone: "neutral", label: "À suivre" },
};

/** La liste des leçons d'un module, avec leur durée et leur statut. */
export default async function AcademyModulePage({ params }: { params: Params }) {
  const { module: moduleSlug } = await params;
  const context = await requireAcademyAccess();
  const overview = await loadAcademyOverview(context);
  if (!overview) notFound();

  const moduleIndex = overview.modules.findIndex(
    (candidate) => candidate.slug === moduleSlug,
  );
  const currentModule = overview.modules[moduleIndex];
  if (!currentModule) notFound();

  const lessons = overview.lessons.filter(
    (lesson) => lesson.module_id === currentModule.id,
  );
  const completion = completionOf(lessons, overview.progress);
  const minutes = lessons.reduce((sum, lesson) => sum + (lesson.duration_min ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/academy"
          className="type-caption inline-flex items-center gap-1 text-text-secondary hover:text-text-primary"
        >
          <ChevronLeft aria-hidden strokeWidth={1.75} className="size-3.5" />
          Tous les modules
        </Link>
        <SectionHeader
          className="mt-2"
          title={`Module ${moduleIndex + 1} — ${currentModule.title}`}
          description={currentModule.description ?? undefined}
        />
        <div className="mt-3 flex items-center gap-3">
          <ProgressBar
            percent={completion.percent}
            label={`Progression du module ${currentModule.title}`}
            className="max-w-64"
          />
          <span className="type-caption text-text-secondary tabular-nums">
            {completion.completed} / {completion.total} leçons · {formatMinutes(minutes)}
          </span>
        </div>
      </div>

      <Panel>
        <PanelHeader title="Leçons" count={lessons.length} />
        <PanelRows>
          {lessons.map((lesson, index) => {
            const status =
              overview.progress.get(lesson.id)?.status ?? "not_started";
            const row = ROW_TONES[status];
            return (
              <Link
                key={lesson.id}
                href={`/academy/${currentModule.slug}/${lesson.slug}`}
                className="flex items-center gap-4 px-5 py-3.5 transition-[background-color] duration-(--motion-duration) ease-standard hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              >
                <span className="type-caption w-9 shrink-0 text-text-secondary tabular-nums">
                  {moduleIndex + 1}.{index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="type-body block truncate font-medium text-text-primary">
                    {lesson.title}
                  </span>
                  {lesson.summary ? (
                    <span className="type-caption mt-0.5 hidden truncate text-text-secondary md:block">
                      {lesson.summary}
                    </span>
                  ) : null}
                </span>
                <span className="type-caption hidden shrink-0 text-text-secondary tabular-nums sm:block">
                  {formatMinutes(lesson.duration_min)}
                </span>
                <StatusPill tone={row.tone} className="shrink-0">
                  {row.label}
                </StatusPill>
              </Link>
            );
          })}
        </PanelRows>
      </Panel>
    </div>
  );
}
