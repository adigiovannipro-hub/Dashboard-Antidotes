import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, CircleCheck, Clock3, GraduationCap, Layers } from "lucide-react";

import { ProgressBar } from "@/components/academy/progress-bar";
import { StatCard, StatGrid } from "@/components/ds/stat-card";
import { EmptyState } from "@/components/ds/empty-state";
import { NavCard, Panel, PanelBody, SectionHeader } from "@/components/ds/surface";
import { Button } from "@/components/ui/button";
import { requireAcademyAccess } from "@/lib/academy/access";
import { lessonHref, loadAcademyOverview } from "@/lib/academy/overview";
import { completionOf, resumeLesson } from "@/lib/academy/progress";
import { formatMinutes } from "@/lib/format";

export const metadata: Metadata = { title: "Academy" };

/**
 * L'accueil de la formation.
 *
 * La bande de mesures répond aux questions qu'on se pose en ouvrant l'écran —
 * où j'en suis, combien il reste — puis un panneau « Reprendre » rouvre la
 * leçon en cours, et les modules se présentent en cartes cliquables, chacune
 * avec sa progression.
 */
export default async function AcademyHomePage() {
  const context = await requireAcademyAccess();
  const overview = await loadAcademyOverview(context);

  if (!overview) {
    return (
      <EmptyState
        icon={GraduationCap}
        message="Aucune formation publiée pour le moment."
        action={
          context.isAdmin
            ? { label: "Ouvrir le back-office", href: "/academy/admin" }
            : undefined
        }
      />
    );
  }

  const { course, modules, lessons, progress } = overview;
  const global = completionOf(lessons, progress);
  const totalMinutes = lessons.reduce(
    (sum, lesson) => sum + (lesson.duration_min ?? 0),
    0,
  );
  const resume = resumeLesson(lessons, progress);
  const started = [...progress.values()].some((row) => row.status !== "not_started");

  return (
    <div className="space-y-6">
      <SectionHeader
        title={course.title}
        description={course.description ?? undefined}
        action={
          context.isAdmin ? (
            <Button render={<Link href="/academy/admin" />} variant="outline" size="sm">
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
          context="du métier à la gestion d'activité"
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
              {resume ? resume.title : "Les 54 leçons sont derrière toi."}
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
              <NavCard
                key={module.id}
                href={`/academy/${module.slug}`}
                label={`Ouvrir le module ${module.title}`}
              >
                <p className="type-overline text-text-secondary">
                  Module {index + 1}
                </p>
                <h3 className="type-h3 mt-1 pr-6">{module.title}</h3>
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
              </NavCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
