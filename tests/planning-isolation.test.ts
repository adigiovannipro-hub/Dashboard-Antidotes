/**
 * Isolation du module Planning Édito.
 *
 * Le module est interne, et un même utilisateur peut être éditeur chez un
 * client sans avoir rien à faire chez un autre. Ces tests prouvent que la
 * séparation tient **dans la base** : ils ouvrent de vraies sessions et
 * attaquent l'API REST directement, hors de toute interface.
 *
 * Comme `isolation.test.ts`, ils créent puis suppriment un jeu éphémère sur le
 * vrai projet Supabase. Tout est préfixé `zz-plan-` et nettoyé en fin de suite,
 * y compris si un test échoue.
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
  editorA: `${RUN}-editor-a@antidotes.test`,
  viewerA: `${RUN}-viewer-a@antidotes.test`,
  outsider: `${RUN}-outsider@antidotes.test`,
};

suite("isolation du Planning Édito (RLS)", () => {
  // Créé dans `beforeAll` et non ici : le corps d'un `describe.skip` est tout
  // de même exécuté à la collecte, et `createClient(undefined)` ferait échouer
  // le fichier entier sur une machine sans `.env.local` — au lieu de le sauter.
  let admin!: SupabaseClient;

  const ids = {
    org: "",
    clientA: "",
    clientB: "",
    subjectA: "",
    subjectB: "",
    monthB: "",
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

  /** Un client de planning complet : board, mois, couloir, sujet. */
  async function seedClient(slug: string, name: string) {
    const { data: client, error } = await admin
      .from("planning_clients")
      .insert({ org_id: ids.org, slug: `${RUN}-${slug}`, name })
      .select("id")
      .single();
    if (error) throw new Error(`Migrations non appliquées ? ${error.message}`);

    const { data: board } = await admin
      .from("planning_boards")
      .insert({
        client_id: client.id,
        monday_board_id: `${RUN}-${slug}-board`,
        name: `${name} I PE 2026`,
        year: 2026,
      })
      .select("id")
      .single();

    const { data: month } = await admin
      .from("planning_months")
      .insert({
        board_id: board!.id,
        client_id: client.id,
        monday_group_id: `${RUN}-${slug}-group`,
        label: "AOUT",
        month: "2026-08-01",
      })
      .select("id")
      .single();

    const { data: lane } = await admin
      .from("planning_lanes")
      .insert({
        month_id: month!.id,
        client_id: client.id,
        monday_item_id: `${RUN}-${slug}-lane`,
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
        client_id: client.id,
        monday_item_id: `${RUN}-${slug}-subject`,
        name: `Contenu confidentiel de ${name}`,
        wording: `Caption confidentielle de ${name}`,
      })
      .select("id")
      .single();

    return { clientId: client.id, monthId: month!.id, subjectId: subject!.id };
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

    const a = await seedClient("client-a", "Client A");
    const b = await seedClient("client-b", "Client B");
    ids.clientA = a.clientId;
    ids.subjectA = a.subjectId;
    ids.clientB = b.clientId;
    ids.subjectB = b.subjectId;
    ids.monthB = b.monthId;

    // Seul l'owner passe par une invitation : c'est le trigger
    // `app.handle_new_user` qui en fait un membre de l'organisation.
    await admin.from("invitations").insert({
      email: emails.owner,
      org_id: ids.org,
      workspace_id: null,
      role: "owner",
    });

    for (const [key, email] of Object.entries(emails)) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
      });
      if (error) throw new Error(`Création du compte ${email} : ${error.message}`);
      userIds.push(data.user.id);
      clients[key as keyof typeof emails] = await signIn(email);

      if (key === "editorA") {
        await admin
          .from("planning_members")
          .insert({ user_id: data.user.id, client_id: ids.clientA, role: "editor" });
      }
      if (key === "viewerA") {
        await admin
          .from("planning_members")
          .insert({ user_id: data.user.id, client_id: ids.clientA, role: "viewer" });
      }
    }
  });

  afterAll(async () => {
    for (const userId of userIds) {
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    }
    if (ids.clientA) await admin.from("planning_clients").delete().eq("id", ids.clientA);
    if (ids.clientB) await admin.from("planning_clients").delete().eq("id", ids.clientB);
    if (ids.org) await admin.from("organizations").delete().eq("id", ids.org);
    await admin.from("invitations").delete().like("email", `${RUN}%`);
  });

  describe("un éditeur ne voit que son client", () => {
    it("ne liste que le client auquel il est rattaché", async () => {
      const { data } = await clients.editorA
        .from("planning_clients")
        .select("id")
        .in("id", [ids.clientA, ids.clientB]);
      expect(data?.map((row) => row.id)).toEqual([ids.clientA]);
    });

    it("ne lit aucun contenu d'un autre client, même en ciblant son id", async () => {
      const { data } = await clients.editorA
        .from("planning_subjects")
        .select("id, wording")
        .eq("id", ids.subjectB);
      expect(data).toEqual([]);
    });

    it("ne lit ni les mois ni les couloirs d'un autre client", async () => {
      const [{ data: months }, { data: lanes }] = await Promise.all([
        clients.editorA.from("planning_months").select("id").eq("client_id", ids.clientB),
        clients.editorA.from("planning_lanes").select("id").eq("client_id", ids.clientB),
      ]);
      expect(months).toEqual([]);
      expect(lanes).toEqual([]);
    });

    it("ne peut pas écrire le wording d'un autre client", async () => {
      const { data } = await clients.editorA
        .from("planning_subjects")
        .update({ pending_wording: "Injection" })
        .eq("id", ids.subjectB)
        .select("id");
      expect(data ?? []).toEqual([]);

      const { data: after } = await admin
        .from("planning_subjects")
        .select("pending_wording")
        .eq("id", ids.subjectB)
        .single();
      expect(after?.pending_wording).toBeNull();
    });

    it("écrit en revanche le wording de son propre client", async () => {
      const { data } = await clients.editorA
        .from("planning_subjects")
        .update({ pending_wording: "Nouvelle caption" })
        .eq("id", ids.subjectA)
        .select("id");
      expect(data?.map((row) => row.id)).toEqual([ids.subjectA]);
    });

    it("ne peut pas rattacher un board, réservé à l'owner", async () => {
      const { error } = await clients.editorA.from("planning_boards").insert({
        client_id: ids.clientA,
        monday_board_id: `${RUN}-pirate`,
        name: "Board pirate",
      });
      expect(error).not.toBeNull();
    });
  });

  describe("un lecteur ne modifie rien", () => {
    it("lit les contenus de son client", async () => {
      const { data } = await clients.viewerA
        .from("planning_subjects")
        .select("id")
        .eq("id", ids.subjectA);
      expect(data?.map((row) => row.id)).toEqual([ids.subjectA]);
    });

    it("ne met aucun wording en file d'attente", async () => {
      const { data } = await clients.viewerA
        .from("planning_subjects")
        .update({ pending_wording: "Tentative" })
        .eq("id", ids.subjectA)
        .select("id");
      expect(data ?? []).toEqual([]);
    });
  });

  describe("un utilisateur sans rattachement", () => {
    it("ne voit aucun client de planning", async () => {
      const { data } = await clients.outsider
        .from("planning_clients")
        .select("id")
        .in("id", [ids.clientA, ids.clientB]);
      // Le module doit rester invisible : c'est ce que vérifie
      // `isPlanningVisible` côté interface, et la base dit la même chose.
      expect(data).toEqual([]);
    });

    it("ne lit aucun contenu", async () => {
      const { data } = await clients.outsider
        .from("planning_subjects")
        .select("id")
        .in("id", [ids.subjectA, ids.subjectB]);
      expect(data).toEqual([]);
    });
  });

  describe("l'owner de l'organisation", () => {
    it("voit tous les clients sans rattachement explicite", async () => {
      const { data } = await clients.owner
        .from("planning_clients")
        .select("id")
        .in("id", [ids.clientA, ids.clientB]);
      expect(data?.map((row) => row.id).sort()).toEqual(
        [ids.clientA, ids.clientB].sort(),
      );
    });

    it("lit les contenus des deux clients", async () => {
      const { data } = await clients.owner
        .from("planning_subjects")
        .select("id")
        .in("id", [ids.subjectA, ids.subjectB]);
      expect(data).toHaveLength(2);
    });
  });
});
