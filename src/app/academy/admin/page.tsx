import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, Users } from "lucide-react";

import { AddModuleForm, CreateCourseForm } from "@/components/academy/admin/add-forms";
import { CoursePane } from "@/components/academy/admin/course-pane";
import { CourseSwitcher } from "@/components/academy/admin/course-switcher";
import { LessonEditor } from "@/components/academy/admin/lesson-editor";
import { ModulePane } from "@/components/academy/admin/module-pane";
import { EmptyState } from "@/components/ds/empty-state";
import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelRows,
  SectionHeader,
} from "@/components/ds/surface";
import { StatusPill } from "@/components/ds/status-pill";
import { Button } from "@/components/ui/button";
import { requireAcademyAdmin } from "@/lib/academy/access";
import { resolveAssetUrl, signAcademyAssets } from "@/lib/academy/assets";
import {
  getLessonBySlug,
  listCourses,
  listLessons,
  listModules,
} from "@/lib/academy/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Back-office · Academy" };

type Search = Promise<Record<string, string | undefined>>;

/**
 * Le back-office de l'Academy — owner seul, 404 pour tout le monde d'autre.
 *
 * La sélection vit dans l'URL (`?formation=`, `?module=`, `?lecon=`) : un
 * retour arrière retombe exactement où on était, et le serveur ne charge le
 * script complet que de la leçon ouverte — jamais les cent-vingt d'un coup.
 */
export default async function AcademyAdminPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const context = await requireAcademyAdmin();
  const params = await searchParams;

  const courses = await listCourses({
    orgId: context.orgId,
    courseIds: null,
    includeDrafts: true,
  });

  if (courses.length === 0) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Back-office" />
        <Panel>
          <PanelBody>
            <CreateCourseForm />
          </PanelBody>
        </Panel>
      </div>
    );
  }

  // Sans `?formation=`, la première : le back-office s'ouvre sur quelque chose
  // plutôt que sur un choix à faire.
  const course =
    courses.find((candidate) => candidate.slug === params.formation) ?? courses[0]!;

  const [modules, lessons, covers] = await Promise.all([
    listModules({ courseId: course.id, includeDrafts: true }),
    listLessons({ courseId: course.id, includeDrafts: true }),
    signAcademyAssets([course.cover_url]),
  ]);

  const moduleCovers = await signAcademyAssets(modules.map((module) => module.cover_url));

  const selectedModule = params.module
    ? (modules.find((candidate) => candidate.slug === params.module) ?? null)
    : null;
  const moduleLessons = selectedModule
    ? lessons.filter((lesson) => lesson.module_id === selectedModule.id)
    : [];
  const selectedLesson =
    selectedModule && params.lecon
      ? await getLessonBySlug({
          moduleId: selectedModule.id,
          slug: params.lecon,
          includeDrafts: true,
        })
      : null;

  const lessonCountByModule = new Map<string, number>();
  for (const lesson of lessons) {
    lessonCountByModule.set(
      lesson.module_id,
      (lessonCountByModule.get(lesson.module_id) ?? 0) + 1,
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Back-office"
        description={`${course.title} — ${modules.length} modules, ${lessons.length} leçons.`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <CourseSwitcher
              courses={courses.map((candidate) => ({
                slug: candidate.slug,
                title: candidate.title,
                published: candidate.published,
              }))}
              current={course.slug}
            />
            <Button
              render={<Link href={`/academy/admin/membres?formation=${course.slug}`} />}
              variant="outline"
              size="sm"
            >
              <Users data-icon="inline-start" aria-hidden strokeWidth={1.75} />
              Élèves
            </Button>
            <Button
              render={<Link href={`/academy/${course.slug}`} />}
              variant="ghost"
              size="sm"
            >
              Voir la formation
            </Button>
          </div>
        }
      />

      <CoursePane
        course={course}
        coverUrl={resolveAssetUrl(course.cover_url, covers)}
        orderedCourseIds={courses.map((candidate) => candidate.id)}
      />

      <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Panel>
          <PanelHeader title="Modules" count={modules.length} />
          <PanelRows>
            {modules.map((module, index) => {
              const isSelected = selectedModule?.id === module.id;
              return (
                <Link
                  key={module.id}
                  href={`/academy/admin?formation=${course.slug}&module=${module.slug}`}
                  aria-current={isSelected ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 transition-[background-color] duration-(--motion-duration) ease-standard hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                    isSelected ? "bg-muted" : undefined,
                  )}
                >
                  <span className="type-caption w-5 shrink-0 text-text-secondary tabular-nums">
                    {index + 1}
                  </span>
                  <span
                    className={cn(
                      "type-caption min-w-0 flex-1 truncate",
                      isSelected ? "font-medium text-text-primary" : "text-text-secondary",
                    )}
                  >
                    {module.title}
                  </span>
                  {/* `--text-secondary` et non `--text-tertiary` : ce dernier
                      est à 2,79:1 sur blanc, réservé aux icônes — un compteur
                      se lit. Relevé à l'audit, pas à la relecture. */}
                  <span className="type-caption shrink-0 text-text-secondary tabular-nums">
                    {lessonCountByModule.get(module.id) ?? 0}
                  </span>
                  <StatusPill
                    tone={module.published ? "positive" : "neutral"}
                    dot
                    className="shrink-0 px-1.5"
                  >
                    <span className="sr-only">
                      {module.published ? "Publié" : "Brouillon"}
                    </span>
                  </StatusPill>
                </Link>
              );
            })}
          </PanelRows>
          <div className="border-t border-border p-4">
            <AddModuleForm courseId={course.id} />
          </div>
        </Panel>

        <div className="min-w-0">
          {selectedLesson && selectedModule ? (
            <LessonEditor
              lesson={selectedLesson}
              courseSlug={course.slug}
              moduleSlug={selectedModule.slug}
            />
          ) : selectedModule ? (
            <ModulePane
              module={selectedModule}
              courseSlug={course.slug}
              coverUrl={resolveAssetUrl(selectedModule.cover_url, moduleCovers)}
              orderedModuleIds={modules.map((module) => module.id)}
              lessons={moduleLessons}
            />
          ) : (
            <EmptyState
              icon={GraduationCap}
              message="Choisis un module à gauche pour éditer ses leçons, son titre ou son ordre."
            />
          )}
        </div>
      </div>
    </div>
  );
}
