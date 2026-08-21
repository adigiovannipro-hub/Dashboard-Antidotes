"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAcademyContext, type AcademyAccess } from "@/lib/academy/access";
import { shouldComplete } from "@/lib/academy/progress";
import { videoUploadError } from "@/lib/academy/upload";
import { parseVideoUrl } from "@/lib/academy/video";
import { createClient } from "@/lib/supabase/server";
import { slugify, uniqueSlug } from "@/lib/workspaces/slug";

export type AcademyResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

/**
 * Actions de l'Academy.
 *
 * Deux familles : ce qu'un membre écrit — sa progression, ses notes — et ce
 * que l'owner seul écrit — le contenu, depuis le back-office. Les messages
 * d'erreur restent neutres : le module est interne, il ne confirme pas son
 * existence à qui n'y a pas droit. La RLS de la migration 0057 est l'autorité ;
 * ces gardes rendent l'erreur lisible, elles ne protègent pas les données.
 */

const OK: AcademyResult = { ok: true };

async function guardMember(): Promise<AcademyAccess> {
  const context = await getAcademyContext();
  if (!context) throw new Error("Action indisponible.");
  return context;
}

async function guardAdmin(): Promise<AcademyAccess> {
  const context = await guardMember();
  if (!context.isAdmin) throw new Error("Action indisponible.");
  return context;
}

function fail(error: unknown): AcademyResult {
  return { ok: false, error: (error as Error).message };
}

/** Tout le contenu sous `/academy` se relit : listes, leçon, back-office. */
function revalidateAcademy() {
  revalidatePath("/academy", "layout");
}

// === Côté apprenant ============================================================

const progressInput = z.object({
  lessonId: z.uuid(),
  /** Position de lecture en secondes — bornée : personne ne regarde 10 h. */
  seconds: z.number().int().min(0).max(36_000),
  durationSeconds: z.number().int().positive().max(36_000).nullable(),
});

/**
 * Le battement du lecteur, toutes les quinze secondes : position de reprise,
 * et bascule automatique en « terminée » à 90 % de la durée. Une leçon déjà
 * terminée ne redescend jamais — revenir revoir un passage n'annule rien.
 */
export async function recordProgress(input: {
  lessonId: string;
  seconds: number;
  durationSeconds: number | null;
}): Promise<AcademyResult> {
  const parsed = progressInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête invalide." };

  try {
    const context = await guardMember();
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("academy_progress")
      .select("id, status, watched_seconds")
      .eq("user_id", context.userId)
      .eq("lesson_id", parsed.data.lessonId)
      .maybeSingle();

    const completesNow = shouldComplete(
      parsed.data.seconds,
      parsed.data.durationSeconds,
    );

    if (existing?.status === "completed") {
      const { error } = await supabase
        .from("academy_progress")
        .update({ watched_seconds: parsed.data.seconds })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return OK;
    }

    const { error } = await supabase.from("academy_progress").upsert(
      {
        org_id: context.orgId,
        user_id: context.userId,
        lesson_id: parsed.data.lessonId,
        status: completesNow ? "completed" : "in_progress",
        watched_seconds: parsed.data.seconds,
        completed_at: completesNow ? new Date().toISOString() : null,
      },
      { onConflict: "user_id,lesson_id" },
    );
    if (error) throw new Error(error.message);

    // Pas de `revalidatePath` sur le battement : re-rendre la page toutes les
    // quinze secondes n'apporterait rien. Le geste manuel, lui, revalide.
    return OK;
  } catch (error) {
    return fail(error);
  }
}

const doneInput = z.object({
  lessonId: z.uuid(),
  done: z.boolean(),
});

/** Le bouton « Marquer comme terminé » — et son inverse. */
export async function markLessonDone(input: {
  lessonId: string;
  done: boolean;
}): Promise<AcademyResult> {
  const parsed = doneInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête invalide." };

  try {
    const context = await guardMember();
    const supabase = await createClient();

    const { error } = await supabase.from("academy_progress").upsert(
      {
        org_id: context.orgId,
        user_id: context.userId,
        lesson_id: parsed.data.lessonId,
        status: parsed.data.done ? "completed" : "in_progress",
        completed_at: parsed.data.done ? new Date().toISOString() : null,
      },
      { onConflict: "user_id,lesson_id" },
    );
    if (error) throw new Error(error.message);

    revalidateAcademy();
    return parsed.data.done
      ? { ok: true, message: "Leçon terminée." }
      : { ok: true, message: "Leçon rouverte." };
  } catch (error) {
    return fail(error);
  }
}

