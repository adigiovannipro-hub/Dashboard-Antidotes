/**
 * Isolation du Contexte client.
 *
 * Le Contexte est un module **owner-only** : contrairement au Planning, un
 * client n'a le droit ni de lire ni d'écrire quoi que ce soit — pas même dans
 * son propre espace. Ces tests le prouvent **dans la base** : de vraies
 * sessions Supabase, l'API REST attaquée directement, hors de toute interface.
 *
 * Ils vérifient les deux sens de la règle : le client n'obtient rien (ni son
 * espace, ni le voisin), **et** l'owner lit et écrit bien partout — une
 * politique trop stricte casserait la page aussi sûrement qu'une politique
 * trop large ferait fuiter le brief.
 *
 * Comme `isolation.test.ts`, ils créent puis suppriment un jeu éphémère sur le
 * vrai projet Supabase. Tout est préfixé `zz-ctx-` et nettoyé en fin de suite.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const configured = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);
const suite = configured ? describe : describe.skip;

const RUN = `zz-ctx-${Date.now()}`;
const PASSWORD = "Test!Contexte-2026";

const emails = {
  owner: `${RUN}-owner@antidotes.test`,
  clientA: `${RUN}-client-a@antidotes.test`,
  contributorA: `${RUN}-contributor-a@antidotes.test`,
};

suite("isolation du Contexte client (RLS)", () => {
  // Créé dans `beforeAll` et non ici : le corps d'un `describe.skip` est tout
  // de même exécuté à la collecte, et `createClient(undefined)` ferait échouer
  // le fichier entier sur une machine sans `.env.local` — au lieu de le sauter.
  let admin!: SupabaseClient;

  const ids = {
    org: "",
    workspaceA: "",
    workspaceB: "",
    contextA: "",
    contextB: "",
    assetA: "",
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

  /** Un espace client avec son brief, un document et une accroche. */
  async function seedWorkspace(slug: string, name: string) {
    const { data: workspace, error } = await admin
      .from("workspaces")
      .insert({ org_id: ids.org, type: "client", slug, name })
      .select("id")
      .single();
    if (error) throw new Error(`Migrations non appliquées ? ${error.message}`);

    const { data: context, error: contextError } = await admin
      .from("client_context")
      .insert({
        workspace_id: workspace.id,
        main_context: `Brief confidentiel de ${name}`,
        restrictions: `Interdits de ${name}`,
      })
      .select("id")
      .single();
    if (contextError) {
      throw new Error(`Migration 0032 non appliquée ? ${contextError.message}`);
    }

    const { data: asset } = await admin
      .from("client_assets")
      .insert({
        workspace_id: workspace.id,
        name: `strategie-${slug}.pdf`,
        type: "strategy",
        storage_path: `${workspace.id}/contexte/strategie.pdf`,
        summary: `Résumé confidentiel de ${name}`,
      })
      .select("id")
      .single();

    // Colonne `hook`, et `org_id` obligatoire : la table vient de la branche
    // des cartes client, appliquée la première à la base. Voir 0037.
    const { error: hookError } = await admin.from("wording_history").insert({
      org_id: ids.org,
      workspace_id: workspace.id,
      hook: `Accroche déjà publiée chez ${name}`,
    });
    if (hookError) throw new Error(`Migration 0037 non appliquée ? ${hookError.message}`);

    return { workspaceId: workspace.id, contextId: context.id, assetId: asset!.id };
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
    ids.contextA = a.contextId;
    ids.assetA = a.assetId;
    ids.workspaceB = b.workspaceId;
    ids.contextB = b.contextId;

    // Les invitations précèdent la création des comptes : c'est le trigger
    // `app.handle_new_user` qui transforme l'invitation en accès. Le client A
    // est membre de l'espace A — et ne doit rien y lire pour autant.
    await admin.from("invitations").insert([
      { email: emails.owner, org_id: ids.org, workspace_id: null, role: "owner" },
      {
        email: emails.clientA,
        org_id: ids.org,
        workspace_id: ids.workspaceA,
        role: "client",
      },
      {
        email: emails.contributorA,
        org_id: ids.org,
        workspace_id: ids.workspaceA,
        role: "contributor",
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

  describe("un client ne voit rien du Contexte, pas même le sien", () => {
    it("ne lit le brief d'aucun espace, y compris le sien", async () => {
      const { data } = await clients.clientA
        .from("client_context")
        .select("id, main_context")
        .in("id", [ids.contextA, ids.contextB]);
      expect(data).toEqual([]);
    });

    it("ne lit aucun document ni son résumé", async () => {
      const { data } = await clients.clientA
        .from("client_assets")
        .select("id, summary")
        .eq("workspace_id", ids.workspaceA);
      expect(data).toEqual([]);
    });

    it("ne lit aucune accroche de l'historique", async () => {
      const { data } = await clients.clientA
        .from("wording_history")
        .select("id")
        .in("workspace_id", [ids.workspaceA, ids.workspaceB]);
      expect(data).toEqual([]);
    });

    it("ne peut pas modifier le brief, même en ciblant son id", async () => {
      const { data } = await clients.clientA
        .from("client_context")
        .update({ main_context: "Injection" })
        .eq("id", ids.contextA)
        .select("id");
      expect(data ?? []).toEqual([]);

      const { data: after } = await admin
        .from("client_context")
        .select("main_context")
        .eq("id", ids.contextA)
        .single();
      expect(after?.main_context).toContain("Client A");
    });

    it("ne peut ni déposer un document ni écrire une accroche", async () => {
      const { error: assetError } = await clients.clientA.from("client_assets").insert({
        workspace_id: ids.workspaceA,
        name: "intrusion.pdf",
        type: "other",
        storage_path: `${ids.workspaceA}/contexte/intrusion.pdf`,
      });
      expect(assetError).not.toBeNull();

      const { error: accrocheError } = await clients.clientA
        .from("wording_history")
        .insert({
          org_id: ids.org,
          workspace_id: ids.workspaceA,
          hook: "Accroche intruse",
        });
      expect(accrocheError).not.toBeNull();
    });
  });

  /**
   * L'autre moitié de la règle, celle qu'on oublie de tester : une politique
   * trop stricte casse le produit aussi sûrement qu'une trop large le rend
   * dangereux. Le contributeur *doit* pouvoir travailler le brief.
   */
  describe("un contributeur travaille le Contexte de son espace, et de lui seul", () => {
    it("lit le brief de son espace", async () => {
      const { data } = await clients.contributorA
        .from("client_context")
        .select("id")
        .eq("workspace_id", ids.workspaceA);
      expect(data?.length ?? 0).toBeGreaterThan(0);
    });

    it("modifie le brief de son espace et retrouve sa valeur", async () => {
      const marque = `contributeur ${RUN}`;
      const { error } = await clients.contributorA
        .from("client_context")
        .update({ main_context: marque })
        .eq("id", ids.contextA);
      expect(error).toBeNull();

      const { data } = await admin
        .from("client_context")
        .select("main_context")
        .eq("id", ids.contextA)
        .single();
      expect(data?.main_context).toBe(marque);
    });

    it("ne lit pas le brief de l'espace voisin", async () => {
      const { data } = await clients.contributorA
        .from("client_context")
        .select("id")
        .eq("workspace_id", ids.workspaceB);
      expect(data ?? []).toHaveLength(0);
    });

    it("ne peut pas modifier le brief de l'espace voisin", async () => {
      await clients.contributorA
        .from("client_context")
        .update({ main_context: `intrusion ${RUN}` })
        .eq("id", ids.contextB);

      const { data } = await admin
        .from("client_context")
        .select("main_context")
        .eq("id", ids.contextB)
        .single();
      expect(data?.main_context).not.toContain("intrusion");
    });
  });

  describe("l'owner de l'organisation lit et écrit", () => {
    it("voit les briefs des deux espaces", async () => {
      const { data } = await clients.owner
        .from("client_context")
        .select("id")
        .in("id", [ids.contextA, ids.contextB]);
      expect(data).toHaveLength(2);
    });

    it("modifie un brief et retrouve sa valeur", async () => {
      const { data } = await clients.owner
        .from("client_context")
        .update({ positioning: "Positionnement revu par l'owner" })
        .eq("id", ids.contextA)
        .select("positioning");
      expect(data?.[0]?.positioning).toBe("Positionnement revu par l'owner");
    });

    it("coche et décoche l'injection d'un document", async () => {
      const { data } = await clients.owner
        .from("client_assets")
        .update({ include_in_context: false })
        .eq("id", ids.assetA)
        .select("include_in_context");
      expect(data?.[0]?.include_in_context).toBe(false);
    });

    it("historise une accroche validée", async () => {
      const { error } = await clients.owner.from("wording_history").insert({
        org_id: ids.org,
        workspace_id: ids.workspaceA,
        hook: "Nouvelle accroche validée par l'owner",
      });
      expect(error).toBeNull();
    });
  });
});
