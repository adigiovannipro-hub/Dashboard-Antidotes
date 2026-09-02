import "server-only";

import { cache } from "react";

import type { AcademyAccess } from "./access";
import {
  getCourseBySlug,
  listCourses,
  listLessons,
  listModules,
  listMyProgress,
  type AcademyLessonLite,
} from "./queries";
import { completionOf, progressByLesson, type ProgressLite } from "./progress";
import type { AcademyCourse, AcademyModule } from "./types";

/**
 * Les deux assemblages que partagent les écrans de l'Academy : le **catalogue**
 * — toutes les formations accessibles, avec leur avancement — et la **vue
 * d'une formation** : ses modules, ses leçons dans l'ordre, la progression de
 * la personne.
 *
 * Une seule vague de requêtes en parallèle dans chaque cas, et `React.cache`
 * par-dessus : `generateMetadata` et la page demandent le même assemblage dans
 * la même requête ; sans le cache, chaque écran doublerait ses lectures.
 */

export type AcademyOverview = {
  course: AcademyCourse;
  modules: AcademyModule[];
  /** Toutes les leçons publiées, dans l'ordre modules puis leçons. */
  lessons: AcademyLessonLite[];
  progress: Map<string, ProgressLite>;
  /** module_id → slug, pour construire les liens sans re-chercher. */
  moduleSlugById: Map<string, string>;
};

/** Une carte de formation sur l'écran d'accueil. */
export type AcademyCourseCard = {
  course: AcademyCourse;
  moduleCount: number;
  lessonCount: number;
  totalMinutes: number;
  percent: number;
  completed: number;
};

export const loadAcademyCatalogue = cache(async (
  context: AcademyAccess,
): Promise<AcademyCourseCard[]> => {
  const courses = await listCourses({
    orgId: context.orgId,
    courseIds: context.courseIds,
  });
  if (courses.length === 0) return [];

  const courseIds = courses.map((course) => course.id);
  const [modules, lessons, progressRows] = await Promise.all([
    listModules({ courseIds }),
    listLessons({ courseIds }),
    listMyProgress({ userId: context.userId }),
  ]);

  const progress = progressByLesson(progressRows);
  const publishedModuleIds = new Set(modules.map((module) => module.id));

  return courses.map((course) => {
    // Une leçon d'un module non publié ne compte nulle part : elle n'est pas
    // lisible, elle ne doit pas peser dans le dénominateur d'une progression.
    const courseLessons = lessons.filter(
      (lesson) =>
        lesson.course_id === course.id && publishedModuleIds.has(lesson.module_id),
    );
    const completion = completionOf(courseLessons, progress);

    return {
      course,
      moduleCount: modules.filter((module) => module.course_id === course.id).length,
      lessonCount: courseLessons.length,
      totalMinutes: courseLessons.reduce(
        (sum, lesson) => sum + (lesson.duration_min ?? 0),
        0,
      ),
      percent: completion.percent,
      completed: completion.completed,
    };
  });
});

export const loadAcademyOverview = cache(async (
  context: AcademyAccess,
  courseSlug: string,
): Promise<AcademyOverview | null> => {
  const course = await getCourseBySlug({ orgId: context.orgId, slug: courseSlug });
  // Une formation à laquelle on n'est pas inscrite se comporte comme une
  // formation qui n'existe pas : la page appelante en fera un 404.
  if (!course) return null;
  if (context.courseIds && !context.courseIds.includes(course.id)) return null;

  const [modules, lessons, progressRows] = await Promise.all([
    listModules({ courseId: course.id }),
    listLessons({ courseId: course.id }),
    listMyProgress({ userId: context.userId }),
  ]);

  const moduleRank = new Map(modules.map((module) => [module.id, module.order_index]));
  const ordered = [...lessons]
    // Une leçon d'un module non publié n'est pas dans `modules` : elle sort
    // de l'ordre de lecture plutôt que de flotter en fin de liste.
    .filter((lesson) => moduleRank.has(lesson.module_id))
    .sort((a, b) => {
      const rankA = moduleRank.get(a.module_id) ?? 0;
      const rankB = moduleRank.get(b.module_id) ?? 0;
      if (rankA !== rankB) return rankA - rankB;
      return a.order_index - b.order_index;
    });

  return {
    course,
    modules,
    lessons: ordered,
    progress: progressByLesson(progressRows),
    moduleSlugById: new Map(modules.map((module) => [module.id, module.slug])),
  };
});

/** Le chemin d'une leçon dans l'application. */
export function lessonHref(
  overview: Pick<AcademyOverview, "course" | "moduleSlugById">,
  lesson: Pick<AcademyLessonLite, "module_id" | "slug">,
): string {
  return `/academy/${overview.course.slug}/${overview.moduleSlugById.get(lesson.module_id)}/${lesson.slug}`;
}
