"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { embedderFromEnv, toPgVector } from "@/lib/antidotes/inbound/embeddings";
import { generatePost } from "@/lib/antidotes/inbound/generate-post";
import { publishToLinkedin } from "@/lib/antidotes/inbound/linkedin-publish";
import { proposeTopics } from "@/lib/antidotes/inbound/propose-topics";
import { getInboundSettings } from "@/lib/antidotes/inbound/queries";
import { normalizeHandle } from "@/lib/antidotes/inbound/radar/types";
import { parseSharesCsv } from "@/lib/antidotes/inbound/shares-csv";
import { REEL_MAX_CHARS } from "@/lib/antidotes/inbound/reel-prompt";
import { LINKEDIN_MAX_CHARS } from "@/lib/antidotes/inbound/studio-prompt";
import { generateVisual, readVisual } from "@/lib/antidotes/inbound/visual";
import type { GeneratedPost, RadarTopic } from "@/lib/antidotes/types";
import { getViewer } from "@/lib/auth";
import { dispatchRadarWorkflow, syncDispatchUnavailable } from "@/lib/finance/github-actions";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/**
 * Les écritures de l'inbound : la bibliothèque (mes posts), le radar (les
 * comptes veillés, les sujets), le studio (brouillons, validation, visuel,
 * publication). Même posture que le reste du pôle.
 */

export type InboundResult = { ok: true; message?: string; id?: string } | { ok: false; error: string };

/* L'inbound tient sur une page à vues : un seul chemin à revalider, quel que
   soit le geste — un compte veillé, un brouillon et une consigne vivent au
   même endroit. Les trois constantes d'avant (radar, studio, bibliothèque)
   pointaient des routes qui ne sont plus que des redirections. */
const INBOUND_PATH = "/antidotes/inbound";
const LIBRARY_PATH = INBOUND_PATH;
const RADAR_PATH = INBOUND_PATH;
const STUDIO_PATH = INBOUND_PATH;

const PLATFORMS = ["linkedin", "x", "youtube", "tiktok", "instagram"] as const;

async function guardOwner(): Promise<{ orgId: string; email: string }> {
  const viewer = await getViewer();
  if (!viewer) throw new Error("Session expirée.");
  const orgId = viewer.ownedOrgIds[0];
  if (!viewer.isOwner || !orgId) throw new Error("Action indisponible.");
  return { orgId, email: viewer.email };
}

function fail(error: unknown): InboundResult {
  return { ok: false, error: (error as Error).message };
}

function firstIssue(error: z.ZodError, fallback: string): InboundResult {
  return { ok: false, error: error.issues[0]?.message ?? fallback };
}

/* Un textarea soumet ses fins de ligne en CRLF : sans ce redressement, le
   texte stocké porte des `\r` que le compteur de caractères ne voit pas et
   que LinkedIn recevrait tels quels. */
const formValue = (formData: FormData, key: string): string => String(formData.get(key) ?? "").replace(/\r\n?/g, "\n");

/** Le nom qui signe : celui du profil de l'owner, s'il l'a renseigné. */
async function authorName(email: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("full_name").eq("email", email).maybeSingle();
  return (data as unknown as { full_name?: string | null } | null)?.full_name?.trim() || null;
}

/** Vectorise un post de la bibliothèque tout de suite, si la clé est là ; sinon le passage le fera. */
async function embedOne(orgId: string, postId: string, content: string): Promise<boolean> {
  const embedder = embedderFromEnv();
  if (!embedder) return false;
  try {
    const [vector] = await embedder.embed([content]);
    if (!vector) return false;
    const supabase = await createClient();
    await supabase
      .from("antidotes_reference_posts")
      .update({ embedding: toPgVector(vector), embedding_source: embedder.source } as never)
      .eq("org_id", orgId)
      .eq("id", postId);
    return true;
  } catch {
    return false;
  }
}

// --- Bibliothèque ------------------------------------------------------------------

const myPostInput = z.object({
  content: z.string().trim().min(40, "Un post d'au moins quarante caractères.").max(6000),
  url: z.union([z.literal(""), z.url("Le lien doit être une URL complète.")]),
  publishedAt: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  likes: z.union([z.literal(""), z.coerce.number().int().min(0)]),
  comments: z.union([z.literal(""), z.coerce.number().int().min(0)]),
  tags: z.string().trim().max(300),
});

