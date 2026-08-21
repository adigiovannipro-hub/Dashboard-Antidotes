/**
 * Isolation de l'Academy.
 *
 * Trois postures à prouver **dans la base**, hors de toute interface :
 * l'owner écrit le contenu et voit les brouillons ; un membre de
 * l'organisation lit le publié — et seulement le publié, la chaîne des
 * publications comprise — et écrit sa progression, jamais celle d'un autre ;
 * un client d'espace ne lit rien du tout, pas même un cours publié.
 *
 * Comme `planning-isolation.test.ts`, la suite ouvre de vraies sessions
 * Supabase, attaque l'API REST directement, et vérifie les deux sens de
 * chaque règle : une politique trop stricte casse le produit aussi sûrement
 * qu'une politique trop large le rend dangereux. Tout est préfixé `zz-aca-`
 * et nettoyé en fin de suite.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const configured = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);
const suite = configured ? describe : describe.skip;

const RUN = `zz-aca-${Date.now()}`;
const PASSWORD = "Test!Academy-2026";

const emails = {
  owner: `${RUN}-owner@antidotes.test`,
  member: `${RUN}-membre@antidotes.test`,
  client: `${RUN}-client@antidotes.test`,
};

suite("isolation de l'Academy (RLS)", () => {
  let admin!: SupabaseClient;

  const ids = {
    org: "",
    workspace: "",
    course: "",
    modulePublished: "",
    moduleDraft: "",
    lessonPublished: "",
    lessonDraft: "",
    lessonInDraftModule: "",
  };
  const userIds: Record<keyof typeof emails, string> = {
    owner: "",
    member: "",
    client: "",
  };
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

    // Un espace client, uniquement pour donner au « client » une existence
    // normale : c'est exactement le profil qui ne doit rien voir de l'Academy.
    const { data: workspace } = await admin
      .from("workspaces")
      .insert({ org_id: ids.org, type: "client", slug: `${RUN}-esp`, name: "Espace" })
      .select("id")
      .single();
    ids.workspace = workspace!.id;

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
      userIds[key as keyof typeof emails] = data.user.id;
    }

    // Aucune invitation ne fabrique un membre d'organisation non-owner : la
    // ligne se pose à la main, comme le fera l'administration le jour venu.
    const { error: memberError } = await admin.from("organization_members").insert({
      org_id: ids.org,
      user_id: userIds.member,
      role: "member",
    });
    if (memberError) throw new Error(`Membre impossible : ${memberError.message}`);

    for (const key of Object.keys(emails) as (keyof typeof emails)[]) {
      clients[key] = await signIn(emails[key]);
    }

    // Le jeu de contenu : un cours publié, un module publié avec une leçon
    // publiée et une en brouillon, et un module en brouillon qui porte une
    // leçon publiée — le cas de la fuite par la chaîne.
    const { data: course, error: courseError } = await admin
      .from("academy_courses")
      .insert({
        org_id: ids.org,
        slug: `${RUN}-cours`,
        title: "Formation test",
        published: true,
      })
      .select("id")
      .single();
    if (courseError) throw new Error(`Migration 0056 appliquée ? ${courseError.message}`);
    ids.course = course.id;

    const { data: modules } = await admin
      .from("academy_modules")
      .insert([
        {
          course_id: ids.course,
          org_id: ids.org,
          slug: "publie",
          title: "Module publié",
          order_index: 1,
          published: true,
        },
        {
          course_id: ids.course,
          org_id: ids.org,
          slug: "brouillon",
          title: "Module brouillon",
          order_index: 2,
          published: false,
        },
      ])
      .select("id, slug");
    ids.modulePublished = modules!.find((m) => m.slug === "publie")!.id;
    ids.moduleDraft = modules!.find((m) => m.slug === "brouillon")!.id;

    const { data: lessons } = await admin
      .from("academy_lessons")
      .insert([
        {
          module_id: ids.modulePublished,
          course_id: ids.course,
          org_id: ids.org,
          slug: "lecon-publiee",
          title: "Leçon publiée",
          script_mdx: "## L'accroche\n\nContenu public.",
          published: true,
        },
        {
          module_id: ids.modulePublished,
          course_id: ids.course,
          org_id: ids.org,
          slug: "lecon-brouillon",
          title: "Leçon brouillon",
          script_mdx: "## L'accroche\n\nContenu secret en préparation.",
          published: false,
        },
        {
          module_id: ids.moduleDraft,
          course_id: ids.course,
          org_id: ids.org,
          slug: "lecon-orpheline",
          title: "Leçon publiée dans un module brouillon",
          script_mdx: "## L'accroche\n\nContenu secret par la chaîne.",
          published: true,
        },
      ])
      .select("id, slug");
    ids.lessonPublished = lessons!.find((l) => l.slug === "lecon-publiee")!.id;
    ids.lessonDraft = lessons!.find((l) => l.slug === "lecon-brouillon")!.id;
    ids.lessonInDraftModule = lessons!.find((l) => l.slug === "lecon-orpheline")!.id;

    // Une progression de l'owner, que le membre ne doit jamais lire.
    await admin.from("academy_progress").insert({
      org_id: ids.org,
      user_id: userIds.owner,
      lesson_id: ids.lessonPublished,
      status: "completed",
      watched_seconds: 500,
    });
  });

  afterAll(async () => {
    for (const userId of Object.values(userIds)) {
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    }
    if (ids.org) await admin.from("organizations").delete().eq("id", ids.org);
    await admin.from("invitations").delete().like("email", `${RUN}%`);
  });

  describe("un membre de l'organisation lit le publié, et seulement lui", () => {
    it("lit le cours et le module publiés", async () => {
      const [{ data: courses }, { data: modules }] = await Promise.all([
        clients.member.from("academy_courses").select("id").eq("id", ids.course),
        clients.member
          .from("academy_modules")
          .select("id")
          .in("id", [ids.modulePublished, ids.moduleDraft]),
      ]);
      expect(courses?.map((row) => row.id)).toEqual([ids.course]);
      expect(modules?.map((row) => row.id)).toEqual([ids.modulePublished]);
    });

    it("ne lit ni une leçon en brouillon, ni une leçon publiée d'un module brouillon", async () => {
      const { data } = await clients.member
        .from("academy_lessons")
        .select("id, script_mdx")
        .in("id", [ids.lessonPublished, ids.lessonDraft, ids.lessonInDraftModule]);
      expect(data?.map((row) => row.id)).toEqual([ids.lessonPublished]);
    });

    it("ne modifie pas le contenu, même en ciblant son id", async () => {
      const { data } = await clients.member
        .from("academy_lessons")
        .update({ title: "Injection" })
        .eq("id", ids.lessonPublished)
        .select("id");
      expect(data ?? []).toEqual([]);
    });
  });

  describe("la progression et les notes sont personnelles", () => {
    it("un membre écrit sa progression et sa note", async () => {
      const { error: progressError } = await clients.member
        .from("academy_progress")
        .insert({
          org_id: ids.org,
          user_id: userIds.member,
          lesson_id: ids.lessonPublished,
          status: "in_progress",
          watched_seconds: 42,
        });
      expect(progressError).toBeNull();

      const { error: noteError } = await clients.member.from("academy_notes").insert({
        org_id: ids.org,
        user_id: userIds.member,
        lesson_id: ids.lessonPublished,
        content: "Ma note personnelle.",
      });
      expect(noteError).toBeNull();
    });

    it("ne signe pas une progression du nom de quelqu'un d'autre", async () => {
      const { error } = await clients.member.from("academy_progress").insert({
        org_id: ids.org,
        user_id: userIds.owner,
        lesson_id: ids.lessonDraft,
        status: "completed",
      });
      expect(error).not.toBeNull();
    });

    it("ne lit pas la progression de l'owner", async () => {
      const { data } = await clients.member
        .from("academy_progress")
        .select("id")
        .eq("user_id", userIds.owner);
      expect(data ?? []).toEqual([]);
    });
  });

  describe("un client d'espace ne voit rien", () => {
    it("aucun cours, même publié — le module n'existe pas pour lui", async () => {
      const [{ data: courses }, { data: lessons }] = await Promise.all([
        clients.client.from("academy_courses").select("id"),
        clients.client.from("academy_lessons").select("id"),
      ]);
      expect(courses ?? []).toEqual([]);
      expect(lessons ?? []).toEqual([]);
    });

    it("n'écrit pas de progression — il n'est membre de rien", async () => {
      const { error } = await clients.client.from("academy_progress").insert({
        org_id: ids.org,
        user_id: userIds.client,
        lesson_id: ids.lessonPublished,
        status: "in_progress",
      });
      expect(error).not.toBeNull();
    });
  });

  describe("l'owner écrit et voit tout", () => {
    it("voit les brouillons, chaîne comprise", async () => {
      const { data } = await clients.owner
        .from("academy_lessons")
        .select("id")
        .in("id", [ids.lessonPublished, ids.lessonDraft, ids.lessonInDraftModule]);
      expect(data).toHaveLength(3);
    });

    it("modifie une leçon", async () => {
      const { data } = await clients.owner
        .from("academy_lessons")
        .update({ title: "Leçon revue" })
        .eq("id", ids.lessonDraft)
        .select("id, title");
      expect(data?.[0]?.title).toBe("Leçon revue");
    });
  });
});
