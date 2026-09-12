import { describe, expect, it } from "vitest";

import type { RadarAccount } from "../types";
import { collectRadar, isUnknownAccount, pausedReason, type RadarStore } from "./collect";

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

describe("isUnknownAccount", () => {
  it("reconnaît le refus de Meta sur un profil qui n'existe pas", () => {
    expect(
      isUnknownAccount(
        'Instagram : 400 {"error":{"message":"Invalid user id","type":"OAuthException","code":110,"error_subcode":2207013}}',
      ),
    ).toBe(true);
  });

  it("reconnaît les formulations des autres réseaux", () => {
    expect(isUnknownAccount("Channel not found")).toBe(true);
    expect(isUnknownAccount("Ce compte est introuvable")).toBe(true);
    expect(isUnknownAccount("This account does not exist")).toBe(true);
  });

  it("ne prend pas un jeton expiré ou un plafond pour un compte disparu", () => {
    // Ils se réparent en rebranchant, et touchent tous les comptes d'un
    // coup : les mettre en pause éteindrait le radar entier.
    expect(isUnknownAccount("Le jeton a expiré, rebrancher le compte")).toBe(false);
    expect(isUnknownAccount('{"error":{"code":4,"message":"Application request limit reached"}}')).toBe(false);
    expect(isUnknownAccount("502 Bad Gateway")).toBe(false);
  });
});

describe("la mise en pause d'un compte que le réseau ne connaît plus", () => {
  const storeWith = (
    accounts: RadarAccount[],
    collectors: Record<string, () => Promise<never> | Promise<{ posts: []; followers: null }>>,
    saved: Record<string, Partial<RadarAccount>>,
  ) => ({
    store: {
      async listActiveAccounts() {
        return accounts;
      },
      async upsertPosts() {
        return 0;
      },
      async saveAccount(id: string, patch: Partial<RadarAccount>) {
        saved[id] = { ...saved[id], ...patch };
      },
    } satisfies RadarStore,
    providers: { collectors, missing: {} } as never,
  });

  it("met en pause le compte introuvable et laisse les autres tourner", async () => {
    const saved: Record<string, Partial<RadarAccount>> = {};
    const { store, providers } = storeWith(
      [account({ id: "vivant" }), account({ id: "disparu", platform: "instagram", handle: "agence.lumen" })],
      {
        linkedin: async () => ({ posts: [], followers: null }),
        instagram: async () => {
          throw new Error('{"error":{"message":"Invalid user id","code":110}}');
        },
      },
      saved,
    );

    const report = await collectRadar({ store, providers, now: () => new Date("2026-09-12T00:00:00Z") });

    expect(report.paused).toHaveLength(1);
    expect(report.paused[0]?.account).toBe("instagram:agence.lumen");
    expect(saved.disparu?.is_active).toBe(false);
    expect(saved.vivant?.is_active).toBeUndefined();
    // La ligne porte une phrase, jamais la charge utile du réseau.
    expect(saved.disparu?.last_error).toBe(pausedReason("agence.lumen"));
    expect(saved.disparu?.last_error).not.toContain("{");
    // Le message brut, lui, reste au rapport — donc au journal du passage.
    expect(report.paused[0]?.message).toContain("Invalid user id");
  });

  it("met en pause le compte unique du radar : « tous » ne veut rien dire à un", async () => {
    // Le cas réel du 12/09 : un seul compte relevable, celui-là même que
    // Meta ne connaît pas. Le garde-fou ci-dessous ne doit pas l'attraper.
    const saved: Record<string, Partial<RadarAccount>> = {};
    const { store, providers } = storeWith(
      [account({ id: "seul", platform: "instagram", handle: "agence.lumen" })],
      {
        instagram: async () => {
          throw new Error('{"error":{"message":"Invalid user id","code":110}}');
        },
      },
      saved,
    );

    const report = await collectRadar({ store, providers, now: () => new Date("2026-09-12T00:00:00Z") });

    expect(report.paused).toHaveLength(1);
    expect(saved.seul?.is_active).toBe(false);
  });

  it("ne met rien en pause quand PLUSIEURS comptes répondent tous la même chose", async () => {
    // Plusieurs comptes ne disparaissent pas la même nuit : c'est notre
    // appel qui est faux, et éteindre le radar entier serait la pire
    // réponse.
    const saved: Record<string, Partial<RadarAccount>> = {};
    const { store, providers } = storeWith(
      [account({ id: "a1", platform: "instagram" }), account({ id: "a2", platform: "instagram" })],
      {
        instagram: async () => {
          throw new Error("404 not found");
        },
      },
      saved,
    );

    const report = await collectRadar({ store, providers, now: () => new Date("2026-09-12T00:00:00Z") });

    expect(report.errors).toHaveLength(2);
    expect(report.paused).toHaveLength(0);
    expect(saved.a1?.is_active).toBeUndefined();
  });
});
