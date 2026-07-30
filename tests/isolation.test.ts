/**
 * Tests d'isolation — la garantie centrale de la plateforme.
 *
 * Ils prouvent qu'un client ne peut lire les données d'aucun autre espace,
 * **y compris en attaquant l'API REST directement avec son propre jeton**,
 * hors de toute interface. L'isolation est vérifiée là où elle est réellement
 * appliquée : dans la base, par la RLS.
 *
 * Ces tests créent puis suppriment un jeu de comptes et une organisation
 * éphémères sur le vrai projet Supabase. Tout est préfixé `zz-test-` et nettoyé
 * en fin de suite, y compris si un test échoue.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const configured = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);
const suite = configured ? describe : describe.skip;

const RUN = `zz-test-${Date.now()}`;
const PASSWORD = "Test!Isolation-2026";

const emails = {
  owner: `${RUN}-owner@antidotes.test`,
  contributor: `${RUN}-contributor@antidotes.test`,
  clientA: `${RUN}-client-a@antidotes.test`,
  clientB: `${RUN}-client-b@antidotes.test`,
};

suite("isolation entre espaces (RLS)", () => {
  const admin = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ids = {
    org: "",
    personal: "",
    clientA: "",
    clientB: "",
    entityB: "",
    dashboardA: "",
  };
  const userIds: string[] = [];
  const clients: Record<keyof typeof emails, SupabaseClient> = {} as never;

  /** Ouvre une session réelle et renvoie un client porteur du jeton anon. */
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

  beforeAll(async () => {
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
        { org_id: ids.org, type: "personal", slug: "perso", name: "Perso" },
        { org_id: ids.org, type: "client", slug: "client-a", name: "Client A" },
        { org_id: ids.org, type: "client", slug: "client-b", name: "Client B" },
      ])
      .select("id, slug");

    for (const workspace of workspaces ?? []) {
      if (workspace.slug === "perso") ids.personal = workspace.id;
      if (workspace.slug === "client-a") ids.clientA = workspace.id;
      if (workspace.slug === "client-b") ids.clientB = workspace.id;
    }

    // Une source et des données confidentielles côté client B : c'est ce que
    // le client A ne doit jamais voir.
    const { data: source } = await admin
      .from("data_sources")
      .insert({
        workspace_id: ids.clientB,
        provider: "meta_ads",
        external_account_id: `act_${RUN}`,
        status: "connected",
      })
      .select("id")
      .single();

    const { data: entity } = await admin
      .from("ad_entities")
      .insert({
        data_source_id: source!.id,
        workspace_id: ids.clientB,
        level: "campaign",
        external_id: `camp_${RUN}`,
        name: "Campagne confidentielle de B",
      })
      .select("id")
      .single();
    ids.entityB = entity!.id;

    await admin.from("ad_metrics_daily").insert({
      data_source_id: source!.id,
      workspace_id: ids.clientB,
      entity_id: ids.entityB,
      date: "2026-06-01",
      spend: 1234.56,
      impressions: 99_999,
    });

    const { data: dashboard } = await admin
      .from("dashboards")
      .insert({ workspace_id: ids.clientA, slug: "meta", name: "Meta" })
      .select("id")
      .single();
    ids.dashboardA = dashboard!.id;

    // Les invitations doivent précéder la création des comptes : c'est le
    // trigger `app.handle_new_user` qui transforme l'invitation en accès.
    await admin.from("invitations").insert([
      { email: emails.owner, org_id: ids.org, workspace_id: null, role: "owner" },
      {
        email: emails.contributor,
        org_id: ids.org,
        workspace_id: ids.clientA,
        role: "contributor",
      },
      {
        email: emails.clientA,
        org_id: ids.org,
        workspace_id: ids.clientA,
        role: "client",
      },
      {
        email: emails.clientB,
        org_id: ids.org,
        workspace_id: ids.clientB,
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

  describe("un client ne voit que son espace", () => {
    it("ne liste que son propre workspace", async () => {
      const { data } = await clients.clientA.from("workspaces").select("id, slug");
      expect(data?.map((w) => w.slug)).toEqual(["client-a"]);
    });

    it("ne lit aucune métrique d'un autre client, même en ciblant son id", async () => {
      const { data, error } = await clients.clientA
        .from("ad_metrics_daily")
        .select("*")
        .eq("workspace_id", ids.clientB);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("ne lit aucune entité publicitaire d'un autre client", async () => {
      const { data } = await clients.clientA
        .from("ad_entities")
        .select("*")
        .eq("id", ids.entityB);
      expect(data).toEqual([]);
    });

    it("ne voit pas les connexions API d'un autre client", async () => {
      const { data } = await clients.clientA.from("data_sources").select("*");
      expect(data).toEqual([]);
    });

    it("ne peut pas énumérer les autres utilisateurs de la plateforme", async () => {
      const { data } = await clients.clientA.from("memberships").select("*");
      expect(data).toHaveLength(1);
      expect(data?.[0]?.workspace_id).toBe(ids.clientA);
    });

    it("ne peut pas s'inviter lui-même sur un autre espace", async () => {
      const { error } = await clients.clientA.from("memberships").insert({
        user_id: userIds[2],
        workspace_id: ids.clientB,
        role: "client",
      });
      expect(error).not.toBeNull();
    });

    it("ne peut pas écrire dans les tables de données", async () => {
      const { error } = await clients.clientA.from("ad_metrics_daily").insert({
        workspace_id: ids.clientA,
        entity_id: ids.entityB,
        date: "2026-06-02",
        spend: 1,
      });
      expect(error).not.toBeNull();
    });

    it("peut en revanche modifier la disposition de son propre dashboard", async () => {
      const { error } = await clients.clientA
        .from("dashboards")
        .update({ layout: { kpis: ["spend", "roas"] } })
        .eq("id", ids.dashboardA);
      expect(error).toBeNull();
    });
  });

  describe("le contributeur interne", () => {
    it("accède aux espaces clients où il est rattaché", async () => {
      const { data } = await clients.contributor.from("workspaces").select("slug");
      expect(data?.map((w) => w.slug)).toEqual(["client-a"]);
    });

    it("n'accède jamais à l'espace personnel de l'owner", async () => {
      const { data } = await clients.contributor
        .from("workspaces")
        .select("*")
        .eq("id", ids.personal);
      expect(data).toEqual([]);
    });

    it("ne peut pas créer d'espace", async () => {
      const { error } = await clients.contributor
        .from("workspaces")
        .insert({ org_id: ids.org, type: "client", slug: "pirate", name: "Pirate" });
      expect(error).not.toBeNull();
    });
  });

  describe("l'owner", () => {
    it("voit tous les espaces, y compris le personnel", async () => {
      const { data } = await clients.owner.from("workspaces").select("slug");
      expect(data?.map((w) => w.slug).sort()).toEqual([
        "client-a",
        "client-b",
        "perso",
      ]);
    });

    it("lit les données de tous les clients", async () => {
      const { data } = await clients.owner.from("ad_metrics_daily").select("spend");
      expect(data?.length).toBeGreaterThan(0);
    });
  });

  describe("le visiteur anonyme", () => {
    it("n'obtient rien sans session", async () => {
      const anon = createClient(SUPABASE_URL!, ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data } = await anon.from("workspaces").select("*");
      expect(data ?? []).toEqual([]);
    });
  });
});
