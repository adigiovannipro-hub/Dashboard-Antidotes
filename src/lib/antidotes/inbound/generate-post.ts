import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import type { GeneratedExample, GeneratedPostFormat, InboundSettings, ReferencePost } from "../types";
import { POST_PLATFORM_LABELS } from "../types";
import { embedderFromEnv } from "./embeddings";
import { resolvePrompt } from "./prompts";
import { buildReelPrompt } from "./reel-prompt";
import { parseVector, rankBySimilarity } from "./similarity";
import { buildStudioPrompt, cleanGeneratedPost } from "./studio-prompt";

/**
 * Une forme depuis une matière : les cinq posts
 * du corpus les plus proches servent d'exemples, le contenu de la veille de
 * matière, mes consignes de voix passent avant tout le reste, et
 * `claude-opus-5` écrit. Le brouillon revient avec ses exemples — on doit
 * pouvoir dire pourquoi il sonne comme il sonne — et la méthode de
 * rapprochement, vecteurs ou lexical, que l'écran affiche.
 *
 * Trois formes, trois prompts : un post lu, un script de reel et un script de
 * vidéo longue ne se coupent pas aux mêmes endroits, et raccourcir l'un pour
 * faire l'autre s'entend. Le prompt de chaque forme se réécrit à l'écran
 * (fenêtre « Prompts ») ; sans retouche, c'est celui du code qui part —
 * `resolvePrompt` tranche.
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
  format?: GeneratedPostFormat;
  /** Mes consignes de voix et mes prompts ; nulles tant que rien n'est écrit. */
  settings?: Pick<
    InboundSettings,
    "guidelines" | "linkedin_example" | "reel_example" | "prompts"
  > | null;
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
          .select("platform, author_handle, content, transcript")
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

  const source = sourceRow as unknown as Pick<ReferencePost, "platform" | "author_handle" | "content" | "transcript"> | null;
  const format = options.format ?? "linkedin_post";
  const resolved = resolvePrompt(options.settings ?? null, format);
  /* Pour un reel de la veille, c'est le script qui est la matière : sa
     légende ne dit presque rien de ce qui a marché. */
  const sourceContent = source ? (source.transcript?.trim() || source.content) : null;
  const shared = {
    topic: options.topic,
    angle: options.angle,
    brief: options.brief,
    guidelines: options.settings?.guidelines ?? null,
    examples: ranked.map((entry) => ({ content: entry.post.content, similarity: entry.similarity })),
    source:
      source && sourceContent
        ? { platform: POST_PLATFORM_LABELS[source.platform], author: source.author_handle, content: sourceContent }
        : null,
    authorName: options.authorName,
  };
  /* Les deux scripts partagent la mise en forme de la demande — sujet,
     consignes, exemple, matière ; seul le système change d'une forme à
     l'autre. Le post LinkedIn garde la sienne, qui nomme « mes posts ». */
  const prompt =
    format === "linkedin_post"
      ? buildStudioPrompt({ ...shared, example: resolved.example })
      : buildReelPrompt({ ...shared, example: resolved.example });

  const anthropic = options.anthropic ?? new Anthropic();
  const response = await anthropic.messages.create({
    model: STUDIO_MODEL,
    /* Un script de vidéo longue fait mille mots dits : le plafond des deux
       formes courtes le couperait en plein milieu. */
    max_tokens: format === "youtube_script" ? 4000 : 1500,
    system: resolved.system,
    messages: [{ role: "user", content: prompt }],
  });
  if (response.stop_reason === "refusal") throw new Error("Génération refusée par les garde-fous du modèle.");
  const block = response.content.find((entry) => entry.type === "text");
  const content = cleanGeneratedPost(block?.type === "text" ? block.text : "");
  if (!content) throw new Error("Le modèle n'a rendu aucun texte.");
  return { content: content.slice(0, resolved.maxChars), examples, method };
}
