import "server-only";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { GeneratedPost, InboundSettings, RadarAccount, ReferencePost } from "../types";
import { engagementScore, type EngagementScore } from "./engagement";
import { radarAvailability, type RadarAvailability } from "./radar/assemble";
import { publishAvailability } from "./linkedin-publish";
import { signVisual, visualAvailability } from "./visual";

/**
 * Les lectures de l'inbound. Le `where` de tenant est explicite partout : en
 * accès ouvert la RLS ne protège rien.
 *
 * Il y avait trois écrans, donc trois lectures — bibliothèque, radar, studio.
 * Il n'y en a plus qu'une : l'écran est un tableau, et tout ce qu'il montre,
 * panneau latéral compris, tient dans cette réponse.
 */

/** Ce que chaque clé absente de l'environnement empêche, dit à l'écran. */
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
  /**
   * Le corpus entier — la veille **et** mes propres posts, dans le même
   * tableau : « je veux que mes posts soient au sein des contenus ». Le
   * filtrage et le tri se font en mémoire, à l'écran.
   */
  contents: InboundContent[];
  drafts: GeneratedPost[];
  settings: InboundSettings | null;
  availability: RadarAvailability;
  studio: StudioAvailability;
  /**
   * Les visuels des brouillons, signés une heure, par identifiant de
   * brouillon. Signés **ici** et non à l'ouverture du panneau : c'était le
   * dernier aller-retour serveur qui faisait attendre le panneau, pour une
   * poignée d'URL qui tiennent dans la même lecture.
   */
  visuals: Record<string, string>;
  /** L'instant de la lecture : la fenêtre des filtres et le jour du calendrier s'y appuient. */
  now: number;
};

/**
 * Une seule lecture pour la page entière — et c'est le point : le panneau
 * latéral ne demande plus rien au serveur. Une ligne cliquée s'ouvre sur des
 * données déjà là, donc instantanément ; avant, `?post=` relançait la page
 * complète pour retrouver ce qu'elle portait déjà.
 */
export async function getInboundData(options: { orgId: string }): Promise<InboundData> {
  const supabase = await createClient();
  const [{ data: accountRows }, { data: contentRows }, { data: draftRows }, settings] = await Promise.all([
    supabase.from("antidotes_radar_accounts").select("*").eq("org_id", options.orgId).order("created_at").limit(200),
    supabase
      .from("antidotes_reference_posts")
      .select(POST_COLUMNS)
      .eq("org_id", options.orgId)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(1000),
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

  const drafts = (draftRows ?? []) as unknown as GeneratedPost[];
  const visuals = await signDraftVisuals(drafts);

  return {
    now: Date.now(),
    accounts,
    contents,
    drafts,
    settings,
    visuals,
    availability: radarAvailability(),
    studio: studioAvailability(),
  };
}

/** Les URL signées des visuels déjà générés. Un échec de signature n'est pas
    une panne de page : le brouillon s'affiche sans son image. */
async function signDraftVisuals(drafts: GeneratedPost[]): Promise<Record<string, string>> {
  const withImage = drafts.filter((draft) => draft.image_url);
  if (withImage.length === 0) return {};
  const admin = createAdminClient();
  const signed = await Promise.all(
    withImage.map(async (draft) => {
      try {
        return [draft.id, await signVisual(admin, draft.image_url!)] as const;
      } catch {
        return [draft.id, null] as const;
      }
    }),
  );
  return Object.fromEntries(signed.filter((entry): entry is readonly [string, string] => entry[1] !== null));
}

/** Mes consignes de voix et mes prompts. Nuls tant que rien n'a été écrit — jamais inventés. */
export async function getInboundSettings(options: { orgId: string }): Promise<InboundSettings | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("antidotes_inbound_settings")
    .select("*")
    .eq("org_id", options.orgId)
    .maybeSingle();
  return (data as unknown as InboundSettings | null) ?? null;
}
