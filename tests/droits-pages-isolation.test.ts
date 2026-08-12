/**
 * Isolation des droits par page.
 *
 * `workspace_page_grants` dit quelles pages d'un espace un partenaire ne voit
 * pas. Une table de droits qui se laisse réécrire par celui qu'elle
 * restreint ne restreint rien : ces tests le prouvent **dans la base**, avec
 * de vraies sessions Supabase et l'API REST attaquée directement, hors de
 * toute interface.
 *
 * Les deux sens sont vérifiés : le partenaire lit bien ses propres droits —
 * c'est ce que le serveur consulte pour ne pas lui afficher un lien qui
 * rendrait 404 — mais ne peut ni les modifier, ni voir ceux d'un autre.
 *
 * Comme les autres suites, un jeu éphémère préfixé `zz-grants-` est créé puis
 * supprimé sur le vrai projet Supabase.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const configured = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);
const suite = configured ? describe : describe.skip;

const RUN = `zz-grants-${Date.now()}`;
const PASSWORD = "Test!Droits-2026";

const emails = {
  owner: `${RUN}-owner@antidotes.test`,
  partnerA: `${RUN}-partner-a@antidotes.test`,
  partnerB: `${RUN}-partner-b@antidotes.test`,
};

suite("isolation des droits par page (RLS)", () => {
  let admin!: SupabaseClient;

  const ids = { org: "", workspaceA: "", workspaceB: "" };
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

    await admin.from("invitations").insert([
      { email: emails.owner, org_id: ids.org, workspace_id: null, role: "owner" },
      {
        email: emails.partnerA,
        org_id: ids.org,
        workspace_id: ids.workspaceA,
        role: "client",
      },
      {
        email: emails.partnerB,
        org_id: ids.org,
        workspace_id: ids.workspaceB,
        role: "client",
      },
    ]);

    // Chacun se voit masquer une page dans son propre espace.
    const { error: grantError } = await admin.from("workspace_page_grants").insert([
      {
        workspace_id: ids.workspaceA,
        email: emails.partnerA,
        page_key: "reporting",
        visible: false,
      },
      {
        workspace_id: ids.workspaceB,
        email: emails.partnerB,
        page_key: "planning",
        visible: false,
      },
    ]);
    if (grantError) {
      throw new Error(`Migration 0035 non appliquée ? ${grantError.message}`);
    }

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

  describe("un partenaire lit ses droits sans pouvoir les changer", () => {
    it("lit bien la ligne qui le concerne", async () => {
      const { data } = await clients.partnerA
        .from("workspace_page_grants")
        .select("page_key, visible")
        .eq("workspace_id", ids.workspaceA);

      expect(data).toEqual([{ page_key: "reporting", visible: false }]);
    });

    it("ne voit pas les droits d'un partenaire d'un autre espace", async () => {
      const { data } = await clients.partnerA
        .from("workspace_page_grants")
        .select("email, page_key")
        .eq("workspace_id", ids.workspaceB);

      expect(data).toEqual([]);
    });

    it("ne peut pas se rouvrir une page masquée", async () => {
      const { data } = await clients.partnerA
        .from("workspace_page_grants")
        .update({ visible: true })
        .eq("workspace_id", ids.workspaceA)
        .eq("email", emails.partnerA)
        .select("visible");
      expect(data ?? []).toEqual([]);

      const { data: after } = await admin
        .from("workspace_page_grants")
        .select("visible")
        .eq("workspace_id", ids.workspaceA)
        .eq("email", emails.partnerA)
        .single();
      expect(after?.visible).toBe(false);
    });

    it("ne peut pas supprimer la ligne qui le restreint", async () => {
      await clients.partnerA
        .from("workspace_page_grants")
        .delete()
        .eq("workspace_id", ids.workspaceA)
        .eq("email", emails.partnerA);

      const { count } = await admin
        .from("workspace_page_grants")
        .select("page_key", { count: "exact", head: true })
        .eq("workspace_id", ids.workspaceA)
        .eq("email", emails.partnerA);
      expect(count).toBe(1);
    });

    it("ne peut pas masquer une page à quelqu'un d'autre", async () => {
      const { error } = await clients.partnerA.from("workspace_page_grants").insert({
        workspace_id: ids.workspaceA,
        email: emails.owner,
        page_key: "planning",
        visible: false,
      });
      expect(error).not.toBeNull();
    });
  });

  describe("l'owner de l'organisation administre les droits", () => {
    it("lit les droits des deux espaces", async () => {
      const { data } = await clients.owner
        .from("workspace_page_grants")
        .select("workspace_id")
        .in("workspace_id", [ids.workspaceA, ids.workspaceB]);

      expect(data).toHaveLength(2);
    });

    it("masque une page et la retrouve masquée", async () => {
      const { error } = await clients.owner.from("workspace_page_grants").insert({
        workspace_id: ids.workspaceA,
        email: emails.partnerA,
        page_key: "planning",
        visible: false,
      });
      expect(error).toBeNull();

      const { data } = await clients.owner
        .from("workspace_page_grants")
        .select("page_key")
        .eq("workspace_id", ids.workspaceA)
        .eq("email", emails.partnerA)
        .eq("visible", false);
      expect(data?.map((row) => row.page_key).sort()).toEqual(["planning", "reporting"]);
    });

    it("rouvre une page en supprimant sa ligne", async () => {
      await clients.owner
        .from("workspace_page_grants")
        .delete()
        .eq("workspace_id", ids.workspaceA)
        .eq("email", emails.partnerA)
        .eq("page_key", "planning");

      const { count } = await admin
        .from("workspace_page_grants")
        .select("page_key", { count: "exact", head: true })
        .eq("workspace_id", ids.workspaceA)
        .eq("email", emails.partnerA);
      expect(count).toBe(1);
    });
  });
});