const noteInput = z.object({
  lessonId: z.uuid(),
  content: z.string().max(20_000, "La note dépasse 20 000 caractères."),
});

/** L'autosauvegarde du bloc-notes — une note par personne et par leçon. */
export async function saveLessonNote(input: {
  lessonId: string;
  content: string;
}): Promise<AcademyResult> {
  const parsed = noteInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Saisie invalide.",
    };
  }

  try {
    const context = await guardMember();
    const supabase = await createClient();

    const { error } = await supabase.from("academy_notes").upsert(
      {
        org_id: context.orgId,
        user_id: context.userId,
        lesson_id: parsed.data.lessonId,
        content: parsed.data.content,
      },
      { onConflict: "user_id,lesson_id" },
    );
    if (error) throw new Error(error.message);

    return OK;
  } catch (error) {
    return fail(error);
  }
}

// === Back-office : modules =====================================================

const createModuleInput = z.object({
  courseId: z.uuid(),
  title: z.string().trim().min(1, "Le titre ne peut pas être vide.").max(120),
  description: z.string().trim().max(600).nullable(),
});

export async function createModule(input: {
  courseId: string;
  title: string;
  description: string | null;
}): Promise<AcademyResult> {
  const parsed = createModuleInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }

  try {
    const context = await guardAdmin();
    const supabase = await createClient();

    const { data: siblings } = await supabase
      .from("academy_modules")
      .select("slug, order_index")
      .eq("course_id", parsed.data.courseId);

    const taken = new Set((siblings ?? []).map((sibling) => sibling.slug));
    const nextIndex =
      Math.max(0, ...(siblings ?? []).map((sibling) => sibling.order_index)) + 1;

    const { error } = await supabase.from("academy_modules").insert({
      course_id: parsed.data.courseId,
      org_id: context.orgId,
      slug: uniqueSlug(parsed.data.title, taken),
      title: parsed.data.title,
      description: parsed.data.description,
      order_index: nextIndex,
      published: false,
    });
    if (error) throw new Error(error.message);

    revalidateAcademy();
    return { ok: true, message: "Module créé, en brouillon." };
  } catch (error) {
    return fail(error);
  }
}

const updateModuleInput = z.object({
  moduleId: z.uuid(),
  patch: z
    .object({
      title: z.string().trim().min(1).max(120).optional(),
      description: z.string().trim().max(600).nullable().optional(),
      published: z.boolean().optional(),
    })
    .refine((patch) => Object.keys(patch).length > 0, "Rien à modifier."),
});

export async function updateModule(input: {
  moduleId: string;
  patch: { title?: string; description?: string | null; published?: boolean };
}): Promise<AcademyResult> {
  const parsed = updateModuleInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };

  try {
    await guardAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from("academy_modules")
      .update(parsed.data.patch)
      .eq("id", parsed.data.moduleId);
    if (error) throw new Error(error.message);

    revalidateAcademy();
    return OK;
  } catch (error) {
    return fail(error);
  }
}

