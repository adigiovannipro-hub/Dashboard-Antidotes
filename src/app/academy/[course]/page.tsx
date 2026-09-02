import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BookOpen,
  ChevronLeft,
  CircleCheck,
  Clock3,
  GraduationCap,
  Layers,
} from "lucide-react";

import { CoverArt } from "@/components/academy/cover-art";
import { ProgressBar } from "@/components/academy/progress-bar";
import { StatCard, StatGrid } from "@/components/ds/stat-card";
import { EmptyState } from "@/components/ds/empty-state";
import { Panel, PanelBody, SectionHeader } from "@/components/ds/surface";
import { Button } from "@/components/ui/button";
import { requireAcademyAccess } from "@/lib/academy/access";
import { resolveAssetUrl, signAcademyAssets } from "@/lib/academy/assets";
import { lessonHref, loadAcademyOverview } from "@/lib/academy/overview";
import { completionOf, resumeLesson } from "@/lib/academy/progress";
import { formatMinutes } from "@/lib/format";

type Params = Promise<{ course: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { course: courseSlug } = await params;
  const context = await requireAcademyAccess();
  const overview = await loadAcademyOverview(context, courseSlug);
  return { title: overview ? `${overview.course.title} · Academy` : "Academy" };
}

/**
 * L'accueil d'une formation.
 *
 * La bande de mesures répond aux questions qu'on se pose en ouvrant l'écran —
 * où j'en suis, combien il reste — puis un panneau « Reprendre » rouvre la
 * leçon en cours, et les modules se présentent en cartes à miniature, chacune
 * avec sa progression.
 */
export default async function AcademyCoursePage({ params }: { params: Params }) {
  const { course: courseSlug } = await params;
  const context = await requireAcademyAccess();
  const overview = await loadAcademyOverview(context, courseSlug);
  if (!overview) notFound();

  const { course, modules, lessons, progress } = overview;
  const covers = await signAcademyAssets(modules.map((module) => module.cover_url));

  const global = completionOf(lessons, progress);
  const totalMinutes = lessons.reduce(
    (sum, lesson) => sum + (lesson.duration_min ?? 0),
    0,
  );
  const resume = resumeLesson(lessons, progress);
  const started = [...progress.values()].some((row) => row.status !== "not_started");

  return (
    <div className="space-y-6">
      {/* Une élève inscrite à une seule formation n'a rien à faire sur le
          catalogue : le lien de retour n'existe que s'il mène quelque part. */}
      {context.courseIds === null || context.courseIds.length > 1 ? (
        <Link
          href="/academy"
          className="type-caption inline-flex items-center gap-1 text-text-secondary hover:text-text-primary"
        >
          <ChevronLeft aria-hidden strokeWidth={1.75} className="size-3.5" />
          Toutes les formations
        </Link>
      ) : null}

      <SectionHeader
        title={course.title}
        description={course.description ?? undefined}
        action={
          context.isAdmin ? (
            <Button
              render={<Link href={`/academy/admin?formation=${course.slug}`} />}
              variant="outline"
              size="sm"
            >
              Back-office
            </Button>
          ) : undefined
        }
      />

      <StatGrid>
        <StatCard
          label="Progression"
          value={`${global.percent} %`}
          context="de la formation suivie"
          icon={GraduationCap}
          valueTone={global.percent === 100 ? "accent" : undefined}
        />
        <StatCard
          label="Leçons terminées"
          value={`${global.completed} / ${global.total}`}
          context={
            global.completed === global.total && global.total > 0
              ? "formation terminée"
              : `${global.total - global.completed} restantes`
          }
          icon={CircleCheck}
        />
        <StatCard
          label="Durée totale"
          value={formatMinutes(totalMinutes)}
          context={`${lessons.length} leçons de vidéo et de script`}
          icon={Clock3}
        />
        <StatCard
          label="Modules"
          value={String(modules.length)}
          context="à suivre dans l'ordre ou à la carte"
          icon={Layers}
        />
      </StatGrid>

      <Panel>
        <PanelBody className="flex flex-wrap items-center gap-4">
          <div className="min-w-48 flex-1">
            <p className="type-overline text-text-secondary">
              {resume
                ? started
                  ? "Reprendre où j'en étais"
                  : "Commencer la formation"
                : "Formation terminée"}
            </p>
            <p className="type-body mt-1 font-medium text-text-primary">
              {resume
                ? resume.title
                : `Les ${lessons.length} leçons sont derrière toi.`}
            </p>
            <ProgressBar
              percent={global.percent}
              label="Progression de la formation"
              className="mt-3"
            />
          </div>
          {resume ? (
            <Button render={<Link href={lessonHref(overview, resume)} />}>
              {started ? "Reprendre" : "Commencer"}
            </Button>
          ) : null}
        </PanelBody>
      </Panel>

      <SectionHeader title="Modules" count={modules.length} />

      {modules.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          message="Aucun module publié pour le moment."
          action={
            context.isAdmin
              ? { label: "Ouvrir le back-office", href: "/academy/admin" }
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module, index) => {
            const moduleLessons = lessons.filter(
              (lesson) => lesson.module_id === module.id,
            );
            const completion = completionOf(moduleLessons, progress);
            const minutes = moduleLessons.reduce(
              (sum, lesson) => sum + (lesson.duration_min ?? 0),
              0,
            );
            return (
              <Link
                key={module.id}
                href={`/academy/${course.slug}/${module.slug}`}
                aria-label={`Ouvrir le module ${module.title}`}
                className="group/module block overflow-hidden rounded-lg border border-border bg-surface shadow-card transition-[transform,box-shadow,border-color] duration-(--motion-duration) ease-standard hover:-translate-y-px hover:border-border-strong hover:shadow-card-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none motion-reduce:transition-none"
              >
                <CoverArt
                  url={resolveAssetUrl(module.cover_url, covers)}
                  seed={module.slug}
                  title={`Module ${index + 1}`}
                  className="aspect-[16/7]"
                />
                <div className="p-5">
                  <p className="type-overline text-text-secondary">
                    Module {index + 1}
                  </p>
                  <h3 className="type-h3 mt-1">{module.title}</h3>
                  {module.description ? (
                    <p className="type-caption mt-1.5 line-clamp-2 text-text-secondary">
                      {module.description}
                    </p>
                  ) : null}
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="type-caption text-text-secondary tabular-nums">
                      {completion.completed} / {completion.total} leçons ·{" "}
                      {formatMinutes(minutes)}
                    </span>
                    <span className="type-caption font-medium text-text-primary tabular-nums">
                      {completion.percent} %
                    </span>
                  </div>
                  <ProgressBar
                    percent={completion.percent}
                    label={`Progression du module ${module.title}`}
                    className="mt-2"
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
