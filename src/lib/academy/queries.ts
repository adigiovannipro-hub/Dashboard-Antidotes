import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  AcademyCourse,
  AcademyEnrollment,
  AcademyLesson,
  AcademyModule,
  AcademyNote,
  AcademyProgress,
} from "./types";

/**
 * Lectures de l'Academy.
 *
 * La RLS (migration 0057) reste l'autorité : un membre ne reçoit que le
 * publié, un client d'espace ne reçoit rien. Les filtres `published` posés ici
 * servent l'owner — qui voit tout côté base — pour que les pages de lecture
 * lui montrent exactement ce que verra l'équipe, brouillons exclus. Le
 * back-office passe `includeDrafts` pour tout voir.
 */

/** Les colonnes d'une leçon en liste — jamais le script, qui pèse. */
const LESSON_LITE_COLUMNS =
  "id, module_id, course_id, org_id, slug, title, summary, duration_min, video_provider, order_index, published";

export type AcademyLessonLite = Pick<
  AcademyLesson,
  | "id"
  | "module_id"
  | "course_id"
  | "org_id"
  | "slug"
  | "title"
  | "summary"
  | "duration_min"
  | "video_provider"
  | "order_index"
  | "published"
>;

/**
 * Les formations de l'organisation, dans l'ordre d'affichage.
 *
 * `courseIds` restreint à des identifiants précis — les inscriptions d'une
 * élève. Le filtre est explicite et non délégué à la RLS pour la même raison
 * que `listMyProgress` : en accès ouvert, le client de lecture est
 * `service_role` et ne filtre plus rien.
 */
export async function listCourses(options: {
  orgId: string;
  courseIds?: string[] | null;
  includeDrafts?: boolean;
}): Promise<AcademyCourse[]> {
  if (options.courseIds !== null && options.courseIds?.length === 0) return [];

  const supabase = await createClient();

  let query = supabase
    .from("academy_courses")
    .select("*")
    .eq("org_id", options.orgId);
  if (options.courseIds) query = query.in("id", options.courseIds);
  if (!options.includeDrafts) query = query.eq("published", true);

  const { data } = await query.order("order_index").limit(50);
  return (data ?? []) as unknown as AcademyCourse[];
}

export async function getCourseBySlug(options: {
  orgId: string;
  slug: string;
  includeDrafts?: boolean;
}): Promise<AcademyCourse | null> {
  const supabase = await createClient();

  let query = supabase
    .from("academy_courses")
    .select("*")
    .eq("org_id", options.orgId)
    .eq("slug", options.slug);
  if (!options.includeDrafts) query = query.eq("published", true);

  const { data } = await query.maybeSingle();
  return (data as unknown as AcademyCourse) ?? null;
}

export async function listModules(options: {
  courseId?: string;
  courseIds?: string[];
  includeDrafts?: boolean;
}): Promise<AcademyModule[]> {
  if (options.courseIds?.length === 0) return [];

  const supabase = await createClient();

  let query = supabase.from("academy_modules").select("*");
  if (options.courseId) query = query.eq("course_id", options.courseId);
  if (options.courseIds) query = query.in("course_id", options.courseIds);
  if (!options.includeDrafts) query = query.eq("published", true);

  const { data } = await query.order("order_index").limit(400);
  return (data ?? []) as unknown as AcademyModule[];
}

export async function getModuleBySlug(options: {
  courseId: string;
  slug: string;
  includeDrafts?: boolean;
}): Promise<AcademyModule | null> {
  const supabase = await createClient();

  let query = supabase
    .from("academy_modules")
    .select("*")
    .eq("course_id", options.courseId)
    .eq("slug", options.slug);
  if (!options.includeDrafts) query = query.eq("published", true);

  const { data } = await query.maybeSingle();
  return (data as unknown as AcademyModule) ?? null;
}

/** Les leçons d'un module ou du cours entier, sans leur script. */
export async function listLessons(options: {
  courseId?: string;
  courseIds?: string[];
  moduleId?: string;
  includeDrafts?: boolean;
  limit?: number;
}): Promise<AcademyLessonLite[]> {
  if (options.courseIds?.length === 0) return [];

  const supabase = await createClient();

  let query = supabase.from("academy_lessons").select(LESSON_LITE_COLUMNS);
  if (options.courseId) query = query.eq("course_id", options.courseId);
  if (options.courseIds) query = query.in("course_id", options.courseIds);
  if (options.moduleId) query = query.eq("module_id", options.moduleId);
  if (!options.includeDrafts) query = query.eq("published", true);

  const { data } = await query.order("order_index").limit(options.limit ?? 1000);
  return (data ?? []) as unknown as AcademyLessonLite[];
}

export async function getLessonBySlug(options: {
  moduleId: string;
  slug: string;
  includeDrafts?: boolean;
}): Promise<AcademyLesson | null> {
  const supabase = await createClient();

  let query = supabase
    .from("academy_lessons")
    .select("*")
    .eq("module_id", options.moduleId)
    .eq("slug", options.slug);
  if (!options.includeDrafts) query = query.eq("published", true);

  const { data } = await query.maybeSingle();
  return (data as unknown as AcademyLesson) ?? null;
}

export async function getLessonById(options: {
  lessonId: string;
}): Promise<AcademyLesson | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("academy_lessons")
    .select("*")
    .eq("id", options.lessonId)
    .maybeSingle();
  return (data as unknown as AcademyLesson) ?? null;
}

/**
 * Toute la progression d'une personne. Le filtre `user_id` est explicite et
 * non délégué à la RLS : en accès ouvert le client de lecture est `service
 * role`, et sans ce filtre la page montrerait la progression de tout le monde.
 */
export async function listMyProgress(options: {
  userId: string;
}): Promise<AcademyProgress[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("academy_progress")
    .select("*")
    .eq("user_id", options.userId)
    .limit(1000);
  return (data ?? []) as unknown as AcademyProgress[];
}

/**
 * Les inscriptions de l'organisation — le fichier des élèves, back-office
 * uniquement. `courseId` restreint à une formation.
 */
export async function listEnrollments(options: {
  orgId: string;
  courseId?: string;
  limit?: number;
}): Promise<AcademyEnrollment[]> {
  const supabase = await createClient();

  let query = supabase
    .from("academy_enrollments")
    .select("*")
    .eq("org_id", options.orgId);
  if (options.courseId) query = query.eq("course_id", options.courseId);

  const { data } = await query
    .order("invited_at", { ascending: false })
    .limit(options.limit ?? 500);
  return (data ?? []) as unknown as AcademyEnrollment[];
}

/** Les inscriptions actives d'une personne — ce que voit son propre écran. */
export async function listMyEnrollments(options: {
  userId: string;
}): Promise<AcademyEnrollment[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("academy_enrollments")
    .select("*")
    .eq("user_id", options.userId)
    .eq("status", "active")
    .limit(50);
  return (data ?? []) as unknown as AcademyEnrollment[];
}

export async function getMyNote(options: {
  userId: string;
  lessonId: string;
}): Promise<AcademyNote | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("academy_notes")
    .select("*")
    .eq("user_id", options.userId)
    .eq("lesson_id", options.lessonId)
    .maybeSingle();
  return (data as unknown as AcademyNote) ?? null;
}
