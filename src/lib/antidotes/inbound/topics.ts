/**
 * Des sujets à partir des posts qui marchent — le prompt et le parseur,
 * purs. L'appel au modèle vit dans `propose-topics.ts`.
 *
 * Le modèle reçoit les meilleurs posts de la veille (score relatif), avec
 * leur réseau, leur auteur et leurs chiffres, et rend des **sujets** : pas
 * des posts, des angles à traiter dans ma voix. Chaque sujet cite les posts
 * qui l'appuient : un sujet sans preuve serait une idée du modèle, pas un
 * signal de la niche.
 */

import type { PostPlatform, TopicEvidence } from "../types";
import { POST_PLATFORM_LABELS } from "../types";

export type TopicCandidatePost = {
  id: string;
  platform: PostPlatform;
  author_handle: string | null;
  content: string;
  engagement: string;
};

export const TOPICS_SYSTEM = `Tu es le stratège éditorial d'un freelance social media français qui publie sur LinkedIn pour attirer des clients (marques, commerces, e-commerce).
On te donne les publications qui ont le mieux marché dans sa niche ces dernières semaines, avec leur engagement rapporté à l'audience de l'auteur.
Tu proposes des SUJETS de posts LinkedIn, pas des posts : un titre court, un angle en une phrase (ce que le post affirmera), et les publications qui prouvent que le sujet intéresse.
Règles : entre quatre et huit sujets ; chaque sujet s'appuie sur au moins une publication citée par son identifiant ; jamais de sujet qu'aucune publication n'appuie ; des angles concrets, pas des thèmes vagues (« le personal branding » n'est pas un angle, « pourquoi vos posts d'expertise n'attirent aucun client » en est un) ; en français.
Réponds uniquement en JSON : {"topics":[{"title":"…","angle":"…","evidence":[{"post_id":"…","why":"…"}]}]}`;

export function buildTopicsPrompt(posts: TopicCandidatePost[]): string {
  return posts
    .map(
      (post, index) =>
        `#${index + 1} · id ${post.id} · ${POST_PLATFORM_LABELS[post.platform]} · ${post.author_handle ?? "?"} · engagement ${post.engagement}\n${post.content.slice(0, 900)}`,
    )
    .join("\n\n---\n\n");
}

export type ProposedTopic = { title: string; angle: string | null; evidence: TopicEvidence[] };

/** Lit la réponse du modèle, tolère les clôtures de code, écarte les sujets sans preuve valide. */
export function parseTopicsResponse(raw: string, knownIds: Set<string>): ProposedTopic[] {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) return [];
  let parsed: { topics?: unknown };
  try {
    parsed = JSON.parse(text.slice(start, end + 1)) as { topics?: unknown };
  } catch {
    return [];
  }
  if (!Array.isArray(parsed.topics)) return [];
  const topics: ProposedTopic[] = [];
  for (const entry of parsed.topics as Record<string, unknown>[]) {
    const title = typeof entry.title === "string" ? entry.title.trim() : "";
    if (!title) continue;
    const evidence = (Array.isArray(entry.evidence) ? entry.evidence : [])
      .map((item) => item as Record<string, unknown>)
      .filter((item) => typeof item.post_id === "string" && knownIds.has(item.post_id))
      .map((item) => ({ post_id: item.post_id as string, why: typeof item.why === "string" ? item.why.trim() : "" }));
    if (evidence.length === 0) continue;
    topics.push({ title: title.slice(0, 160), angle: typeof entry.angle === "string" ? entry.angle.trim().slice(0, 400) || null : null, evidence });
  }
  return topics.slice(0, 8);
}
