import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import type { RadarAccount, ReferencePost } from "../types";
import type { RadarStore } from "./collect";
import { toPgVector, type Embedder } from "./embeddings";
import type { RadarPost } from "./radar/types";

/**
 * La persistance du radar et du corpus, en `service_role` — le relevé tourne
 * sur une machine GitHub. Chaque écriture teste l'erreur.
 */

type Admin = SupabaseClient<Database>;

const fail = (step: string, error: { message: string } | null) => {
  if (error) throw new Error(`${step} : ${error.message}`);
};

export function createRadarStore(admin: Admin, orgId: string): RadarStore {
  return {
    async listActiveAccounts() {
      const { data, error } = await admin
        .from("antidotes_radar_accounts")
        .select("*")
        .eq("org_id", orgId)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(200);
      fail("comptes veillés", error);
      return (data ?? []) as unknown as RadarAccount[];
    },

    async upsertPosts(account, posts: RadarPost[]) {
      if (posts.length === 0) return 0;
      const rows = posts.map((post) => ({
        org_id: orgId,
        platform: account.platform,
        author_handle: post.author_handle,
        content: post.content,
        url: post.url,
        metrics: post.metrics,
        is_mine: false,
        account_id: account.id,
        published_at: post.published_at,
        collected_at: new Date().toISOString(),
      }));
      // Une URL déjà connue rafraîchit ses chiffres ; jamais un doublon.
      const { data, error } = await admin
        .from("antidotes_reference_posts")
        .upsert(rows as never, { onConflict: "org_id,url" })
        .select("id");
      fail("corpus", error);
      return (data ?? []).length;
    },

    async saveAccount(id, patch) {
      const { error } = await admin.from("antidotes_radar_accounts").update(patch as never).eq("id", id);
      fail("compte veillé", error);
    },
  };
}

/** Les organisations qui veillent au moins un compte — le relevé tourne pour chacune. */
export async function listRadarOrgIds(admin: Admin): Promise<string[]> {
  const { data, error } = await admin
    .from("antidotes_radar_accounts")
    .select("org_id")
    .eq("is_active", true)
    .limit(1000);
  fail("organisations", error);
  return [...new Set(((data ?? []) as unknown as { org_id: string }[]).map((row) => row.org_id))];
}

/**
 * Calcule les vecteurs qui manquent au corpus **de mes posts** — ceux que le
 * studio compare au sujet. Les posts de la veille n'en ont pas besoin. Par
 * lots de vingt, et seulement ceux qui n'ont pas déjà la source de cet
 * embedder : deux sources ne se comparent pas.
 */
export async function embedMissing(options: {
  admin: Admin;
  embedder: Embedder;
  orgId?: string;
  limit?: number;
}): Promise<{ embedded: number; errors: string[] }> {
  let query = options.admin
    .from("antidotes_reference_posts")
    .select("id, content")
    .eq("is_mine", true)
    .or(`embedding_source.is.null,embedding_source.neq.${options.embedder.source}`)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 100);
  if (options.orgId) query = query.eq("org_id", options.orgId);
  const { data, error } = await query;
  fail("corpus à vectoriser", error);
  const rows = (data ?? []) as unknown as Pick<ReferencePost, "id" | "content">[];

  let embedded = 0;
  const errors: string[] = [];
  for (let index = 0; index < rows.length; index += 20) {
    const batch = rows.slice(index, index + 20);
    try {
      const vectors = await options.embedder.embed(batch.map((row) => row.content));
      for (const [position, row] of batch.entries()) {
        const { error: updateError } = await options.admin
          .from("antidotes_reference_posts")
          .update({ embedding: toPgVector(vectors[position]!), embedding_source: options.embedder.source } as never)
          .eq("id", row.id);
        fail("vecteur", updateError);
        embedded += 1;
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { embedded, errors };
}
