import "server-only";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import type {
  GeneratedPost,
  GeneratedPostStatus,
  InboundSettings,
  PostPlatform,
  RadarAccount,
  RadarTopic,
  ReferencePost,
} from "../types";
import { engagementScore, type EngagementScore } from "./engagement";
import { radarAvailability, type RadarAvailability } from "./radar/assemble";
import { publishAvailability } from "./linkedin-publish";
import { signVisual, visualAvailability } from "./visual";

/**
 * Les lectures des écrans inbound. Le `where` de tenant est explicite
 * partout : en accès ouvert la RLS ne protège rien.
 */

// --- Bibliothèque ----------------------------------------------------------------

export type LibraryPost = ReferencePost & { hasVector: boolean };

export async function listMyPosts(options: { orgId: string }): Promise<LibraryPost[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("antidotes_reference_posts")
    .select("id, org_id, platform, author_handle, content, url, metrics, is_mine, tags, collected_at, created_at, account_id, published_at, embedding_source")
    .eq("org_id", options.orgId)
    .eq("is_mine", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(500);
  return ((data ?? []) as unknown as Omit<ReferencePost, "embedding">[]).map((row) => ({
    ...row,
    embedding: null,
    hasVector: row.embedding_source !== null,
  }));
}

// --- Radar -------------------------------------------------------------------------

export type RadarPostRow = {
  post: Omit<ReferencePost, "embedding">;
  account: RadarAccount | null;
  score: EngagementScore;
};

export type RadarFilters = { platform: PostPlatform | null; days: number };

export type RadarData = {
  accounts: RadarAccount[];
  posts: RadarPostRow[];
  topics: RadarTopic[];
  availability: RadarAvailability;
  /** Le nombre de posts de la veille, toutes périodes confondues. */
  corpusSize: number;
};

export async function getRadarData(options: { orgId: string; filters: RadarFilters }): Promise<RadarData> {
  const supabase = await createClient();
  const since = new Date(Date.now() - options.filters.days * 86_400_000).toISOString();
  let query = supabase
    .from("antidotes_reference_posts")
    .select("id, org_id, platform, author_handle, content, url, metrics, is_mine, tags, collected_at, created_at, account_id, published_at, embedding_source")
    .eq("org_id", options.orgId)
    .eq("is_mine", false)
    .gte("published_at", since)
    .limit(1000);
  if (options.filters.platform) query = query.eq("platform", options.filters.platform);

  const [{ data: accountRows }, { data: postRows }, { data: topicRows }, { count }] = await Promise.all([
    supabase.from("antidotes_radar_accounts").select("*").eq("org_id", options.orgId).order("created_at").limit(200),
    query,
    supabase
      .from("antidotes_radar_topics")
      .select("*")
      .eq("org_id", options.orgId)
      .neq("status", "dismissed")
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("antidotes_reference_posts")
      .select("id", { count: "exact", head: true })
      .eq("org_id", options.orgId)
      .eq("is_mine", false),
  ]);

  const accounts = (accountRows ?? []) as unknown as RadarAccount[];
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const posts = ((postRows ?? []) as unknown as Omit<ReferencePost, "embedding">[])
    .map((post) => {
      const account = post.account_id ? (byId.get(post.account_id) ?? null) : null;
      return { post, account, score: engagementScore(post.metrics, account?.followers ?? null) };
    })
    .sort((a, b) => b.score.sortKey - a.score.sortKey)
    .slice(0, 60);

  return {
    accounts,
    posts,
    topics: (topicRows ?? []) as unknown as RadarTopic[],
    availability: radarAvailability(),
    corpusSize: count ?? 0,
  };
}

export async function getRadarPost(options: { orgId: string; postId: string }): Promise<Omit<ReferencePost, "embedding"> | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("antidotes_reference_posts")
    .select("id, org_id, platform, author_handle, content, url, metrics, is_mine, tags, collected_at, created_at, account_id, published_at, embedding_source")
    .eq("org_id", options.orgId)
    .eq("id", options.postId)
    .maybeSingle();
  return (data as unknown as Omit<ReferencePost, "embedding"> | null) ?? null;
}

