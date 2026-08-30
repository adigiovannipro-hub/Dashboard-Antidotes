import "server-only";

import { cache } from "react";

import type { AcademyAccess } from "./access";
import {
  getCourse,
  listLessons,
  listModules,
  type AcademyLessonLite,
} from "./queries";
import { listMyProgress } from "./queries";
import { progressByLesson, type ProgressLite } from "./progress";
import type { AcademyCourse, AcademyModule } from "./types";

/**
 * L'assemblage que les trois pages de lecture partagent : le cours, ses
 * modules, toutes ses leçons dans l'ordre de la formation, et la progression
 * de la personne. Une seule vague de requêtes en parallèle — chaque page
 * réclamait la même chose, chacune à sa façon.
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

/* `React.cache` : `generateMetadata` et la page demandent le même assemblage
   dans la même requête — sans le cache, chaque écran doublerait ses lectures. */
export const loadAcademyOverview = cache(async (
  context: AcademyAccess,
): Promise<AcademyOverview | null> => {
  const course = await getCourse({ orgId: context.orgId });
  if (!course) return null;

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
  overview: Pick<AcademyOverview, "moduleSlugById">,
  lesson: Pick<AcademyLessonLite, "module_id" | "slug">,
): string {
  return `/academy/${overview.moduleSlugById.get(lesson.module_id)}/${lesson.slug}`;
}
