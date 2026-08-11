/**
 * Isolation du module « Production » — phases, jobs de génération, accroches.
 *
 * Le cycle de production mensuel des cartes client est un outil interne de
 * l'owner : un client d'espace ne doit ni le lire, ni y écrire, ni même en
 * déduire l'existence. Ces tests le prouvent **dans la base** : ils ouvrent de
 * vraies sessions et attaquent l'API REST directement, hors de toute
 * interface.
 *
 * Ils vérifient aussi l'autre moitié de la règle, celle qu'on oublie de
 * tester : l'owner, lui, travaille — il ouvre une phase, la termine, suit un
 * job, archive une accroche. Une politique trop stricte casserait le produit
 * aussi sûrement qu'une politique trop large le rendrait dangereux.
 *
 * Comme `isolation.test.ts`, jeu éphémère préfixé `zz-prod-`, nettoyé en fin
 * de suite.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const configured = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);
const suite = configured ? describe : describe.skip;

const RUN = `zz-prod-${Date.now()}`;
const PASSWORD = "Test!Production-2026";

const emails = {
  owner: `${RUN}-owner@antidotes.test`,
  client: `${RUN}-client@antidotes.test`,
};

suite("isolation du module Production (RLS)", () => {
  // Créé dans `beforeAll` et non ici : le corps d'un `describe.skip` est tout
  // de même exécuté à la collecte, et `createClient(undefined)` ferait échouer
  // le fichier entier sur une machine sans `.env.local` — au lieu de le sauter.
  let admin!: SupabaseClient;

  const ids = {
    org: "",
    workspace: "",
    subject: "",
    phase: "",
    job: "",
    hook: "",
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

    // Une publication minimale : l'accroche archivée s'y rattache.
    const { data: board } = await admin
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

    const { data: month } = await admin
      .from("planning_months")
      .insert({
        board_id: board!.id,
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
        board_id: board!.id,
        workspace_id: ids.workspace,
        platform: "linkedin",
        name: "LINKEDIN",
      })
      .select("id")
      .single();

    const { data: subject } = await admin
      .from("planning_subjects")
      .insert({
        lane_id: lane!.id,
        month_id: month!.id,
        board_id: board!.id,
        workspace_id: ids.workspace,
        name: "Publication du mois",
        status: "published",
        scheduled_on: "2026-08-05",
      })
      .select("id")
      .single();
    ids.subject = subject!.id;

    // Le module côté owner : une phase en cours, un job, une accroche.
    const { data: phase, error: phaseError } = await admin
      .from("client_phases")
      .insert({
        org_id: ids.org,
        workspace_id: ids.workspace,
        phase: "wording",
        target_month: "2026-09-01",
        status: "in_progress",
      })
      .select("id")
      .single();
    if (phaseError) throw new Error(`Migration 0032 non appliquée ? ${phaseError.message}`);
    ids.phase = phase.id;

    const { data: job } = await admin
      .from("generation_jobs")
      .insert({
        org_id: ids.org,
        workspace_id: ids.workspace,
        phase: "wording",
        target_month: "2026-09-01",
        status: "running",
        progress_total: 12,
      })
      .select("id")
      .single();
    ids.job = job!.id;

    const { data: hook } = await admin
      .from("wording_history")
      .insert({
        org_id: ids.org,
        workspace_id: ids.workspace,
        subject_id: ids.subject,
        hook: "Une accroche déjà publiée.",
        platform: "linkedin",
        published_at: "2026-08-05",
      })
      .select("id")
      .single();
    ids.hook = hook!.id;

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

  describe("un client ne voit pas le cycle de production", () => {
    it("ne lit aucune phase, même en ciblant son id", async () => {
      const { data } = await clients.client
        .from("client_phases")
        .select("id, phase")
        .eq("id", ids.phase);
      expect(data).toEqual([]);
    });

    it("ne lit ni les jobs ni l'historique des accroches de son propre espace", async () => {
      const [{ data: jobs }, { data: hooks }] = await Promise.all([
        clients.client
          .from("generation_jobs")
          .select("id")
          .eq("workspace_id", ids.workspace),
        clients.client
          .from("wording_history")
          .select("id")
          .eq("workspace_id", ids.workspace),
      ]);
      expect(jobs).toEqual([]);
      expect(hooks).toEqual([]);
    });

    it("ne peut pas ouvrir de phase, même rattachée à son espace", async () => {
      const { error } = await clients.client.from("client_phases").insert({
        org_id: ids.org,
        workspace_id: ids.workspace,
        phase: "reporting",
        target_month: "2026-08-01",
      });
      expect(error).not.toBeNull();
    });

    it("ne peut ni terminer une phase ni effacer un job de l'owner", async () => {
      const { data: updated } = await clients.client
        .from("client_phases")
        .update({ status: "done" })
        .eq("id", ids.phase)
        .select("id");
      expect(updated ?? []).toEqual([]);

      await clients.client.from("generation_jobs").delete().eq("id", ids.job);

      const { data: still } = await admin
        .from("generation_jobs")
        .select("status")
        .eq("id", ids.job)
        .single();
      expect(still?.status).toBe("running");
    });
  });

  describe("l'owner travaille chez lui", () => {
    it("lit ses phases, ses jobs et ses accroches", async () => {
      const [{ data: phases }, { data: jobs }, { data: hooks }] = await Promise.all([
        clients.owner.from("client_phases").select("id").eq("id", ids.phase),
        clients.owner.from("generation_jobs").select("id").eq("id", ids.job),
        clients.owner.from("wording_history").select("id").eq("id", ids.hook),
      ]);
      expect(phases).toHaveLength(1);
      expect(jobs).toHaveLength(1);
      expect(hooks).toHaveLength(1);
    });

    it("ouvre une phase d'un autre mois et la termine", async () => {
      const { data: created, error } = await clients.owner
        .from("client_phases")
        .insert({
          org_id: ids.org,
          workspace_id: ids.workspace,
          phase: "reporting",
          target_month: "2026-07-01",
          status: "in_progress",
        })
        .select("id")
        .single();
      expect(error).toBeNull();

      const { data: updated } = await clients.owner
        .from("client_phases")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", created!.id)
        .select("status");
      expect(updated?.[0]?.status).toBe("done");
    });

    it("fait avancer un job et archive une accroche", async () => {
      const { data: advanced } = await clients.owner
        .from("generation_jobs")
        .update({ progress_current: 4 })
        .eq("id", ids.job)
        .select("progress_current");
      expect(advanced?.[0]?.progress_current).toBe(4);

      const { error } = await clients.owner.from("wording_history").insert({
        org_id: ids.org,
        workspace_id: ids.workspace,
        subject_id: ids.subject,
        hook: "Une seconde accroche, différente.",
        platform: "linkedin",
        published_at: "2026-08-12",
      });
      expect(error).toBeNull();
    });
  });
});
