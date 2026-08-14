/**
 * Isolation des comptes sociaux.
 *
 * Le modèle a deux étages, et c'est là que se joue le cloisonnement :
 *
 *   `social_accounts`            l'inventaire de l'agence — un seul login Meta
 *                                atteint les comptes de **tous** les clients
 *   `workspace_social_accounts`  l'affectation — sur quel compte ce client
 *                                publie, un par réseau
 *   `social_account_secrets`     les jetons, qui ne sortent jamais de l'agence
 *
 * Ce que ces tests prouvent, dans la base et hors de toute interface :
 *
 *   * un client ne voit pas l'inventaire — sinon il lirait le nom des comptes
 *     Instagram de ses concurrents ;
 *   * il voit en revanche **le compte affecté à son espace** : la
 *     prévisualisation du feed en a besoin pour son en-tête ;
 *   * il ne voit jamais un jeton, même chiffré, même le sien ;
 *   * il ne peut pas s'affecter un compte lui-même — publier engage l'agence ;
 *   * et l'agence, elle, peut affecter, ce qui est l'autre moitié de la règle.
 *
 * Jeu éphémère sur le vrai projet Supabase, préfixé `zz-social-`, nettoyé en
 * fin de suite.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const configured = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);
const suite = configured ? describe : describe.skip;

const RUN = `zz-social-${Date.now()}`;
const PASSWORD = "Test!Social-2026";

const emails = {
  owner: `${RUN}-owner@antidotes.test`,
  clientA: `${RUN}-client-a@antidotes.test`,
  clientB: `${RUN}-client-b@antidotes.test`,
};

suite("isolation des comptes sociaux (RLS)", () => {
  let admin!: SupabaseClient;

  const ids = {
    org: "",
    workspaceA: "",
    workspaceB: "",
    accountA: "",
    accountB: "",
    pageA: "",
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

  /** Un compte de l'inventaire, avec son jeton rangé à côté. */
  async function seedAccount(externalId: string, name: string, kind = "instagram") {
    const { data, error } = await admin
      .from("social_accounts")
      .insert({
        org_id: ids.org,
        kind,
        external_id: externalId,
        username: `@${externalId}`,
        display_name: name,
        followers_count: 1234,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Migration 0044 non appliquée ? ${error.message}`);

    const { error: secretError } = await admin
      .from("social_account_secrets")
      .insert({
        account_id: data.id,
        org_id: ids.org,
        credentials_encrypted: `chiffre-${externalId}`,
        scopes: ["instagram_basic"],
      });
    if (secretError) throw new Error(secretError.message);

    return data.id as string;
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

    const { data: workspaces, error: workspaceError } = await admin
      .from("workspaces")
      .insert([
        { org_id: ids.org, type: "client", slug: `${RUN}-a`, name: "Client A" },
        { org_id: ids.org, type: "client", slug: `${RUN}-b`, name: "Client B" },
      ])
      .select("id, slug");
    if (workspaceError) throw new Error(workspaceError.message);
    ids.workspaceA = workspaces!.find((w) => w.slug === `${RUN}-a`)!.id;
    ids.workspaceB = workspaces!.find((w) => w.slug === `${RUN}-b`)!.id;

    ids.accountA = await seedAccount("compte-a", "Compte du client A");
    ids.accountB = await seedAccount("compte-b", "Compte du client B");
    ids.pageA = await seedAccount("page-a", "Page du client A", "facebook_page");

    // Seul le compte A est affecté à l'espace A. Le compte B reste dans
    // l'inventaire sans affectation : c'est le cas du compte qu'on vient de
    // brancher et qu'on n'a pas encore attribué.
    const { error: linkError } = await admin
      .from("workspace_social_accounts")
      .insert({
        workspace_id: ids.workspaceA,
        kind: "instagram",
        account_id: ids.accountA,
        org_id: ids.org,
      });
    if (linkError) throw new Error(linkError.message);

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

  describe("l'inventaire reste chez l'agence", () => {
    it("le client ne lit que le compte affecté à son espace", async () => {
      const { data } = await clients.clientA
        .from("social_accounts")
        .select("id")
        .in("id", [ids.accountA, ids.accountB, ids.pageA]);

      expect(data?.map((row) => row.id)).toEqual([ids.accountA]);
    });

    it("un client sans affectation ne lit aucun compte", async () => {
      const { data } = await clients.clientB
        .from("social_accounts")
        .select("id")
        .in("id", [ids.accountA, ids.accountB]);

      expect(data ?? []).toHaveLength(0);
    });

    it("l'agence lit l'inventaire entier", async () => {
      const { data } = await clients.owner
        .from("social_accounts")
        .select("id")
        .in("id", [ids.accountA, ids.accountB, ids.pageA]);

      expect(data).toHaveLength(3);
    });
  });

  describe("les jetons ne sortent jamais", () => {
    it("le client ne lit pas le secret du compte qui lui est pourtant affecté", async () => {
      const { data } = await clients.clientA
        .from("social_account_secrets")
        .select("account_id")
        .eq("account_id", ids.accountA);

      expect(data ?? []).toHaveLength(0);
    });

    it("l'agence, elle, y accède", async () => {
      const { data } = await clients.owner
        .from("social_account_secrets")
        .select("account_id, credentials_encrypted")
        .eq("account_id", ids.accountA)
        .maybeSingle();

      expect(data?.credentials_encrypted).toBe("chiffre-compte-a");
    });
  });

  describe("l'affectation se lit chez le client, s'écrit chez l'agence", () => {
    it("le client voit sur quel compte son espace publie", async () => {
      const { data } = await clients.clientA
        .from("workspace_social_accounts")
        .select("account_id")
        .eq("workspace_id", ids.workspaceA);

      expect(data?.map((row) => row.account_id)).toEqual([ids.accountA]);
    });

    it("il ne voit pas l'affectation du voisin", async () => {
      const { data } = await clients.clientB
        .from("workspace_social_accounts")
        .select("account_id")
        .eq("workspace_id", ids.workspaceA);

      expect(data ?? []).toHaveLength(0);
    });

    it("il ne peut pas s'affecter un compte lui-même", async () => {
      const { error } = await clients.clientA
        .from("workspace_social_accounts")
        .insert({
          workspace_id: ids.workspaceA,
          kind: "facebook_page",
          account_id: ids.pageA,
          org_id: ids.org,
        });

      expect(error).not.toBeNull();
    });

    it("il ne peut pas détourner l'affectation vers un autre compte", async () => {
      await clients.clientA
        .from("workspace_social_accounts")
        .update({ account_id: ids.accountB })
        .eq("workspace_id", ids.workspaceA)
        .eq("kind", "instagram");

      const { data } = await admin
        .from("workspace_social_accounts")
        .select("account_id")
        .eq("workspace_id", ids.workspaceA)
        .eq("kind", "instagram")
        .maybeSingle();

      expect(data?.account_id).toBe(ids.accountA);
    });

    it("l'agence affecte, et un second appel remplace au lieu de doubler", async () => {
      const { error } = await clients.owner
        .from("workspace_social_accounts")
        .upsert(
          {
            workspace_id: ids.workspaceB,
            kind: "instagram",
            account_id: ids.accountB,
            org_id: ids.org,
          },
          { onConflict: "workspace_id,kind" },
        );
      expect(error).toBeNull();

      const { error: second } = await clients.owner
        .from("workspace_social_accounts")
        .upsert(
          {
            workspace_id: ids.workspaceB,
            kind: "instagram",
            account_id: ids.accountA,
            org_id: ids.org,
          },
          { onConflict: "workspace_id,kind" },
        );
      expect(second).toBeNull();

      const { data } = await admin
        .from("workspace_social_accounts")
        .select("account_id")
        .eq("workspace_id", ids.workspaceB);

      // Un seul compte Instagram pour cet espace, et c'est le dernier choisi :
      // c'est la clé primaire (workspace_id, kind) qui l'impose.
      expect(data).toHaveLength(1);
      expect(data?.[0].account_id).toBe(ids.accountA);
    });
  });
});
