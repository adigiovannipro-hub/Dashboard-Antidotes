import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import type { RadarAccount, ReferencePost } from "../types";
import { engagementScore, formatEngagement } from "./engagement";
import { buildTopicsPrompt, parseTopicsResponse, TOPICS_SYSTEM, type TopicCandidatePost } from "./topics";

/**
 * « Proposer des sujets » : les trente meilleurs posts de la veille sur la
 * période, classés par score relatif, soumis à `claude-opus-5`, qui rend
 * des sujets appuyés sur des posts cités. Les sujets déjà proposés et non
 * écartés restent : on ajoute, on ne remplace pas.
 */

export const TOPICS_MODEL = "claude-opus-5";
export const TOPICS_WINDOW_DAYS = 30;
export const TOPICS_CANDIDATES = 30;

export async function proposeTopics(options: {
  supabase: SupabaseClient<Database>;
  orgId: string;
  anthropic?: Anthropic;
}): Promise<{ created: number; candidates: number }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY absente : la proposition de sujets ne peut pas tourner.");
  }
  const since = new Date(Date.now() - TOPICS_WINDOW_DAYS * 86_400_000).toISOString();
  const [{ data: postRows, error }, { data: accountRows }] = await Promise.all([
    options.supabase
      .from("antidotes_reference_posts")
      .select("*")
      .eq("org_id", options.orgId)
      .eq("is_mine", false)
      .gte("published_at", since)
      .limit(1000),
    options.supabase.from("antidotes_radar_accounts").select("id, followers").eq("org_id", options.orgId),
  ]);
  if (error) throw new Error(error.message);
  const followers = new Map(
    ((accountRows ?? []) as unknown as Pick<RadarAccount, "id" | "followers">[]).map((row) => [row.id, row.followers]),
  );
  const ranked = ((postRows ?? []) as unknown as ReferencePost[])
    .map((post) => ({ post, score: engagementScore(post.metrics, post.account_id ? followers.get(post.account_id) : null) }))
    .sort((a, b) => b.score.sortKey - a.score.sortKey)
    .slice(0, TOPICS_CANDIDATES);
  if (ranked.length === 0) return { created: 0, candidates: 0 };

  const candidates: TopicCandidatePost[] = ranked.map(({ post, score }) => ({
    id: post.id,
    platform: post.platform,
    author_handle: post.author_handle,
    content: post.content,
    engagement: formatEngagement(score),
  }));

  const anthropic = options.anthropic ?? new Anthropic();
  const response = await anthropic.messages.create({
    model: TOPICS_MODEL,
    max_tokens: 2500,
    system: TOPICS_SYSTEM,
    messages: [{ role: "user", content: buildTopicsPrompt(candidates) }],
  });
  if (response.stop_reason === "refusal") throw new Error("Proposition refusée par les garde-fous du modèle.");
  const block = response.content.find((entry) => entry.type === "text");
  const topics = parseTopicsResponse(block?.type === "text" ? block.text : "", new Set(candidates.map((c) => c.id)));
  if (topics.length === 0) throw new Error("Le modèle n'a rendu aucun sujet exploitable.");

  const scores = new Map(ranked.map(({ post, score }) => [post.id, score.sortKey]));
  const { data: inserted, error: insertError } = await options.supabase
    .from("antidotes_radar_topics")
    .insert(
      topics.map((topic) => ({
        org_id: options.orgId,
        title: topic.title,
        angle: topic.angle,
        evidence: topic.evidence,
        // Le score d'un sujet : le meilleur de ses preuves.
        score: Math.round(Math.max(...topic.evidence.map((item) => scores.get(item.post_id) ?? 0)) * 100) / 100,
      })) as never,
    )
    .select("id");
  if (insertError) throw new Error(insertError.message);
  return { created: (inserted ?? []).length, candidates: candidates.length };
}
