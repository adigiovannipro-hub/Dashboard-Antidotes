import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import type { GeneratedExample, ReferencePost } from "../types";
import { POST_PLATFORM_LABELS } from "../types";
import { embedderFromEnv } from "./embeddings";
import { parseVector, rankBySimilarity } from "./similarity";
import { buildStudioPrompt, cleanGeneratedPost, LINKEDIN_MAX_CHARS, STUDIO_SYSTEM } from "./studio-prompt";

/**
 * Un post LinkedIn depuis un sujet : les cinq posts du corpus les plus
 * proches du sujet servent d'exemples, le post de la veille d'inspiration,
 * `claude-opus-5` écrit. Le brouillon revient avec ses exemples — on doit
 * pouvoir dire pourquoi il sonne comme il sonne — et la méthode de
 * rapprochement, vecteurs ou lexical, que l'écran affiche.
 */

export const STUDIO_MODEL = "claude-opus-5";
export const EXAMPLES_COUNT = 5;

export type GeneratedDraft = {
  content: string;
  examples: GeneratedExample[];
  method: "embedding" | "lexical" | "none";
};

export async function generatePost(options: {
  supabase: SupabaseClient<Database>;
  orgId: string;
  topic: string;
  angle: string | null;
  brief: string | null;
  sourcePostId: string | null;
  authorName: string | null;
  anthropic?: Anthropic;
}): Promise<GeneratedDraft> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY absente : le studio ne peut pas écrire.");
  }

  const [{ data: mineRows, error }, { data: sourceRow }] = await Promise.all([
    options.supabase
      .from("antidotes_reference_posts")
      .select("id, content, embedding, embedding_source")
      .eq("org_id", options.orgId)
      .eq("is_mine", true)
      .limit(500),
    options.sourcePostId
      ? options.supabase
          .from("antidotes_reference_posts")
          .select("platform, author_handle, content")
          .eq("org_id", options.orgId)
          .eq("id", options.sourcePostId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (error) throw new Error(error.message);

  const mine = ((mineRows ?? []) as unknown as Pick<ReferencePost, "id" | "content" | "embedding" | "embedding_source">[]).map(
    (row) => ({ id: row.id, content: row.content, embedding: parseVector(row.embedding) }),
  );

  const embedder = embedderFromEnv();
  let topicVector: number[] | null = null;
  if (embedder && mine.some((row) => row.embedding)) {
    try {
      topicVector = (await embedder.embed([`${options.topic}${options.angle ? ` — ${options.angle}` : ""}`]))[0] ?? null;
    } catch {
      topicVector = null; // le lexical prend le relais, et l'écran le dit
    }
  }
  const ranked = rankBySimilarity(mine, { text: `${options.topic} ${options.angle ?? ""}`, embedding: topicVector }, EXAMPLES_COUNT);
  const examples: GeneratedExample[] = ranked.map((entry) => ({
    post_id: entry.post.id,
    similarity: Math.round(entry.similarity * 1000) / 1000,
  }));
  const method = ranked.length === 0 ? "none" : ranked.every((entry) => entry.method === "embedding") ? "embedding" : "lexical";

  const source = sourceRow as unknown as Pick<ReferencePost, "platform" | "author_handle" | "content"> | null;
  const prompt = buildStudioPrompt({
    topic: options.topic,
    angle: options.angle,
    brief: options.brief,
    examples: ranked.map((entry) => ({ content: entry.post.content, similarity: entry.similarity })),
    source: source ? { platform: POST_PLATFORM_LABELS[source.platform], author: source.author_handle, content: source.content } : null,
    authorName: options.authorName,
  });

  const anthropic = options.anthropic ?? new Anthropic();
  const response = await anthropic.messages.create({
    model: STUDIO_MODEL,
    max_tokens: 1500,
    system: STUDIO_SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });
  if (response.stop_reason === "refusal") throw new Error("Génération refusée par les garde-fous du modèle.");
  const block = response.content.find((entry) => entry.type === "text");
  const content = cleanGeneratedPost(block?.type === "text" ? block.text : "");
  if (!content) throw new Error("Le modèle n'a rendu aucun texte.");
  return { content: content.slice(0, LINKEDIN_MAX_CHARS), examples, method };
}