export async function addMyPost(_previous: InboundResult | null, formData: FormData): Promise<InboundResult> {
  const parsed = myPostInput.safeParse({
    content: formValue(formData, "content"),
    url: formValue(formData, "url").trim(),
    publishedAt: formValue(formData, "publishedAt").trim(),
    likes: formValue(formData, "likes").trim(),
    comments: formValue(formData, "comments").trim(),
    tags: formValue(formData, "tags"),
  });
  if (!parsed.success) return firstIssue(parsed.error, "Saisie invalide.");
  const input = parsed.data;

  try {
    const { orgId } = await guardOwner();
    const supabase = await createClient();
    const metrics: Record<string, number> = {};
    if (input.likes !== "") metrics.likes = input.likes;
    if (input.comments !== "") metrics.comments = input.comments;
    const { data, error } = await supabase
      .from("antidotes_reference_posts")
      .insert({
        org_id: orgId,
        platform: "linkedin",
        author_handle: null,
        content: input.content,
        url: input.url || null,
        metrics,
        is_mine: true,
        tags: input.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        published_at: input.publishedAt ? `${input.publishedAt}T12:00:00Z` : null,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.code === "23505" ? "Ce lien est déjà dans la bibliothèque." : error.message);
    const id = (data as unknown as { id: string }).id;
    const embedded = await embedOne(orgId, id, input.content);
    revalidatePath(LIBRARY_PATH);
    return { ok: true, id, message: embedded ? "Post ajouté et vectorisé." : "Post ajouté." };
  } catch (error) {
    return fail(error);
  }
}

export async function importSharesCsv(_previous: InboundResult | null, formData: FormData): Promise<InboundResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choisissez le fichier Shares.csv de l'export LinkedIn." };
  if (file.size > 5 * 1024 * 1024) return { ok: false, error: "Fichier trop lourd (5 Mo au plus)." };

  try {
    const { orgId } = await guardOwner();
    const { posts, skipped } = parseSharesCsv(await file.text());
    if (posts.length === 0) return { ok: false, error: "Aucun post exploitable dans ce fichier." };
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("antidotes_reference_posts")
      .upsert(
        posts.map((post) => ({
          org_id: orgId,
          platform: "linkedin",
          content: post.content,
          url: post.url,
          metrics: {},
          is_mine: true,
          published_at: post.published_at,
        })) as never,
        { onConflict: "org_id,url", ignoreDuplicates: true },
      )
      .select("id");
    if (error) throw new Error(error.message);
    const created = (data ?? []).length;
    revalidatePath(LIBRARY_PATH);
    return {
      ok: true,
      message: `${created} post${created > 1 ? "s" : ""} importé${created > 1 ? "s" : ""}${posts.length - created > 0 ? `, ${posts.length - created} déjà connus` : ""}${skipped > 0 ? `, ${skipped} partages sans texte écartés` : ""}. Les vecteurs se calculent au prochain relevé.`,
    };
  } catch (error) {
    return fail(error);
  }
}