export async function deleteModule(input: { moduleId: string }): Promise<AcademyResult> {
  const parsed = z.object({ moduleId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête invalide." };

  try {
    await guardAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from("academy_modules")
      .delete()
      .eq("id", parsed.data.moduleId);
    if (error) throw new Error(error.message);

    revalidateAcademy();
    return { ok: true, message: "Module supprimé, leçons comprises." };
  } catch (error) {
    return fail(error);
  }
}

const reorderInput = z.object({
  parentId: z.uuid(),
  orderedIds: z.array(z.uuid()).min(1).max(200),
});

export async function reorderModules(input: {
  parentId: string;
  orderedIds: string[];
}): Promise<AcademyResult> {
  const parsed = reorderInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête invalide." };

  try {
    await guardAdmin();
    const supabase = await createClient();

    for (const [index, id] of parsed.data.orderedIds.entries()) {
      const { error } = await supabase
        .from("academy_modules")
        .update({ order_index: index + 1 })
        .eq("id", id)
        .eq("course_id", parsed.data.parentId);
      if (error) throw new Error(error.message);
    }

    revalidateAcademy();
    return OK;
  } catch (error) {
    return fail(error);
  }
}

// === Back-office : leçons ======================================================

const createLessonInput = z.object({
  moduleId: z.uuid(),
  title: z.string().trim().min(1, "Le titre ne peut pas être vide.").max(160),
});

export async function createLesson(input: {
  moduleId: string;
  title: string;
}): Promise<AcademyResult> {
  const parsed = createLessonInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }

  try {
    const context = await guardAdmin();
    const supabase = await createClient();

    const { data: parent } = await supabase
      .from("academy_modules")
      .select("id, course_id")
      .eq("id", parsed.data.moduleId)
      .maybeSingle();
    if (!parent) throw new Error("Module introuvable.");

    const { data: siblings } = await supabase
      .from("academy_lessons")
      .select("slug, order_index")
      .eq("module_id", parent.id);

    const taken = new Set((siblings ?? []).map((sibling) => sibling.slug));
    const nextIndex =
      Math.max(0, ...(siblings ?? []).map((sibling) => sibling.order_index)) + 1;

    const { error } = await supabase.from("academy_lessons").insert({
      module_id: parent.id,
      course_id: parent.course_id,
      org_id: context.orgId,
      slug: uniqueSlug(parsed.data.title, taken),
      title: parsed.data.title,
      order_index: nextIndex,
      published: false,
    });
    if (error) throw new Error(error.message);

    revalidateAcademy();
    return { ok: true, message: "Leçon créée, en brouillon." };
  } catch (error) {
    return fail(error);
  }
}

const resourceSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(400).nullable(),
  kind: z.enum(["template", "checklist", "link", "tool"]),
  url: z.url().nullable(),
});

const updateLessonInput = z.object({
  lessonId: z.uuid(),
  patch: z
    .object({
      title: z.string().trim().min(1).max(160).optional(),
      summary: z.string().trim().max(600).nullable().optional(),
      script_mdx: z.string().max(60_000).optional(),
      duration_min: z.number().int().min(0).max(600).nullable().optional(),
      thumbnail_url: z.string().trim().max(600).nullable().optional(),
      published: z.boolean().optional(),
      resources: z.array(resourceSchema).max(12).optional(),
    })
    .refine((patch) => Object.keys(patch).length > 0, "Rien à modifier."),
});

export type LessonPatch = z.infer<typeof updateLessonInput>["patch"];

export async function updateLesson(input: {
  lessonId: string;
  patch: LessonPatch;
}): Promise<AcademyResult> {
  const parsed = updateLessonInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }

  try {
    await guardAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from("academy_lessons")
      .update(parsed.data.patch as never)
      .eq("id", parsed.data.lessonId);
    if (error) throw new Error(error.message);

    revalidateAcademy();
    return OK;
  } catch (error) {
    return fail(error);
  }
}