// --- Studio ------------------------------------------------------------------------

export type StudioAvailability = {
  embeddings: boolean;
  visual: string | null;
  publish: string | null;
  anthropic: boolean;
};

export function studioAvailability(): StudioAvailability {
  return {
    embeddings: Boolean(process.env.OPENAI_API_KEY?.trim()),
    visual: visualAvailability(),
    publish: publishAvailability(),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
  };
}

export async function listGeneratedPosts(options: { orgId: string }): Promise<GeneratedPost[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("antidotes_generated_posts")
    .select("*")
    .eq("org_id", options.orgId)
    .order("updated_at", { ascending: false })
    .limit(200);
  return (data ?? []) as unknown as GeneratedPost[];
}

export type StudioPostDetail = {
  post: GeneratedPost;
  examples: { post: Pick<ReferencePost, "id" | "content" | "url" | "published_at">; similarity: number }[];
  source: Omit<ReferencePost, "embedding"> | null;
  topic: RadarTopic | null;
  /** L'URL signée du visuel, une heure. */
  visualUrl: string | null;
};

export async function getStudioPost(options: { orgId: string; postId: string }): Promise<StudioPostDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("antidotes_generated_posts")
    .select("*")
    .eq("org_id", options.orgId)
    .eq("id", options.postId)
    .maybeSingle();
  const post = data as unknown as GeneratedPost | null;
  if (!post) return null;

  const exampleIds = post.examples.map((example) => example.post_id);
  const [{ data: exampleRows }, source, { data: topicRow }, visualUrl] = await Promise.all([
    exampleIds.length
      ? supabase.from("antidotes_reference_posts").select("id, content, url, published_at").eq("org_id", options.orgId).in("id", exampleIds)
      : Promise.resolve({ data: [] }),
    post.source_post_id ? getRadarPost({ orgId: options.orgId, postId: post.source_post_id }) : Promise.resolve(null),
    post.topic_id
      ? supabase.from("antidotes_radar_topics").select("*").eq("org_id", options.orgId).eq("id", post.topic_id).maybeSingle()
      : Promise.resolve({ data: null }),
    post.image_url ? signVisual(createAdminClient(), post.image_url) : Promise.resolve(null),
  ]);
  const byId = new Map(
    ((exampleRows ?? []) as unknown as Pick<ReferencePost, "id" | "content" | "url" | "published_at">[]).map((row) => [row.id, row]),
  );
  return {
    post,
    examples: post.examples.flatMap((example) => {
      const row = byId.get(example.post_id);
      return row ? [{ post: row, similarity: example.similarity }] : [];
    }),
    source,
    topic: (topicRow as unknown as RadarTopic | null) ?? null,
    visualUrl,
  };
}

export const STUDIO_STATUS_ORDER: GeneratedPostStatus[] = ["draft", "approved", "published", "rejected"];


// --- La page unique de l'inbound ---------------------------------------------------

/** Les colonnes d'un post relevé ou d'un post à moi — jamais le vecteur, lourd et inutile à l'écran. */
const POST_COLUMNS =
  "id, org_id, platform, author_handle, content, url, metrics, is_mine, tags, collected_at, created_at, account_id, published_at, embedding_source, media_kind, media_url, transcript";

export type InboundContent = {
  post: Omit<ReferencePost, "embedding">;
  account: RadarAccount | null;
  score: EngagementScore;
};

export type InboundData = {
  accounts: RadarAccount[];
  /** Tout le corpus de veille récent, filtré et rangé à l'écran. */
  contents: InboundContent[];
  topics: RadarTopic[];
  myPosts: LibraryPost[];
  drafts: GeneratedPost[];
  settings: InboundSettings | null;
  availability: RadarAvailability;
  studio: StudioAvailability;
  /** L'instant de la lecture : la fenêtre des filtres et le jour du calendrier s'y appuient. */
  now: number;
};

