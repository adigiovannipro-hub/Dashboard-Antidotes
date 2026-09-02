/**
 * Tests d'isolation des compteurs cumulés LinkedIn (migrations 20260902c-e).
 *
 * Même méthode que les autres suites : de vraies sessions Supabase, l'API
 * REST attaquée directement, et **les deux sens** de la règle — un client lit
 * ses compteurs (une politique trop stricte casse le produit), il ne lit ni
 * ne modifie ceux du voisin, et personne n'écrit un compteur à la main : la
 * table est en lecture seule pour `authenticated`, seul le connecteur
 * (service_role) y écrit.
 *
 * Tout est préfixé `zz-li-` et nettoyé en fin de suite.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const configured = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);
const suite = configured ? describe : describe.skip;

const RUN = `zz-li-${Date.now()}`;
const PASSWORD = "Test!Isolation-2026";

const emails = {
  owner: `${RUN}-owner@antidotes.test`,
  clientA: `${RUN}-client-a@antidotes.test`,
  clientB: `${RUN}-client-b@antidotes.test`,
};

/* Les chiffres sont ceux relevés sur la vraie page ANMF le 2 septembre 2026 :
   un jeu de test qui ressemble à la production se relit sans effort. */
const TOTAUX = {
  impressions: 494051,
  reach: 206950,
  clicks: 59001,
  likes: 7436,
  comments: 123,
  shares: 48,
};

suite("isolation des compteurs LinkedIn (RLS)", () => {
  // Créé dans `beforeAll` : le corps d'un `describe.skip` est exécuté à la
  // collecte, et `createClient(undefined)` ferait échouer le fichier entier.
  let admin!: SupabaseClient;

  const ids = { org: "", clientA: "", clientB: "", sourceA: "", sourceB: "" };
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

    // Une page LinkedIn et ses compteurs dans **chaque** espace : l'isolation
    // se prouve dans les deux sens, lire chez soi et ne rien voir chez l'autre.
    for (const [key, workspaceId] of [
      ["sourceA", ids.clientA],
      ["sourceB", ids.clientB],
    ] as const) {
      const { data: source, error: sourceError } = await admin
        .from("data_sources")
        .insert({
          workspace_id: workspaceId,
          provider: "linkedin_organic",
          external_account_id: `${RUN}-${key}`,
          status: "connected",
        })
        .select("id")
        .single();
      if (sourceError) {
        throw new Error(
          `Source LinkedIn impossible (20260902c appliquée ?) : ${sourceError.message}`,
        );
      }
      ids[key] = source!.id;

      const { error: totalsError } = await admin.from("social_lifetime_totals").insert({
        data_source_id: source!.id,
        workspace_id: workspaceId,
        platform: "linkedin",
        date: "2026-09-01",
        ...TOTAUX,
      });
      if (totalsError) {
        throw new Error(
          `Semis impossible (20260902d appliquée ?) : ${totalsError.message}`,
        );
      }
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
    // La cascade emporte espaces, sources et compteurs avec l'organisation.
    if (ids.org) await admin.from("organizations").delete().eq("id", ids.org);
    await admin.from("invitations").delete().like("email", `${RUN}%`);
  });

  describe("un client lit ses compteurs — la moitié qu'on oublie de tester", () => {
    it("lit le relevé de sa page", async () => {
      const { data, error } = await clients.clientA
        .from("social_lifetime_totals")
        .select("impressions, reach, likes");
      expect(error).toBeNull();
      expect(data).toEqual([
        { impressions: TOTAUX.impressions, reach: TOTAUX.reach, likes: TOTAUX.likes },
      ]);
    });
  });

  describe("un client ne voit pas les compteurs du voisin", () => {
    it("obtient zéro ligne même en ciblant l'espace de l'autre", async () => {
      const { data, error } = await clients.clientA
        .from("social_lifetime_totals")
        .select("*")
        .eq("workspace_id", ids.clientB);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("ne modifie pas le relevé du voisin, et le silence le prouve", async () => {
      // Un `update` filtré par la RLS ne touche aucune ligne — le compteur du
      // voisin ne bouge pas.
      await clients.clientA
        .from("social_lifetime_totals")
        .update({ impressions: 1 })
        .eq("workspace_id", ids.clientB);

      const { data } = await admin
        .from("social_lifetime_totals")
        .select("impressions")
        .eq("workspace_id", ids.clientB)
        .single();
      expect(data?.impressions).toBe(TOTAUX.impressions);
    });
  });

  describe("personne ne saisit un compteur à la main", () => {
    it("refuse l'écriture d'un client, même chez lui — la mesure vient du connecteur", async () => {
      const { error } = await clients.clientA.from("social_lifetime_totals").insert({
        data_source_id: ids.sourceA,
        workspace_id: ids.clientA,
        platform: "linkedin",
        date: "2026-09-02",
        impressions: 1,
      });
      expect(error).not.toBeNull();
    });
  });

  describe("l'owner", () => {
    it("lit les compteurs de tous ses clients", async () => {
      const { data } = await clients.owner
        .from("social_lifetime_totals")
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
      const { data, error } = await anonymous.from("social_lifetime_totals").select("*");
      // Selon la version de PostgREST, le refus est une erreur ou une liste
      // vide — les deux disent la même chose : rien ne fuite.
      expect(error !== null || data?.length === 0).toBe(true);
    });
  });
});
