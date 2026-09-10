import { describe, expect, it } from "vitest";

import type { RadarAccount } from "../types";
import { collectRadar, type RadarStore } from "./collect";

const account = (overrides: Partial<RadarAccount>): RadarAccount => ({
  id: "a1",
  org_id: "org",
  platform: "linkedin",
  handle: "sandro",
  url: null,
  label: null,
  followers: 2000,
  is_active: true,
  last_collected_at: null,
  last_error: null,
  notes: null,
  created_at: "",
  updated_at: "",
  ...overrides,
});

describe("collectRadar", () => {
  it("relève chaque compte avec son connecteur, range les posts, note abonnés et erreurs", async () => {
    const saved: Record<string, Partial<RadarAccount>> = {};
    const stored: string[] = [];
    const store: RadarStore = {
      async listActiveAccounts() {
        return [account({}), account({ id: "a2", platform: "x", handle: "casse", followers: null }), account({ id: "a3", platform: "tiktok" })];
      },
      async upsertPosts(acc, posts) {
        stored.push(`${acc.id}:${posts.length}`);
        return posts.length;
      },
      async saveAccount(id, patch) {
        saved[id] = { ...saved[id], ...patch };
      },
    };
    const report = await collectRadar({
      store,
      providers: {
        collectors: {
          linkedin: async () => ({ posts: [{ url: "u1", content: "c", published_at: null, metrics: {}, author_handle: "sandro" }], followers: null }),
          x: async () => { throw new Error("acteur en panne"); },
        },
        missing: { tiktok: "APIFY_TOKEN absent" },
      },
      now: () => new Date("2026-09-10T06:00:00Z"),
    });

    expect(report).toMatchObject({ accounts: 2, collected: 1 });
    expect(report.errors).toEqual([{ account: "x:casse", message: "acteur en panne" }]);
    expect(report.skipped).toEqual([{ account: "tiktok:sandro", reason: "APIFY_TOKEN absent" }]);
    expect(stored).toEqual(["a1:1"]);
    expect(saved.a1).toEqual({ followers: 2000, last_collected_at: "2026-09-10T06:00:00.000Z", last_error: null });
    expect(saved.a2).toEqual({ last_error: "acteur en panne" });
  });
});

describe("les seuils du relevé", () => {
  it("écarte ce qui passe sous le seuil de son réseau, et compte les écartés", async () => {
    const kept: string[] = [];
    const store: RadarStore = {
      async listActiveAccounts() {
        return [account({ id: "ig", platform: "instagram", handle: "lumen" })];
      },
      async upsertPosts(_account, posts) {
        kept.push(...posts.map((post) => post.url));
        return posts.length;
      },
      async saveAccount() {},
    };
    const report = await collectRadar({
      store,
      providers: {
        collectors: {
          instagram: async () => ({
            followers: 1000,
            posts: [
              { url: "https://i/1", content: "vu", published_at: null, metrics: { views: 20000 }, author_handle: "lumen" },
              { url: "https://i/2", content: "peu vu", published_at: null, metrics: { views: 300 }, author_handle: "lumen" },
              // Pas de compteur de vues : le seuil ne peut pas le juger, il reste.
              { url: "https://i/3", content: "sans vues", published_at: null, metrics: { likes: 12 }, author_handle: "lumen" },
            ],
          }),
        },
        missing: {},
      },
      now: () => new Date("2026-09-10T05:00:00Z"),
      thresholds: { instagram: { min_views: 5000 } },
    });
    expect(report.collected).toBe(2);
    expect(report.belowThreshold).toBe(1);
    expect(kept).toEqual(["https://i/1", "https://i/3"]);
  });
});
