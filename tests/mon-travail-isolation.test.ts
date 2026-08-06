/**
 * Isolation de « Mon travail ».
 *
 * La todo de la page d'accueil est un outil interne rattaché à l'organisation :
 * un client d'espace ne doit ni la lire, ni y écrire, ni même déduire son
 * existence. Ces tests le prouvent **dans la base** : ils ouvrent de vraies
 * sessions et attaquent l'API REST directement, hors de toute interface.
 *
 * Ils vérifient aussi l'autre moitié de la règle, celle qu'on oublie de
 * tester : l'owner, lui, travaille — il crée, coche, édite. Une politique trop
 * stricte casserait le produit aussi sûrement qu'une politique trop large le
 * rendrait dangereux.
 *
 * Enfin, la synchronisation « À publier » ↔ planning n'étant pas un mécanisme
 * mais l'absence de copie, un test le fixe noir sur blanc : le statut écrit
 * par la vue d'accueil est celui que relit le planning, même ligne en base.
 *
 * Comme `isolation.test.ts`, jeu éphémère préfixé `zz-travail-`, nettoyé en
 * fin de suite.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const configured = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);
const suite = configured ? describe : describe.skip;

const RUN = `zz-travail-${Date.now()}`;
const PASSWORD = "Test!Travail-2026";

const emails = {
  owner: `${RUN}-owner@antidotes.test`,
  client: `${RUN}-client@antidotes.test`,
};

suite("isolation de Mon travail (RLS)", () => {
  // Créé dans `beforeAll` et non ici : le corps d'un `describe.skip` est tout
  // de même exécuté à la collecte, et `createClient(undefined)` ferait échouer
  // le fichier entier sur une machine sans `.env.local` — au lieu de le sauter.
  let admin!: SupabaseClient;

  const ids = {
    org: "",
    workspace: "",
    subject: "",
    cycle: "",
    step: "",
    dailyTask: "",
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

    const { data: workspace, error: workspaceError } = await admin
      .from("workspaces")
      .insert({ org_id: ids.org, type: "client", slug: `${RUN}-a`, name: "Client A" })
      .select("id")
      .single();
    if (workspaceError) throw new Error(workspaceError.message);
    ids.workspace = workspace.id;

    // Un planning minimal dans l'espace du client : la ligne que la page
    // d'accueil réplique.
    const { data: board, error: boardError } = await admin
      .from("planning_boards")
      .insert({
        workspace_id: ids.workspace,
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
        workspace_id: ids.workspace,
        label: "AOÛT",
        month: "2026-08-01",
      })
      .select("id")
      .single();

    const { data: lane } = await admin
      .from("planning_lanes")
      .insert({
        month_id: month!.id,
        board_id: board.id,
        workspace_id: ids.workspace,
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
        workspace_id: ids.workspace,
        name: "Publication du jour",
        status: "scheduled",
        scheduled_on: "2026-08-05",
      })
      .select("id")
      .single();
    ids.subject = subject!.id;

    // Le module côté owner : un cycle, une étape, la ligne quotidienne.
    const { data: cycle, error: cycleError } = await admin
      .from("work_cycles")
      .insert({ org_id: ids.org, workspace_id: ids.workspace, active: true })
      .select("id")
      .single();
    if (cycleError) throw new Error(`Migration 0014 non appliquée ? ${cycleError.message}`);
    ids.cycle = cycle.id;

    const { data: step } = await admin
      .from("work_cycle_steps")
      .insert({
        cycle_id: ids.cycle,
        org_id: ids.org,
        workspace_id: ids.workspace,
        label: "Reporting et analyse",
        week_of_month: 1,
      })
      .select("id")
      .single();
    ids.step = step!.id;

    const { data: task } = await admin
      .from("work_tasks")
      .insert({
        org_id: ids.org,
        title: "Modération, publications, ads",
        source: "recurring",
        due_date: "2026-08-05",
        dedupe_key: `daily:${RUN}`,
      })
      .select("id")
      .single();
    ids.dailyTask = task!.id;

    // Les invitations précèdent la création des comptes : c'est le trigger
    // `app.handle_new_user` qui transforme l'invitation en accès.
    await admin.from("invitations").insert([
      { email: emails.owner, org_id: ids.org, workspace_id: null, role: "owner" },
      {
        email: emails.client,
        org_id: ids.org,
        workspace_id: ids.workspace,
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

  describe("un client ne voit pas Mon travail", () => {
    it("ne lit aucune tâche, même en ciblant son id", async () => {
      const { data } = await clients.client
        .from("work_tasks")
        .select("id, title")
        .eq("id", ids.dailyTask);
      expect(data).toEqual([]);
    });

    it("ne lit ni le cycle ni ses étapes, même ceux de son propre espace", async () => {
      const [{ data: cycles }, { data: steps }] = await Promise.all([
        clients.client.from("work_cycles").select("id").eq("workspace_id", ids.workspace),
        clients.client
          .from("work_cycle_steps")
          .select("id")
          .eq("workspace_id", ids.workspace),
      ]);
      expect(cycles).toEqual([]);
      expect(steps).toEqual([]);
    });

    it("ne peut pas créer de tâche, même rattachée à son espace", async () => {
      const { error } = await clients.client.from("work_tasks").insert({
        org_id: ids.org,
        workspace_id: ids.workspace,
        title: "Intrusion",
        due_date: "2026-08-05",
      });
      expect(error).not.toBeNull();
    });

    it("ne peut ni cocher ni supprimer une tâche de l'owner", async () => {
      const { data: updated } = await clients.client
        .from("work_tasks")
        .update({ status: "done" })
        .eq("id", ids.dailyTask)
        .select("id");
      expect(updated ?? []).toEqual([]);

      await clients.client.from("work_tasks").delete().eq("id", ids.dailyTask);

      const { data: still } = await admin
        .from("work_tasks")
        .select("status")
        .eq("id", ids.dailyTask)
        .single();
      expect(still?.status).toBe("pending");
    });
  });

  describe("l'owner travaille chez lui", () => {
    it("voit la ligne quotidienne générée", async () => {
      const { data } = await clients.owner
        .from("work_tasks")
        .select("id")
        .eq("id", ids.dailyTask);
      expect(data).toHaveLength(1);
    });

    it("crée une tâche manuelle rattachée à un client", async () => {
      const { data, error } = await clients.owner
        .from("work_tasks")
        .insert({
          org_id: ids.org,
          workspace_id: ids.workspace,
          title: "Préparer le reporting",
          source: "manual",
          due_date: "2026-08-06",
        })
        .select("id, title")
        .single();
      expect(error).toBeNull();
      expect(data?.title).toBe("Préparer le reporting");
    });

    it("coche puis décoche la ligne quotidienne", async () => {
      const { data: done } = await clients.owner
        .from("work_tasks")
        .update({ status: "done", done_at: new Date().toISOString() })
        .eq("id", ids.dailyTask)
        .select("status");
      expect(done?.[0]?.status).toBe("done");

      const { data: reopened } = await clients.owner
        .from("work_tasks")
        .update({ status: "pending", done_at: null })
        .eq("id", ids.dailyTask)
        .select("status");
      expect(reopened?.[0]?.status).toBe("pending");
    });

    it("édite le modèle de cycle sans redéploiement", async () => {
      const { data } = await clients.owner
        .from("work_cycle_steps")
        .update({ label: "Reporting, analyse et recommandations" })
        .eq("id", ids.step)
        .select("label");
      expect(data?.[0]?.label).toBe("Reporting, analyse et recommandations");
    });
  });

  describe("les deux vues lisent la même ligne", () => {
    it("le statut écrit depuis l'accueil est celui que relit le planning", async () => {
      // L'écriture de la section « À publier » : updateSubject côté owner.
      const { data: updated } = await clients.owner
        .from("planning_subjects")
        .update({ status: "published" })
        .eq("id", ids.subject)
        .select("id");
      expect(updated).toHaveLength(1);

      // La lecture du planning du client : même ligne, même statut.
      const { data: fromPlanning } = await clients.client
        .from("planning_subjects")
        .select("status")
        .eq("id", ids.subject)
        .single();
      expect(fromPlanning?.status).toBe("published");
    });
  });
});
