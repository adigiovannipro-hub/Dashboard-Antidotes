/**
 * Le relevé du radar — orchestration **pure** : la persistance et les
 * connecteurs sont injectés. Pour chaque compte actif : le connecteur de son
 * réseau rend ses derniers posts, on les range par URL (une publication
 * relevée deux fois ne rentre qu'une fois, ses chiffres se rafraîchissent),
 * on note les abonnés relevés et la date, ou l'erreur. Un compte qui échoue
 * n'arrête pas les autres.
 */

import type { InboundThreshold, PostPlatform, RadarAccount } from "../types";
import type { RadarPost, RadarProviders } from "./radar/types";

export type RadarStore = {
  listActiveAccounts(): Promise<RadarAccount[]>;
  upsertPosts(account: RadarAccount, posts: RadarPost[]): Promise<number>;
  saveAccount(id: string, patch: Partial<RadarAccount>): Promise<void>;
};

export type CollectReport = {
  accounts: number;
  collected: number;
  /** Écartés par un seuil : comptés, jamais rangés — le tableau reste lisible. */
  belowThreshold: number;
  skipped: { account: string; reason: string }[];
  errors: { account: string; message: string }[];
};

/**
 * Un seuil ne juge que ce que le réseau rend : un post sans compteur de vues
 * n'est pas écarté par « ≥ 10 000 vues ». Rejeter sur une grandeur absente
 * viderait le tableau des réseaux qui ne la donnent pas — LinkedIn n'a pas
 * de vues. Même règle qu'à l'écran (`filters.ts`), et c'est voulu : ce qu'on
 * garde et ce qu'on montre se disent de la même façon.
 */
export function passesThreshold(post: RadarPost, threshold: InboundThreshold | undefined): boolean {
  if (!threshold) return true;
  const ok = (value: number | undefined, minimum: number | undefined) =>
    minimum === undefined || value === undefined || value >= minimum;
  return (
    ok(post.metrics.views, threshold.min_views) &&
    ok(post.metrics.likes, threshold.min_likes) &&
    ok(post.metrics.comments, threshold.min_comments)
  );
}

export async function collectRadar(options: {
  store: RadarStore;
  providers: RadarProviders;
  now: () => Date;
  /** Les seuils par réseau, tels que les Consignes les portent. */
  thresholds?: Partial<Record<PostPlatform, InboundThreshold>>;
}): Promise<CollectReport> {
  const report: CollectReport = { accounts: 0, collected: 0, belowThreshold: 0, skipped: [], errors: [] };
  const accounts = await options.store.listActiveAccounts();

  for (const account of accounts) {
    const label = `${account.platform}:${account.handle}`;
    const collector = options.providers.collectors[account.platform as PostPlatform];
    if (!collector) {
      report.skipped.push({ account: label, reason: options.providers.missing[account.platform] ?? "connecteur absent" });
      continue;
    }
    report.accounts += 1;
    try {
      const collection = await collector({ handle: account.handle, url: account.url });
      const threshold = options.thresholds?.[account.platform as PostPlatform];
      const kept = collection.posts.filter((post) => passesThreshold(post, threshold));
      report.belowThreshold += collection.posts.length - kept.length;
      const stored = await options.store.upsertPosts(account, kept);
      report.collected += stored;
      await options.store.saveAccount(account.id, {
        followers: collection.followers ?? account.followers,
        last_collected_at: options.now().toISOString(),
        last_error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      report.errors.push({ account: label, message });
      await options.store.saveAccount(account.id, { last_error: message }).catch(() => undefined);
    }
  }
  return report;
}
