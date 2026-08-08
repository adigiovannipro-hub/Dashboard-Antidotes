/**
 * Isolation du Reporting (tables organiques).
 *
 * Les métriques sociales vivent dans l'espace du client, et c'est l'isolation
 * entre espaces qui les protège. Ces tests le prouvent **dans la base** : ils
 * ouvrent de vraies sessions et attaquent l'API REST directement, hors de
 * toute interface.
 *
 * Le régime diffère du Planning : les tables de données du Reporting sont en
 * **lecture seule** pour tous les utilisateurs — seule la synchronisation
 * (service_role) y écrit. La règle se vérifie donc dans les deux sens : un
 * client lit bien ses propres chiffres, ne voit rien de l'espace voisin, et
 * ne peut rien écrire, pas même chez lui.
 *
 * Comme les autres suites, tout est préfixé `zz-rep-` et nettoyé en fin de
 * suite sur le vrai projet Supabase.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const configured = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);
const suite = configured ? describe : describe.skip;

const RUN = `zz-rep-${Date.now()}`;
const PASSWORD = "Test!Reporting-2026";

const emails = {
  owner: `${RUN}-owner@antidotes.test`,
  clientA: `${RUN}-client-a@antidotes.test`,
  clientB: `${RUN}-client-b@antidotes.test`,
};

suite("isolation du Reporting (RLS)", () => {
  // Créé dans `beforeAll` et non ici : le corps d'un `describe.skip` est tout
  // de même exécuté à la collecte, et `createClient(undefined)` ferait échouer
  // le fichier entier sur une machine sans `.env.local` — au lieu de le sauter.
  let admin!: SupabaseClient;

  const ids = {
    org: "",
    workspaceA: "",
    workspaceB: "",
    sourceA: "",
    sourceB: "",
  };
  const userIds: string[] = [];
  const clients: Record<keyof typeof emails, SupabaseClient> = {} as never;

  async function signIn(email: string) {
    const client = createClient(SUPABASE_URL!, ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
    if (error) throw new Error(`Connexion impossible (${email}) : ${error.message}`);
    return client;
  }

  /** Un espace client avec une source connectée et un mois de métriques. */
  async function seedWorkspace(slug: string, name: string) {
    const { data: workspace, error } = await admin
      .from("workspaces")
      .insert({ org_id: ids.org, type: "client", slug, name })
      .select("id")
      .single();
    if (error) throw new Error(`Migrations non appliquées ? ${error.message}`);

    const { data: source, error: sourceError } = await admin
      .from("data_sources")
      .insert({
        workspace_id: workspace.id,
        provider: "instagram_organic",
        external_account_id: `ig-${slug}`,
        display_name: name,
        status: "connected",
      })
      .select("id")
      .single();
    if (sourceError) throw new Error(`Migration 0023 non appliquée ? ${sourceError.message}`);

    const { error: metricsError } = await admin.from("social_metrics_daily").insert({
      data_source_id: source.id,
      workspace_id: workspace.id,
      platform: "instagram",
      date: "2026-07-31",
      views: 1000,
      reach: 800,
      interactions: 90,
      likes: 70,
    });
    if (metricsError) throw new Error(`Migration 0024 non appliquée ? ${metricsError.message}`);

    const { error: demoError } = await admin.from("social_demographics").insert({
      data_source_id: source.id,
      workspace_id: workspace.id,
      platform: "instagram",
      date: "2026-07-01",
      dimension: "age",
      value: "25-34",
      followers_count: 1200,
    });
    if (demoError) throw new Error(`Migration 0024 non appliquée ? ${demoError.message}`);

    return { workspaceId: workspace.id, sourceId: source.id };
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

    const a = await seedWorkspace(`${RUN}-a`, "Client A");
    const b = await seedWorkspace(`${RUN}-b`, "Client B");
    ids.workspaceA = a.workspaceId;
    ids.sourceA = a.sourceId;
    ids.workspaceB = b.workspaceId;
    ids.sourceB = b.sourceId;

    // Les invitations précèdent la création des comptes : c'est le trigger
    // `app.handle_new_user` qui transforme l'invitation en accès.
    await admin.from("invitations").insert([
      { email: emails.owner, org_id: ids.org, workspace_id: null, role: "owner" },
      {
        email: emails.clientA,
        org_id: ids.org,
        workspace_id: ids.workspaceA,
        role: "client",
      },
      {
        email: emails.clientB,
        org_id: ids.org,
        workspace_id: ids.workspaceB,
        role: "client",
      },
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
    if (ids.org) await admin.from("organizations").delete().eq("id", ids.org);
    await admin.from("invitations").delete().like("email", `${RUN}%`);
  });

  describe("un client lit ses chiffres et seulement les siens", () => {
    it("lit les métriques de son propre espace", async () => {
      const { data } = await clients.clientA
        .from("social_metrics_daily")
        .select("views, likes")
        .eq("workspace_id", ids.workspaceA);
      expect(data).toEqual([{ views: 1000, likes: 70 }]);
    });

    it("ne lit aucune métrique de l'espace voisin, même en ciblant sa source", async () => {
      const { data } = await clients.clientA
        .from("social_metrics_daily")
        .select("views")
        .eq("data_source_id", ids.sourceB);
      expect(data).toEqual([]);
    });

    it("ne lit pas la démographie d'un autre espace", async () => {
      const [{ data: own }, { data: other }] = await Promise.all([
        clients.clientA
          .from("social_demographics")
          .select("value")
          .eq("workspace_id", ids.workspaceA),
        clients.clientA
          .from("social_demographics")
          .select("value")
          .eq("workspace_id", ids.workspaceB),
      ]);
      expect(own).toEqual([{ value: "25-34" }]);
      expect(other).toEqual([]);
    });

    it("l'owner de l'organisation voit les deux espaces", async () => {
      const { data } = await clients.owner
        .from("social_metrics_daily")
        .select("workspace_id")
        .in("workspace_id", [ids.workspaceA, ids.workspaceB]);
      expect(data?.map((row) => row.workspace_id).sort()).toEqual(
        [ids.workspaceA, ids.workspaceB].sort(),
      );
    });
  });

  describe("les tables de données sont en lecture seule pour tous", () => {
    it("un client ne peut pas insérer de métriques, même chez lui", async () => {
      const { error } = await clients.clientA.from("social_metrics_daily").insert({
        data_source_id: ids.sourceA,
        workspace_id: ids.workspaceA,
        platform: "instagram",
        date: "2026-08-01",
        views: 1,
      });
      expect(error).not.toBeNull();
    });

    it("un client ne peut pas modifier ses métriques ni celles du voisin", async () => {
      const [{ data: own }, { data: other }] = await Promise.all([
        clients.clientA
          .from("social_metrics_daily")
          .update({ views: 999999 })
          .eq("workspace_id", ids.workspaceA)
          .select("views"),
        clients.clientA
          .from("social_metrics_daily")
          .update({ views: 999999 })
          .eq("workspace_id", ids.workspaceB)
          .select("views"),
      ]);
      expect(own).toEqual([]);
      expect(other).toEqual([]);
    });

    it("même l'owner n'écrit pas dans les métriques — c'est le rôle de la synchronisation", async () => {
      const { error } = await clients.owner.from("social_demographics").insert({
        data_source_id: ids.sourceA,
        workspace_id: ids.workspaceA,
        platform: "instagram",
        date: "2026-08-01",
        dimension: "gender",
        value: "female",
        followers_count: 1,
      });
      expect(error).not.toBeNull();
    });
  });
});
