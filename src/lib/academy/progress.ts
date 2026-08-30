import { COMPLETION_RATIO, type AcademyProgress } from "./types";

/**
 * Lecture de la progression — fonctions pures, zéro import Supabase.
 *
 * L'état vient de la base (`academy_progress`), une ligne par personne et par
 * leçon ; tout ce qui s'en déduit — pourcentages, leçon de reprise, prochaine
 * leçon — se recalcule ici, jamais ne se stocke : un compteur stocké finit
 * toujours par mentir.
 */

/** Ce que les calculs demandent d'une leçon : rien de plus que l'identité. */
export type LessonRef = { id: string };

export type ProgressLite = Pick<
  AcademyProgress,
  "lesson_id" | "status" | "watched_seconds" | "updated_at"
>;

export function progressByLesson(rows: ProgressLite[]): Map<string, ProgressLite> {
  return new Map(rows.map((row) => [row.lesson_id, row]));
}

export type CompletionSummary = {
  completed: number;
  total: number;
  /** Entier 0-100. Zéro leçon = 0 %, pas une division par zéro. */
  percent: number;
};

export function completionOf(
  lessons: LessonRef[],
  progress: Map<string, ProgressLite>,
): CompletionSummary {
  const total = lessons.length;
  const completed = lessons.filter(
    (lesson) => progress.get(lesson.id)?.status === "completed",
  ).length;
  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

/**
 * La leçon à rouvrir depuis « Reprendre où j'en étais ».
 *
 * La dernière touchée encore en cours d'abord — c'est littéralement « où j'en
 * étais » — sinon la première jamais terminée dans l'ordre du cours, sinon
 * rien : tout est fini.
 */
export function resumeLesson<T extends LessonRef>(
  orderedLessons: T[],
  progress: Map<string, ProgressLite>,
): T | null {
  let lastOpen: { lesson: T; updatedAt: string } | null = null;
  for (const lesson of orderedLessons) {
    const row = progress.get(lesson.id);
    if (row?.status !== "in_progress") continue;
    if (!lastOpen || row.updated_at > lastOpen.updatedAt) {
      lastOpen = { lesson, updatedAt: row.updated_at };
    }
  }
  if (lastOpen) return lastOpen.lesson;

  return (
    orderedLessons.find(
      (lesson) => progress.get(lesson.id)?.status !== "completed",
    ) ?? null
  );
}

/**
 * Une vidéo est considérée vue à 90 % de sa durée : le générique ne retient
 * personne, et exiger la dernière seconde laisserait tout « en cours ».
 * Sans durée connue, on ne devine pas — seul le geste manuel termine.
 */
export function shouldComplete(
  watchedSeconds: number,
  durationSeconds: number | null,
): boolean {
  if (!durationSeconds || durationSeconds <= 0) return false;
  return watchedSeconds >= durationSeconds * COMPLETION_RATIO;
}
