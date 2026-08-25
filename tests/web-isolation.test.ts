/**
 * Tests d'isolation du trafic web (migrations 0060-0061).
 *
 * Même méthode que les autres suites : de vraies sessions Supabase, l'API
 * REST attaquée directement, et **les deux sens** de la règle — un client lit
 * son trafic (une politique trop stricte casse le produit), il ne lit ni ne
 * modifie celui du voisin, et personne n'écrit une session à la main : les
 * quatre tables sont en lecture seule pour `authenticated`, seul le
 * connecteur (service_role) y écrit.
 *
 * Tout est préfixé `zz-web-` et nettoyé en fin de suite.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const configured = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);
const suite = configured ? describe : describe.skip;

const RUN = `zz-web-${Date.now()}`;
const PASSWORD = "Test!Isolation-2026";

const emails = {
  owner: `${RUN}-owner@antidotes.test`,
  clientA: `${RUN}-client-a@antidotes.test`,
  clientB: `${RUN}-client-b@antidotes.test`,
};

const WEB_TABLES = [
  "web_metrics_daily",
  "web_metrics_monthly",
  "web_breakdowns_monthly",
  "web_pages_monthly",
] as const;

suite("isolation du trafic web (RLS)", () => {
  // Créé dans `beforeAll` : le corps d'un `describe.skip` est exécuté à la
  // collecte, et `createClient(undefined)` ferait échouer le fichier entier.
  let admin!: SupabaseClient;

  const ids = {
    org: "",
    clientA: "",
    clientB: "",
    sourceA: "",
    sourceB: "",
  };
  const userIds: string[] = [];
  const clients: Record<keyof typeof emails, SupabaseClient> = {} as never;

  async function signIn(email: string) {
    const client = createClient(SUPABASE_URL!, ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await client.auth.signInWithPassword({
      email,
      password: PASSWORD,
    });
    if (error) throw new Error(`Connexion impossible (${email}) : ${error.message}`);
    return client;
  }

  /** Une ligne de chaque table web pour un espace — le jeu minimal lisible. */
  async function seedWebRows(workspaceId: string, sourceId: string) {
    const stamp = { data_source_id: sourceId, workspace_id: workspaceId };
    const inserts = [
      admin.from("web_metrics_daily").insert({
        ...stamp,
        date: "2026-07-18",
        total_users: 616,
        sessions: 700,
        engaged_sessions: 82,
        page_views: 801,
        session_seconds: 21301,
      }),
      admin.from("web_metrics_monthly").insert({
        ...stamp,
        month: "2026-07-01",
        total_users: 16433,
        new_users: 15863,
      }),
      admin.from("web_breakdowns_monthly").insert({
        ...stamp,
        month: "2026-07-01",
        type: "source",
        value: "tiktok",
        users: 9000,
        sessions: 11353,
      }),
      admin.from("web_pages_monthly").insert({
        ...stamp,
        month: "2026-07-01",
        path: "/",
        views: 18115,
        sessions: 17397,
        engaged_sessions: 1975,
        session_seconds: 360966,
      }),
    ];
    for (const insert of inserts) {
      const { error } = await insert;
      if (error) throw new Error(`Semis impossible (migré ?) : ${error.message}`);
    }
  }

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: org, error: orgError } = await admin
      .from("organizations")
      .insert({ name: `Org ${RUN}`, slug: RUN })
      .select("id")
      .single();
    if (orgError) throw new Error(`Migrations non appliquées ? ${orgError.message}`);
    ids.org = org.id;

    const { data: workspaces } = await admin
      .from("workspaces")
      .insert([
        { org_id: ids.org, type: "client", slug: "client-a", name: "Client A" },
        { org_id: ids.org, type: "client", slug: "client-b", name: "Client B" },
      ])
      .select("id, slug");
    for (const workspace of workspaces ?? []) {
      if (workspace.slug === "client-a") ids.clientA = workspace.id;
      if (workspace.slug === "client-b") ids.clientB = workspace.id;
    }

    // Une propriété GA et du trafic dans **chaque** espace : l'isolation se
    // prouve dans les deux sens, lire chez soi et ne rien voir chez l'autre.
    for (const [key, workspaceId] of [
      ["sourceA", ids.clientA],
      ["sourceB", ids.clientB],
    ] as const) {
      const { data: source, error: sourceError } = await admin
        .from("data_sources")
        .insert({
          workspace_id: workspaceId,
          provider: "google_analytics",
          external_account_id: `properties/${RUN}-${key}`,
          status: "connected",
        })
        .select("id")
        .single();
      if (sourceError) {
        throw new Error(`Source GA impossible (0060 appliquée ?) : ${sourceError.message}`);
      }
      ids[key] = source!.id;
      await seedWebRows(workspaceId, source!.id);
    }

    await admin.from("invitations").insert([
      { email: emails.owner, org_id: ids.org, workspace_id: null, role: "owner" },
      { email: emails.clientA, org_id: ids.org, workspace_id: ids.clientA, role: "client" },
      { email: emails.clientB, org_id: ids.org, workspace_id: ids.clientB, role: "client" },
    ]);

    for (const [key, email] of Object.entries(emails)) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
      });
      if (error) throw new Error(`Création du compte ${email} : ${error.message}`);
      userIds.push(data.user.id);
      clients[key as keyof typeof emails] = await signIn(email);
    }
  });

  afterAll(async () => {
    for (const userId of userIds) {
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    }
    // La cascade emporte espaces, sources et lignes web avec l'organisation.
    if (ids.org) await admin.from("organizations").delete().eq("id", ids.org);
    await admin.from("invitations").delete().like("email", `${RUN}%`);
  });

  describe("un client lit son trafic — la moitié qu'on oublie de tester", () => {
    it("lit ses métriques quotidiennes", async () => {
      const { data, error } = await clients.clientA
        .from("web_metrics_daily")
        .select("total_users, sessions");
      expect(error).toBeNull();
      expect(data).toEqual([{ total_users: 616, sessions: 700 }]);
    });

    it("lit ses uniques mensuels, ses ventilations et ses pages", async () => {
      for (const table of WEB_TABLES.slice(1)) {
        const { data, error } = await clients.clientA
          .from(table)
          .select("workspace_id");
        expect(error).toBeNull();
        expect(data).toEqual([{ workspace_id: ids.clientA }]);
      }
    });
  });

  describe("un client ne voit pas le trafic du voisin", () => {
    it("obtient zéro ligne même en ciblant l'espace de l'autre", async () => {
      for (const table of WEB_TABLES) {
        const { data, error } = await clients.clientA
          .from(table)
          .select("*")
          .eq("workspace_id", ids.clientB);
        expect(error).toBeNull();
        expect(data).toEqual([]);
      }
    });

    it("ne modifie pas les lignes du voisin, et le silence le prouve", async () => {
      // Un `update` filtré par la RLS ne touche aucune ligne — la mesure du
      // voisin ne bouge pas.
      await clients.clientA
        .from("web_metrics_daily")
        .update({ total_users: 1 })
        .eq("workspace_id", ids.clientB);

      const { data } = await admin
        .from("web_metrics_daily")
        .select("total_users")
        .eq("workspace_id", ids.clientB)
        .single();
      expect(data?.total_users).toBe(616);
    });
  });

  describe("personne ne saisit une session à la main", () => {
    it("refuse l'écriture d'un client, même chez lui — la mesure vient du connecteur", async () => {
      const { error } = await clients.clientA.from("web_metrics_daily").insert({
        data_source_id: ids.sourceA,
        workspace_id: ids.clientA,
        date: "2026-07-19",
        total_users: 1,
      });
      expect(error).not.toBeNull();
    });
  });

  describe("l'owner", () => {
    it("lit le trafic de tous ses clients", async () => {
      const { data } = await clients.owner
        .from("web_metrics_daily")
        .select("workspace_id");
      const spaces = new Set(data?.map((row) => row.workspace_id));
      expect(spaces.has(ids.clientA)).toBe(true);
      expect(spaces.has(ids.clientB)).toBe(true);
    });
  });

  describe("le visiteur anonyme", () => {
    it("n'obtient rien sans session", async () => {
      const anonymous = createClient(SUPABASE_URL!, ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      for (const table of WEB_TABLES) {
        const { data, error } = await anonymous.from(table).select("*");
        // Selon la version de PostgREST, le refus est une erreur ou une liste
        // vide — les deux disent la même chose : rien ne fuite.
        expect(error !== null || data?.length === 0).toBe(true);
      }
    });
  });
});