export async function updateMyPost(input: {
  postId: string;
  tags?: string;
  likes?: number | null;
  comments?: number | null;
}): Promise<InboundResult> {
  const parsed = z
    .object({
      postId: z.uuid(),
      tags: z.string().trim().max(300).optional(),
      likes: z.number().int().min(0).nullable().optional(),
      comments: z.number().int().min(0).nullable().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  try {
    const { orgId } = await guardOwner();
    const supabase = await createClient();
    const { data: current } = await supabase
      .from("antidotes_reference_posts")
      .select("metrics")
      .eq("org_id", orgId)
      .eq("id", parsed.data.postId)
      .eq("is_mine", true)
      .maybeSingle();
    if (!current) throw new Error("Post introuvable.");
    const metrics = { ...((current as unknown as { metrics: Record<string, unknown> }).metrics ?? {}) };
    if (parsed.data.likes !== undefined) {
      if (parsed.data.likes === null) delete metrics.likes;
      else metrics.likes = parsed.data.likes;
    }
    if (parsed.data.comments !== undefined) {
      if (parsed.data.comments === null) delete metrics.comments;
      else metrics.comments = parsed.data.comments;
    }
    const patch: Record<string, unknown> = { metrics };
    if (parsed.data.tags !== undefined) {
      patch.tags = parsed.data.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
    }
    const { error } = await supabase
      .from("antidotes_reference_posts")
      .update(patch as never)
      .eq("org_id", orgId)
      .eq("id", parsed.data.postId);
    if (error) throw new Error(error.message);
    revalidatePath(LIBRARY_PATH);
    return { ok: true, message: "Enregistré." };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteMyPost(input: { postId: string }): Promise<InboundResult> {
  const parsed = z.object({ postId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Post invalide." };
  try {
    const { orgId } = await guardOwner();
    const supabase = await createClient();
    const { error } = await supabase
      .from("antidotes_reference_posts")
      .delete()
      .eq("org_id", orgId)
      .eq("id", parsed.data.postId)
      .eq("is_mine", true);
    if (error) throw new Error(error.message);
    revalidatePath(LIBRARY_PATH);
    return { ok: true, message: "Post retiré." };
  } catch (error) {
    return fail(error);
  }
}

/** Vectorise ce qui manque, tout de suite — sans clé, le dit. */
export async function embedLibraryNow(): Promise<InboundResult> {
  try {
    const { orgId } = await guardOwner();
    const embedder = embedderFromEnv();
    if (!embedder) return { ok: false, error: "OPENAI_API_KEY absente : les vecteurs ne peuvent pas être calculés. Le studio rapproche par recoupement lexical." };
    const { embedMissing } = await import("@/lib/antidotes/inbound/store");
    const result = await embedMissing({ admin: createAdminClient(), embedder, orgId, limit: 100 });
    revalidatePath(LIBRARY_PATH);
    if (result.errors.length > 0) return { ok: false, error: result.errors[0]! };
    return { ok: true, message: `${result.embedded} vecteur${result.embedded > 1 ? "s" : ""} calculé${result.embedded > 1 ? "s" : ""}.` };
  } catch (error) {
    return fail(error);
  }
}

// --- Radar : les comptes veillés --------------------------------------------------

const accountInput = z.object({
  platform: z.enum(PLATFORMS),
  handle: z.string().trim().min(1, "Un identifiant ou une URL de profil.").max(200),
  label: z.string().trim().max(120),
  followers: z.union([z.literal(""), z.coerce.number().int().min(0)]),
});

export async function addRadarAccount(_previous: InboundResult | null, formData: FormData): Promise<InboundResult> {
  const parsed = accountInput.safeParse({
    platform: formValue(formData, "platform"),
    handle: formValue(formData, "handle"),
    label: formValue(formData, "label"),
    followers: formValue(formData, "followers").trim(),
  });
  if (!parsed.success) return firstIssue(parsed.error, "Saisie invalide.");
  const raw = parsed.data.handle;
  const handle = normalizeHandle(raw);
  if (!handle) return { ok: false, error: "Identifiant illisible." };

  try {
    const { orgId } = await guardOwner();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("antidotes_radar_accounts")
      .insert({
        org_id: orgId,
        platform: parsed.data.platform,
        handle,
        url: /^https?:\/\//i.test(raw) ? raw : null,
        label: parsed.data.label || null,
        followers: parsed.data.followers === "" ? null : parsed.data.followers,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.code === "23505" ? "Ce compte est déjà veillé." : error.message);
    revalidatePath(RADAR_PATH);
    return { ok: true, id: (data as unknown as { id: string }).id, message: "Compte ajouté. Il sera relevé au prochain passage." };
  } catch (error) {
    return fail(error);
  }
}

export async function updateRadarAccount(input: {
  accountId: string;
  isActive?: boolean;
  followers?: number | null;
}): Promise<InboundResult> {
  const parsed = z
    .object({ accountId: z.uuid(), isActive: z.boolean().optional(), followers: z.number().int().min(0).nullable().optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  try {
    const { orgId } = await guardOwner();
    const supabase = await createClient();
    const patch: Record<string, unknown> = {};
    if (parsed.data.isActive !== undefined) patch.is_active = parsed.data.isActive;
    if (parsed.data.followers !== undefined) patch.followers = parsed.data.followers;
    const { error } = await supabase
      .from("antidotes_radar_accounts")
      .update(patch as never)
      .eq("org_id", orgId)
      .eq("id", parsed.data.accountId);
    if (error) throw new Error(error.message);
    revalidatePath(RADAR_PATH);
    return { ok: true, message: "Enregistré." };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteRadarAccount(input: { accountId: string }): Promise<InboundResult> {
  const parsed = z.object({ accountId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Compte invalide." };
  try {
    const { orgId } = await guardOwner();
    const supabase = await createClient();
    // Les posts déjà relevés restent : `account_id` passe à nul, le corpus ne perd rien.
    const { error } = await supabase
      .from("antidotes_radar_accounts")
      .delete()
      .eq("org_id", orgId)
      .eq("id", parsed.data.accountId);
    if (error) throw new Error(error.message);
    revalidatePath(RADAR_PATH);
    return { ok: true, message: "Compte retiré de la veille." };
  } catch (error) {
    return fail(error);
  }
}

/** « Relever maintenant » : l'ordre part à GitHub, le relevé s'y exécute. */
export async function collectRadarNow(): Promise<InboundResult> {
  try {
    await guardOwner();
    const unavailable = syncDispatchUnavailable();
    if (unavailable) return { ok: false, error: `Relevé à la demande indisponible : ${unavailable}. Le relevé quotidien continue.` };
    await dispatchRadarWorkflow();
    return { ok: true, message: "Relevé lancé sur GitHub — quelques minutes, puis rechargez." };
  } catch (error) {
    return fail(error);
  }
}

// --- Radar : les sujets ---------------------------------------------------------------

export async function proposeTopicsNow(): Promise<InboundResult> {
  try {
    const { orgId } = await guardOwner();
    const supabase = await createClient();
    const result = await proposeTopics({ supabase, orgId });
    revalidatePath(RADAR_PATH);
    if (result.candidates === 0) return { ok: false, error: "Aucun post de la veille sur les trente derniers jours : relevez des comptes d'abord." };
    return { ok: true, message: `${result.created} sujet${result.created > 1 ? "s" : ""} proposé${result.created > 1 ? "s" : ""} à partir de ${result.candidates} posts.` };
  } catch (error) {
    return fail(error);
  }
}

export async function setTopicStatus(input: { topicId: string; status: "new" | "used" | "dismissed" }): Promise<InboundResult> {
  const parsed = z.object({ topicId: z.uuid(), status: z.enum(["new", "used", "dismissed"]) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Sujet invalide." };
  try {
    const { orgId } = await guardOwner();
    const supabase = await createClient();
    const { error } = await supabase
      .from("antidotes_radar_topics")
      .update({ status: parsed.data.status } as never)
      .eq("org_id", orgId)
      .eq("id", parsed.data.topicId);
    if (error) throw new Error(error.message);
    revalidatePath(RADAR_PATH);
    return { ok: true, message: parsed.data.status === "dismissed" ? "Sujet écarté." : "Enregistré." };
  } catch (error) {
    return fail(error);
  }
}

// --- Studio --------------------------------------------------------------------------

const FORMATS = ["linkedin_post", "reel_script"] as const;

const draftInput = z.object({
  topic: z.string().trim().min(5, "Un sujet d'au moins cinq caractères.").max(300),
  angle: z.string().trim().max(400),
  brief: z.string().trim().max(1000),
  topicId: z.union([z.literal(""), z.uuid()]),
  sourcePostId: z.union([z.literal(""), z.uuid()]),
  format: z.enum(FORMATS).default("linkedin_post"),
});

export async function createDraft(_previous: InboundResult | null, formData: FormData): Promise<InboundResult> {
  const parsed = draftInput.safeParse({
    topic: formValue(formData, "topic"),
    angle: formValue(formData, "angle"),
    brief: formValue(formData, "brief"),
    topicId: formValue(formData, "topicId").trim(),
    sourcePostId: formValue(formData, "sourcePostId").trim(),
    format: formValue(formData, "format").trim() || undefined,
  });
  if (!parsed.success) return firstIssue(parsed.error, "Saisie invalide.");
  const input = parsed.data;

  try {
    const { orgId, email } = await guardOwner();
    const supabase = await createClient();
    const draft = await generatePost({
      supabase,
      orgId,
      topic: input.topic,
      angle: input.angle || null,
      brief: input.brief || null,
      sourcePostId: input.sourcePostId || null,
      authorName: await authorName(email),
      format: input.format,
      settings: await getInboundSettings({ orgId }),
    });
    const { data, error } = await supabase
      .from("antidotes_generated_posts")
      .insert({
        org_id: orgId,
        source_post_id: input.sourcePostId || null,
        topic: input.topic,
        content: draft.content,
        status: "draft",
        topic_id: input.topicId || null,
        format: input.format,
        brief: [input.angle ? `Angle : ${input.angle}` : "", input.brief].filter(Boolean).join("\n") || null,
        examples: draft.examples,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (input.topicId) {
      await supabase
        .from("antidotes_radar_topics")
        .update({ status: "used" } as never)
        .eq("org_id", orgId)
        .eq("id", input.topicId);
    }
    revalidatePath(STUDIO_PATH);
    revalidatePath(RADAR_PATH);
    const method =
      draft.method === "embedding" ? "exemples choisis par vecteurs" : draft.method === "lexical" ? "exemples choisis par recoupement lexical" : "sans exemple : la bibliothèque est vide";
    return { ok: true, id: (data as unknown as { id: string }).id, message: `Brouillon écrit — ${method}.` };
  } catch (error) {
    return fail(error);
  }
}

async function loadDraft(orgId: string, postId: string): Promise<GeneratedPost> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("antidotes_generated_posts")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", postId)
    .maybeSingle();
  const post = data as unknown as GeneratedPost | null;
  if (!post) throw new Error("Post introuvable.");
  return post;
}

export async function regenerateDraft(input: { postId: string }): Promise<InboundResult> {
  const parsed = z.object({ postId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Post invalide." };
  try {
    const { orgId, email } = await guardOwner();
    const post = await loadDraft(orgId, parsed.data.postId);
    if (post.status === "published") throw new Error("Un post publié ne se réécrit pas.");
    const supabase = await createClient();
    let angle: string | null = null;
    if (post.topic_id) {
      const { data } = await supabase.from("antidotes_radar_topics").select("angle").eq("org_id", orgId).eq("id", post.topic_id).maybeSingle();
      angle = (data as unknown as Pick<RadarTopic, "angle"> | null)?.angle ?? null;
    }
    const draft = await generatePost({
      supabase,
      orgId,
      topic: post.topic ?? "",
      angle,
      brief: post.brief,
      sourcePostId: post.source_post_id,
      authorName: await authorName(email),
    });
    const { error } = await supabase
      .from("antidotes_generated_posts")
      .update({ content: draft.content, examples: draft.examples, status: "draft", error: null } as never)
      .eq("org_id", orgId)
      .eq("id", post.id);
    if (error) throw new Error(error.message);
    revalidatePath(`${STUDIO_PATH}/${post.id}`);
    revalidatePath(STUDIO_PATH);
    return { ok: true, message: "Brouillon réécrit." };
  } catch (error) {
    return fail(error);
  }
}

export async function saveDraft(_previous: InboundResult | null, formData: FormData): Promise<InboundResult> {
  const parsed = z
    .object({
      postId: z.uuid(),
      content: z.string().trim().min(20, "Un post d'au moins vingt caractères.").max(LINKEDIN_MAX_CHARS, `LinkedIn accepte ${LINKEDIN_MAX_CHARS} caractères au plus.`),
      imagePrompt: z.string().trim().max(600),
    })
    .safeParse({
      postId: formValue(formData, "postId"),
      content: formValue(formData, "content"),
      imagePrompt: formValue(formData, "imagePrompt"),
    });
  if (!parsed.success) return firstIssue(parsed.error, "Saisie invalide.");
  try {
    const { orgId } = await guardOwner();
    const post = await loadDraft(orgId, parsed.data.postId);
    if (post.status === "published") throw new Error("Un post publié ne se modifie plus.");
    const supabase = await createClient();
    const { error } = await supabase
      .from("antidotes_generated_posts")
      .update({ content: parsed.data.content, image_prompt: parsed.data.imagePrompt || null } as never)
      .eq("org_id", orgId)
      .eq("id", post.id);
    if (error) throw new Error(error.message);
    revalidatePath(`${STUDIO_PATH}/${post.id}`);
    revalidatePath(STUDIO_PATH);
    return { ok: true, message: "Enregistré." };
  } catch (error) {
    return fail(error);
  }
}

export async function setDraftStatus(input: { postId: string; status: "draft" | "approved" | "rejected" }): Promise<InboundResult> {
  const parsed = z.object({ postId: z.uuid(), status: z.enum(["draft", "approved", "rejected"]) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Post invalide." };
  try {
    const { orgId } = await guardOwner();
    const post = await loadDraft(orgId, parsed.data.postId);
    if (post.status === "published") throw new Error("Un post publié ne change plus d'état.");
    const supabase = await createClient();
    const { error } = await supabase
      .from("antidotes_generated_posts")
      .update({ status: parsed.data.status } as never)
      .eq("org_id", orgId)
      .eq("id", post.id);
    if (error) throw new Error(error.message);
    revalidatePath(`${STUDIO_PATH}/${post.id}`);
    revalidatePath(STUDIO_PATH);
    const labels = { draft: "Remis en brouillon.", approved: "Post approuvé : il peut partir.", rejected: "Post écarté." };
    return { ok: true, message: labels[parsed.data.status] };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteDraft(input: { postId: string }): Promise<InboundResult> {
  const parsed = z.object({ postId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Post invalide." };
  try {
    const { orgId } = await guardOwner();
    const post = await loadDraft(orgId, parsed.data.postId);
    if (post.status === "published") throw new Error("Un post publié se garde : il est la trace de ce qui est parti.");
    const supabase = await createClient();
    const { error } = await supabase.from("antidotes_generated_posts").delete().eq("org_id", orgId).eq("id", post.id);
    if (error) throw new Error(error.message);
    revalidatePath(STUDIO_PATH);
    return { ok: true, message: "Brouillon supprimé." };
  } catch (error) {
    return fail(error);
  }
}

export async function generateVisualNow(input: { postId: string; prompt: string }): Promise<InboundResult> {
  const parsed = z.object({ postId: z.uuid(), prompt: z.string().trim().min(5, "Décrivez l'image en quelques mots.").max(600) }).safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error, "Saisie invalide.");
  try {
    const { orgId } = await guardOwner();
    const post = await loadDraft(orgId, parsed.data.postId);
    const admin = createAdminClient();
    const { path } = await generateVisual({ admin, orgId, postId: post.id, prompt: parsed.data.prompt });
    const supabase = await createClient();
    const { error } = await supabase
      .from("antidotes_generated_posts")
      .update({ image_url: path, image_prompt: parsed.data.prompt, error: null } as never)
      .eq("org_id", orgId)
      .eq("id", post.id);
    if (error) throw new Error(error.message);
    revalidatePath(`${STUDIO_PATH}/${post.id}`);
    return { ok: true, message: "Visuel généré." };
  } catch (error) {
    return fail(error);
  }
}

export async function publishDraftNow(input: { postId: string }): Promise<InboundResult> {
  const parsed = z.object({ postId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Post invalide." };
  try {
    const { orgId } = await guardOwner();
    const post = await loadDraft(orgId, parsed.data.postId);
    // La validation humaine est systématique : rien ne part sans être passé par « approuvé ».
    if (post.status !== "approved") throw new Error("Approuvez le post avant de le publier.");
    const supabase = await createClient();
    try {
      const image = post.image_url ? await readVisual(createAdminClient(), post.image_url) : null;
      const published = await publishToLinkedin({ text: post.content, image });
      const { error } = await supabase
        .from("antidotes_generated_posts")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          linkedin_post_id: published.postUrn,
          published_url: published.url,
          error: null,
        } as never)
        .eq("org_id", orgId)
        .eq("id", post.id);
      if (error) throw new Error(error.message);
    } catch (error) {
      const message = (error as Error).message;
      await supabase.from("antidotes_generated_posts").update({ error: message } as never).eq("org_id", orgId).eq("id", post.id);
      throw error;
    }
    revalidatePath(`${STUDIO_PATH}/${post.id}`);
    revalidatePath(STUDIO_PATH);
    return { ok: true, message: "Publié sur LinkedIn." };
  } catch (error) {
    return fail(error);
  }
}


// --- La page unique : consignes, programmation, écriture depuis le panneau -----------

const settingsInput = z.object({
  guidelines: z.string().trim().max(4000),
  linkedinExample: z.string().trim().max(4000),
  reelExample: z.string().trim().max(4000),
  emailExample: z.string().trim().max(4000),
});

/**
 * Mes consignes de voix et les seuils de relevé. Une ligne par organisation,
 * posée à la première écriture (`upsert` sur la clé primaire `org_id`).
 *
 * Les seuils arrivent en champs `seuil_<réseau>_<grandeur>` : l'écran n'en
 * rend que pour les réseaux réellement veillés, et un champ vide efface le
 * seuil plutôt que de le mettre à zéro — zéro serait un seuil, l'absence non.
 */
export async function saveInboundSettings(_previous: InboundResult | null, formData: FormData): Promise<InboundResult> {
  const parsed = settingsInput.safeParse({
    guidelines: formValue(formData, "guidelines"),
    linkedinExample: formValue(formData, "linkedinExample"),
    reelExample: formValue(formData, "reelExample"),
    emailExample: formValue(formData, "emailExample"),
  });
  if (!parsed.success) return firstIssue(parsed.error, "Saisie invalide.");

  const thresholds: Record<string, Record<string, number>> = {};
  for (const [key, raw] of formData.entries()) {
    const match = /^seuil_([a-z]+)_(views|likes|comments)$/.exec(key);
    if (!match || typeof raw !== "string") continue;
    const value = Number(raw.trim());
    if (!raw.trim() || !Number.isFinite(value) || value <= 0) continue;
    const platform = match[1]!;
    if (!(PLATFORMS as readonly string[]).includes(platform)) continue;
    thresholds[platform] = { ...thresholds[platform], [`min_${match[2]}`]: Math.floor(value) };
  }

  try {
    const { orgId } = await guardOwner();
    const supabase = await createClient();
    const { error } = await supabase.from("antidotes_inbound_settings").upsert(
      {
        org_id: orgId,
        guidelines: parsed.data.guidelines || null,
        linkedin_example: parsed.data.linkedinExample || null,
        reel_example: parsed.data.reelExample || null,
        email_example: parsed.data.emailExample || null,
        thresholds,
      } as never,
      { onConflict: "org_id" },
    );
    if (error) throw new Error(error.message);
    revalidatePath(INBOUND_PATH);
    return { ok: true, message: "Consignes enregistrées." };
  } catch (error) {
    return fail(error);
  }
}

/**
 * La date d'un brouillon. Un post LinkedIn approuvé part tout seul à cette
 * date (`pnpm studio:publier`, passage horaire) ; un script de reel n'a pas
 * de publication, sa date est un repère dans le calendrier.
 */
export async function scheduleDraft(input: { postId: string; scheduledAt: string | null }): Promise<InboundResult> {
  const parsed = z
    .object({ postId: z.uuid(), scheduledAt: z.union([z.string().min(1), z.null()]) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Date invalide." };
  try {
    const { orgId } = await guardOwner();
    const post = await loadDraft(orgId, parsed.data.postId);
    if (post.status === "published") throw new Error("Un post publié ne se reprogramme pas.");

    let scheduledAt: string | null = null;
    if (parsed.data.scheduledAt) {
      const at = new Date(parsed.data.scheduledAt);
      if (Number.isNaN(at.getTime())) throw new Error("Date illisible.");
      // Une heure de battement : programmer « maintenant » depuis un écran
      // ouvert depuis dix minutes ne doit pas être refusé, mais hier si.
      if (at.getTime() < Date.now() - 3_600_000) throw new Error("Cette date est passée.");
      scheduledAt = at.toISOString();
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("antidotes_generated_posts")
      .update({ scheduled_at: scheduledAt } as never)
      .eq("org_id", orgId)
      .eq("id", post.id);
    if (error) throw new Error(error.message);
    revalidatePath(INBOUND_PATH);
    return { ok: true, message: scheduledAt ? "Date posée." : "Date retirée." };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Écrire depuis le panneau latéral, dans l'une des deux formes.
 *
 * Un seul brouillon par source et par format : réécrire remplace le texte au
 * lieu d'empiler des jumeaux dans le calendrier. Un brouillon déjà approuvé
 * ou publié n'est jamais écrasé — on repart d'un neuf.
 */
export async function generateDraft(input: {
  format: "linkedin_post" | "reel_script";
  sourcePostId?: string | null;
  topicId?: string | null;
  topic?: string | null;
  angle?: string | null;
  brief?: string | null;
}): Promise<InboundResult> {
  const parsed = z
    .object({
      format: z.enum(FORMATS),
      sourcePostId: z.union([z.uuid(), z.null()]).optional(),
      topicId: z.union([z.uuid(), z.null()]).optional(),
      topic: z.union([z.string().trim().max(300), z.null()]).optional(),
      angle: z.union([z.string().trim().max(400), z.null()]).optional(),
      brief: z.union([z.string().trim().max(1000), z.null()]).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error, "Saisie invalide.");
  const data = parsed.data;

  try {
    const { orgId, email } = await guardOwner();
    const supabase = await createClient();

    // Le sujet vient de ce qu'on a sous la main : le titre du sujet proposé,
    // sinon la première phrase du contenu de la veille. Jamais un « Sans
    // titre » : c'est ce texte qui guide la génération.
    let topic = data.topic?.trim() || "";
    let angle = data.angle?.trim() || null;
    if (data.topicId) {
      const { data: topicRow } = await supabase
        .from("antidotes_radar_topics")
        .select("title, angle")
        .eq("org_id", orgId)
        .eq("id", data.topicId)
        .maybeSingle();
      const row = topicRow as unknown as Pick<RadarTopic, "title" | "angle"> | null;
      if (row) {
        topic = topic || row.title;
        angle = angle ?? row.angle;
      }
    }
    if (!topic && data.sourcePostId) {
      const { data: sourceRow } = await supabase
        .from("antidotes_reference_posts")
        .select("content, transcript")
        .eq("org_id", orgId)
        .eq("id", data.sourcePostId)
        .maybeSingle();
      const row = sourceRow as unknown as { content: string; transcript: string | null } | null;
      const text = (row?.transcript?.trim() || row?.content || "").replace(/\s+/g, " ").trim();
      topic = text.split(/(?<=[.!?])\s/)[0]?.slice(0, 200) ?? "";
    }
    if (topic.length < 5) throw new Error("Aucun sujet à écrire : le contenu source est vide.");

    const draft = await generatePost({
      supabase,
      orgId,
      topic,
      angle,
      brief: data.brief?.trim() || null,
      sourcePostId: data.sourcePostId ?? null,
      authorName: await authorName(email),
      format: data.format,
      settings: await getInboundSettings({ orgId }),
    });

    // Un brouillon de la même source et du même format se réécrit ; approuvé
    // ou publié, il est laissé tranquille et un nouveau naît à côté.
    let existingId: string | null = null;
    if (data.sourcePostId) {
      const { data: existing } = await supabase
        .from("antidotes_generated_posts")
        .select("id, status")
        .eq("org_id", orgId)
        .eq("source_post_id", data.sourcePostId)
        .eq("format", data.format)
        .eq("status", "draft")
        .limit(1)
        .maybeSingle();
      existingId = (existing as unknown as { id: string } | null)?.id ?? null;
    }

    const payload = {
      org_id: orgId,
      source_post_id: data.sourcePostId ?? null,
      topic,
      content: draft.content,
      status: "draft",
      topic_id: data.topicId ?? null,
      format: data.format,
      brief: [angle ? `Angle : ${angle}` : "", data.brief ?? ""].filter(Boolean).join("\n") || null,
      examples: draft.examples,
      error: null,
    };
    const { data: saved, error } = existingId
      ? await supabase
          .from("antidotes_generated_posts")
          .update(payload as never)
          .eq("org_id", orgId)
          .eq("id", existingId)
          .select("id")
          .single()
      : await supabase
          .from("antidotes_generated_posts")
          .insert(payload as never)
          .select("id")
          .single();
    if (error) throw new Error(error.message);

    if (data.topicId) {
      await supabase
        .from("antidotes_radar_topics")
        .update({ status: "used" } as never)
        .eq("org_id", orgId)
        .eq("id", data.topicId);
    }
    revalidatePath(INBOUND_PATH);
    const method =
      draft.method === "embedding"
        ? "exemples choisis par vecteurs"
        : draft.method === "lexical"
          ? "exemples choisis par recoupement lexical"
          : "sans exemple : la bibliothèque est vide";
    return { ok: true, id: (saved as unknown as { id: string }).id, message: `Écrit — ${method}.` };
  } catch (error) {
    return fail(error);
  }
}

/** Le texte d'un brouillon, enregistré depuis le panneau. */
export async function saveDraftText(input: { postId: string; content: string }): Promise<InboundResult> {
  const parsed = z
    .object({ postId: z.uuid(), content: z.string().trim().min(20, "Un texte d'au moins vingt caractères.").max(REEL_MAX_CHARS) })
    .safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error, "Saisie invalide.");
  try {
    const { orgId } = await guardOwner();
    const post = await loadDraft(orgId, parsed.data.postId);
    if (post.status === "published") throw new Error("Un post publié ne se modifie plus.");
    if (post.format === "linkedin_post" && parsed.data.content.length > LINKEDIN_MAX_CHARS) {
      throw new Error(`LinkedIn accepte ${LINKEDIN_MAX_CHARS} caractères au plus.`);
    }
    const supabase = await createClient();
    const { error } = await supabase
      .from("antidotes_generated_posts")
      .update({ content: parsed.data.content } as never)
      .eq("org_id", orgId)
      .eq("id", post.id);
    if (error) throw new Error(error.message);
    revalidatePath(INBOUND_PATH);
    return { ok: true, message: "Enregistré." };
  } catch (error) {
    return fail(error);
  }
}