/**
 * Une seule lecture pour la page entière : ses six vues se choisissent sans
 * aller-retour serveur, et le tableau se filtre en mémoire — le corpus d'une
 * veille tient largement dans la limite ci-dessous.
 */
export async function getInboundData(options: { orgId: string }): Promise<InboundData> {
  const supabase = await createClient();
  const [{ data: accountRows }, { data: contentRows }, { data: topicRows }, { data: mineRows }, { data: draftRows }, settings] =
    await Promise.all([
      supabase.from("antidotes_radar_accounts").select("*").eq("org_id", options.orgId).order("created_at").limit(200),
      supabase
        .from("antidotes_reference_posts")
        .select(POST_COLUMNS)
        .eq("org_id", options.orgId)
        .eq("is_mine", false)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(600),
      supabase
        .from("antidotes_radar_topics")
        .select("*")
        .eq("org_id", options.orgId)
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("antidotes_reference_posts")
        .select(POST_COLUMNS)
        .eq("org_id", options.orgId)
        .eq("is_mine", true)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(500),
      supabase
        .from("antidotes_generated_posts")
        .select("*")
        .eq("org_id", options.orgId)
        .order("updated_at", { ascending: false })
        .limit(300),
      getInboundSettings({ orgId: options.orgId }),
    ]);

  const accounts = (accountRows ?? []) as unknown as RadarAccount[];
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const contents = ((contentRows ?? []) as unknown as Omit<ReferencePost, "embedding">[]).map((post) => {
    const account = post.account_id ? (byId.get(post.account_id) ?? null) : null;
    return {
      post,
      account,
      score: engagementScore(post.metrics, account?.followers ?? post.metrics.followers_at_collect ?? null),
    };
  });

  return {
    now: Date.now(),
    accounts,
    contents,
    topics: (topicRows ?? []) as unknown as RadarTopic[],
    myPosts: ((mineRows ?? []) as unknown as Omit<ReferencePost, "embedding">[]).map((row) => ({
      ...row,
      embedding: null,
      hasVector: row.embedding_source !== null,
    })),
    drafts: (draftRows ?? []) as unknown as GeneratedPost[],
    settings,
    availability: radarAvailability(),
    studio: studioAvailability(),
  };
}

/** Mes consignes de voix. Nulles tant que rien n'a été écrit — jamais inventées. */
export async function getInboundSettings(options: { orgId: string }): Promise<InboundSettings | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("antidotes_inbound_settings")
    .select("*")
    .eq("org_id", options.orgId)
    .maybeSingle();
  return (data as unknown as InboundSettings | null) ?? null;
}

/** Le détail d'un post relevé, tel que le panneau latéral le montre. */
export type InboundPostDetail = {
  post: Omit<ReferencePost, "embedding">;
  account: RadarAccount | null;
  score: EngagementScore;
  /** Les brouillons déjà écrits depuis ce post, un par format au plus. */
  drafts: GeneratedPost[];
};

export async function getInboundPost(options: { orgId: string; postId: string }): Promise<InboundPostDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("antidotes_reference_posts")
    .select(POST_COLUMNS)
    .eq("org_id", options.orgId)
    .eq("id", options.postId)
    .maybeSingle();
  const post = data as unknown as Omit<ReferencePost, "embedding"> | null;
  if (!post) return null;

  const [{ data: accountRow }, { data: draftRows }] = await Promise.all([
    post.account_id
      ? supabase.from("antidotes_radar_accounts").select("*").eq("org_id", options.orgId).eq("id", post.account_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("antidotes_generated_posts")
      .select("*")
      .eq("org_id", options.orgId)
      .eq("source_post_id", options.postId)
      .order("updated_at", { ascending: false })
      .limit(10),
  ]);
  const account = (accountRow as unknown as RadarAccount | null) ?? null;
  return {
    post,
    account,
    score: engagementScore(post.metrics, account?.followers ?? post.metrics.followers_at_collect ?? null),
    drafts: (draftRows ?? []) as unknown as GeneratedPost[],
  };
}
