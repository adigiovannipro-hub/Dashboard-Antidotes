/**
 * Isolation du Planning Éditorial.
 *
 * Le planning vit dans l'espace du client, et c'est l'isolation entre espaces
 * qui le protège. Ces tests le prouvent **dans la base** : ils ouvrent de
 * vraies sessions et attaquent l'API REST directement, hors de toute interface.
 *
 * Ils vérifient aussi l'autre moitié de la règle, celle qu'on oublie de tester :
 * un client **peut** écrire dans son propre planning. La plateforme n'a pas de
 * rôle en lecture seule parmi ses utilisateurs authentifiés, et une politique
 * trop stricte casserait le produit aussi sûrement qu'une politique trop large
 * le rendrait dangereux.
 *
 * Comme `isolation.test.ts`, ils créent puis suppriment un jeu éphémère sur le
 * vrai projet Supabase. Tout est préfixé `zz-plan-` et nettoyé en fin de suite.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const configured = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);
const suite = configured ? describe : describe.skip;

const RUN = `zz-plan-${Date.now()}`;
const PASSWORD = "Test!Planning-2026";

const emails = {
  owner: `${RUN}-owner@antidotes.test`,
  clientA: `${RUN}-client-a@antidotes.test`,
  clientB: `${RUN}-client-b@antidotes.test`,
};

suite("isolation du Planning Éditorial (RLS)", () => {
  // Créé dans `beforeAll` et non ici : le corps d'un `describe.skip` est tout
  // de même exécuté à la collecte, et `createClient(undefined)` ferait échouer
  // le fichier entier sur une machine sans `.env.local` — au lieu de le sauter.
  let admin!: SupabaseClient;

  const ids = {
    org: "",
    workspaceA: "",
    workspaceB: "",
    boardA: "",
    boardB: "",
    subjectA: "",
    subjectB: "",
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

  /** Un espace client avec un planning complet : tableau, mois, réseau, sujet. */
  async function seedWorkspace(slug: string, name: string) {
    const { data: workspace, error } = await admin
      .from("workspaces")
      .insert({ org_id: ids.org, type: "client", slug, name })
      .select("id")
      .single();
    if (error) throw new Error(`Migrations non appliquées ? ${error.message}`);

    const { data: board, error: boardError } = await admin
      .from("planning_boards")
      .insert({
        workspace_id: workspace.id,
        kind: "editorial",
        slug: "pe-2026",
        name: "Planning Éditorial 2026",
        year: 2026,
      })
      .select("id")
      .single();
    if (boardError) throw new Error(`Migration 0006 non appliquée ? ${boardError.message}`);

    const { data: month } = await admin
      .from("planning_months")
      .insert({
        board_id: board.id,
        workspace_id: workspace.id,
        label: "SEPTEMBRE",
        month: "2026-09-01",
      })
      .select("id")
      .single();

    const { data: lane } = await admin
      .from("planning_lanes")
      .insert({
        month_id: month!.id,
        board_id: board.id,
        workspace_id: workspace.id,
        platform: "meta",
        name: "META",
      })
      .select("id")
      .single();

    const { data: subject } = await admin
      .from("planning_subjects")
      .insert({
        lane_id: lane!.id,
        month_id: month!.id,
        board_id: board.id,
        workspace_id: workspace.id,
        name: `Publication confidentielle de ${name}`,
        wording: `Caption confidentielle de ${name}`,
      })
      .select("id")
      .single();

    return { workspaceId: workspace.id, boardId: board.id, subjectId: subject!.id };
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
    ids.boardA = a.boardId;
    ids.subjectA = a.subjectId;
    ids.workspaceB = b.workspaceId;
    ids.boardB = b.boardId;
    ids.subjectB = b.subjectId;

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

  describe("un client ne voit que son espace", () => {
    it("ne liste que son propre tableau", async () => {
      const { data } = await clients.clientA
        .from("planning_boards")
        .select("id")
        .in("id", [ids.boardA, ids.boardB]);
      expect(data?.map((row) => row.id)).toEqual([ids.boardA]);
    });

    it("ne lit aucune publication d'un autre espace, même en ciblant son id", async () => {
      const { data } = await clients.clientA
        .from("planning_subjects")
        .select("id, wording")
        .eq("id", ids.subjectB);
      expect(data).toEqual([]);
    });

    it("ne lit ni les mois ni les réseaux d'un autre espace", async () => {
      const [{ data: months }, { data: lanes }] = await Promise.all([
        clients.clientA
          .from("planning_months")
          .select("id")
          .eq("workspace_id", ids.workspaceB),
        clients.clientA
          .from("planning_lanes")
          .select("id")
          .eq("workspace_id", ids.workspaceB),
      ]);
      expect(months).toEqual([]);
      expect(lanes).toEqual([]);
    });

    it("ne peut pas modifier la publication d'un autre espace", async () => {
      const { data } = await clients.clientA
        .from("planning_subjects")
        .update({ name: "Injection" })
        .eq("id", ids.subjectB)
        .select("id");
      expect(data ?? []).toEqual([]);

      const { data: after } = await admin
        .from("planning_subjects")
        .select("name")
        .eq("id", ids.subjectB)
        .single();
      expect(after?.name).toContain("Client B");
    });

    it("ne peut pas déposer de retour sur la publication d'un autre espace", async () => {
      const { error } = await clients.clientB.from("planning_comments").insert({
        subject_id: ids.subjectA,
        workspace_id: ids.workspaceA,
        author_id: userIds[2],
        scope: "general",
        body: "Retour indiscret",
      });
      expect(error).not.toBeNull();
    });
  });

  describe("un client édite son propre planning", () => {
    it("modifie le sujet d'une publication", async () => {
      const { data } = await clients.clientA
        .from("planning_subjects")
        .update({ name: "Sujet revu par le client" })
        .eq("id", ids.subjectA)
        .select("id, name");
      expect(data?.[0]?.name).toBe("Sujet revu par le client");
    });

    it("dépose un retour signé de son propre compte", async () => {
      const { data: me } = await clients.clientA.auth.getUser();
      const { error } = await clients.clientA.from("planning_comments").insert({
        subject_id: ids.subjectA,
        workspace_id: ids.workspaceA,
        author_id: me.user!.id,
        scope: "visual",
        body: "Le cadrage est trop serré.",
      });
      expect(error).toBeNull();
    });

    it("ne peut pas signer un retour du nom de quelqu'un d'autre", async () => {
      const { error } = await clients.clientA.from("planning_comments").insert({
        subject_id: ids.subjectA,
        workspace_id: ids.workspaceA,
        author_id: userIds[0],
        scope: "general",
        body: "Retour usurpé",
      });
      expect(error).not.toBeNull();
    });

    it("ne peut pas supprimer un tableau, réservé à l'owner", async () => {
      await clients.clientA.from("planning_boards").delete().eq("id", ids.boardA);

      const { data: still } = await admin
        .from("planning_boards")
        .select("id")
        .eq("id", ids.boardA)
        .maybeSingle();
      expect(still?.id).toBe(ids.boardA);
    });
  });

  describe("l'owner de l'organisation", () => {
    it("voit les plannings des deux espaces", async () => {
      const { data } = await clients.owner
        .from("planning_subjects")
        .select("id")
        .in("id", [ids.subjectA, ids.subjectB]);
      expect(data).toHaveLength(2);
    });
  });

  describe("le journal de publication automatique (0046)", () => {
    beforeAll(async () => {
      // La machine écrit avec la clé de service ; on pose une ligne par espace.
      const { error } = await admin.from("planning_publications").insert([
        {
          subject_id: ids.subjectA,
          workspace_id: ids.workspaceA,
          target: "instagram",
          status: "success",
          permalink: "https://www.instagram.com/p/test-a/",
        },
        {
          subject_id: ids.subjectB,
          workspace_id: ids.workspaceB,
          target: "instagram",
          status: "error",
          error: "jeton expiré",
        },
      ]);
      if (error) throw new Error(`Migration 0046 appliquée ? ${error.message}`);
    });

    it("un client lit les publications de son espace, pas celles du voisin", async () => {
      const { data } = await clients.clientA
        .from("planning_publications")
        .select("subject_id")
        .in("subject_id", [ids.subjectA, ids.subjectB]);
      expect(data).toHaveLength(1);
      expect(data?.[0]?.subject_id).toBe(ids.subjectA);
    });

    it("un client ne fabrique pas de ligne de publication — la machine seule écrit", async () => {
      const { data } = await clients.clientA
        .from("planning_publications")
        .insert({
          subject_id: ids.subjectA,
          workspace_id: ids.workspaceA,
          target: "facebook",
          status: "success",
        })
        .select("id");
      // Aucune politique d'écriture : l'insertion ne rend aucune ligne.
      expect(data ?? []).toHaveLength(0);
    });

    it("un client ne maquille pas un échec en succès", async () => {
      const { data } = await clients.clientB
        .from("planning_publications")
        .update({ status: "success", error: null })
        .eq("subject_id", ids.subjectB)
        .select("id");
      expect(data ?? []).toHaveLength(0);
    });
  });
});