export async function deleteLesson(input: { lessonId: string }): Promise<AcademyResult> {
  const parsed = z.object({ lessonId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête invalide." };

  try {
    await guardAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from("academy_lessons")
      .delete()
      .eq("id", parsed.data.lessonId);
    if (error) throw new Error(error.message);

    revalidateAcademy();
    return { ok: true, message: "Leçon supprimée." };
  } catch (error) {
    return fail(error);
  }
}

export async function reorderLessons(input: {
  parentId: string;
  orderedIds: string[];
}): Promise<AcademyResult> {
  const parsed = reorderInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête invalide." };

  try {
    await guardAdmin();
    const supabase = await createClient();

    for (const [index, id] of parsed.data.orderedIds.entries()) {
      const { error } = await supabase
        .from("academy_lessons")
        .update({ order_index: index + 1 })
        .eq("id", id)
        .eq("module_id", parsed.data.parentId);
      if (error) throw new Error(error.message);
    }

    revalidateAcademy();
    return OK;
  } catch (error) {
    return fail(error);
  }
}

// === Back-office : vidéo =======================================================

const videoUrlInput = z.object({
  lessonId: z.uuid(),
  url: z.string().trim().max(600),
});

/**
 * Collage d'une URL YouTube, Vimeo ou Mux — le fournisseur et l'identifiant
 * s'extraient de n'importe quelle forme d'URL ; une URL vide retire la vidéo.
 */
export async function setLessonVideoUrl(input: {
  lessonId: string;
  url: string;
}): Promise<AcademyResult> {
  const parsed = videoUrlInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête invalide." };

  try {
    await guardAdmin();
    const supabase = await createClient();

    if (parsed.data.url === "") {
      const { error } = await supabase
        .from("academy_lessons")
        .update({ video_provider: "none", video_url: null, video_storage_path: null })
        .eq("id", parsed.data.lessonId);
      if (error) throw new Error(error.message);
      revalidateAcademy();
      return { ok: true, message: "Vidéo retirée." };
    }

    const parsedVideo = parseVideoUrl(parsed.data.url);
    if (!parsedVideo) {
      return {
        ok: false,
        error: "URL non reconnue — YouTube, Vimeo ou Mux uniquement.",
      };
    }

    const { error } = await supabase
      .from("academy_lessons")
      .update({
        video_provider: parsedVideo.provider,
        video_url: parsed.data.url,
        video_storage_path: null,
      })
      .eq("id", parsed.data.lessonId);
    if (error) throw new Error(error.message);

    revalidateAcademy();
    return { ok: true, message: "Vidéo branchée." };
  } catch (error) {
    return fail(error);
  }
}

const prepareUploadInput = z.object({
  lessonId: z.uuid(),
  file: z.object({
    name: z.string().min(1).max(200),
    type: z.string().max(100),
    size: z.number().int().positive(),
  }),
});

export type PreparedVideoUpload =
  | { ok: true; path: string; url: string }
  | { ok: false; error: string };

/**
 * Signe l'URL d'envoi d'une vidéo : les octets vont du navigateur droit au
 * bucket, le proxy de Next et ses limites de corps ne voient rien passer —
 * même mécanique que les visuels du Planning.
 */
export async function prepareVideoUpload(input: {
  lessonId: string;
  file: { name: string; type: string; size: number };
}): Promise<PreparedVideoUpload> {
  const parsed = prepareUploadInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête invalide." };

  const { file } = parsed.data;
  const refused = videoUploadError(file);
  if (refused) return { ok: false, error: refused };

  try {
    const context = await guardAdmin();
    const supabase = await createClient();

    const safeName = file.name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .slice(-80);
    const path = `${context.orgId}/${parsed.data.lessonId}/${Date.now()}-${safeName}`;

    const { data, error } = await supabase.storage
      .from("academy-videos")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);

    return { ok: true, path, url: data.signedUrl };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

const attachVideoInput = z.object({
  lessonId: z.uuid(),
  path: z.string().min(1).max(400),
});

/** Accroche à la leçon le chemin que le navigateur vient de remplir. */
export async function attachVideo(input: {
  lessonId: string;
  path: string;
}): Promise<AcademyResult> {
  const parsed = attachVideoInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête invalide." };

  try {
    const context = await guardAdmin();

    // L'URL d'envoi a été signée pour ce préfixe et rien d'autre : un chemin
    // hors de la leçon est forcément forgé.
    if (!parsed.data.path.startsWith(`${context.orgId}/${parsed.data.lessonId}/`)) {
      return { ok: false, error: "Chemin de fichier inattendu." };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("academy_lessons")
      .update({
        video_provider: "supabase",
        video_storage_path: parsed.data.path,
        video_url: null,
      })
      .eq("id", parsed.data.lessonId);
    if (error) throw new Error(error.message);

    revalidateAcademy();
    return { ok: true, message: "Vidéo en ligne." };
  } catch (error) {
    return fail(error);
  }
}
