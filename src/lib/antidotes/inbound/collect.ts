/**
 * Le relevé du radar — orchestration **pure** : la persistance et les
 * connecteurs sont injectés. Pour chaque compte actif : le connecteur de son
 * réseau rend ses derniers posts, on les range par URL (une publication
 * relevée deux fois ne rentre qu'une fois, ses chiffres se rafraîchissent),
 * on note les abonnés relevés et la date, ou l'erreur. Un compte qui échoue
 * n'arrête pas les autres.
 */

import type { PostPlatform, RadarAccount } from "../types";
import type { RadarPost, RadarProviders } from "./radar/types";

export type RadarStore = {
  listActiveAccounts(): Promise<RadarAccount[]>;
  upsertPosts(account: RadarAccount, posts: RadarPost[]): Promise<number>;
  saveAccount(id: string, patch: Partial<RadarAccount>): Promise<void>;
};

export type CollectReport = {
  accounts: number;
  collected: number;
  skipped: { account: string; reason: string }[];
  errors: { account: string; message: string }[];
};

export async function collectRadar(options: {
  store: RadarStore;
  providers: RadarProviders;
  now: () => Date;
}): Promise<CollectReport> {
  const report: CollectReport = { accounts: 0, collected: 0, skipped: [], errors: [] };
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
      const stored = await options.store.upsertPosts(account, collection.posts);
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
