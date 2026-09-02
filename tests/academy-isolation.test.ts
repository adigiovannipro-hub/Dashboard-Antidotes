/**
 * Isolation de l'Academy.
 *
 * Quatre postures à prouver **dans la base**, hors de toute interface :
 * l'owner écrit le contenu et voit les brouillons ; un membre de
 * l'organisation lit le publié — et seulement le publié, la chaîne des
 * publications comprise — et écrit sa progression, jamais celle d'un autre ;
 * une **élève** inscrite à une formation lit celle-là et pas la voisine, écrit
 * bien sa progression, et perd tout au retrait de son accès ; un client
 * d'espace ne lit rien du tout, pas même un cours publié.
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
  eleve: `${RUN}-eleve@antidotes.test`,
};

suite("isolation de l'Academy (RLS)", () => {
  let admin!: SupabaseClient;

  const ids = {
    org: "",
    workspace: "",
    course: "",
    courseVoisin: "",
    moduleVoisin: "",
    lessonVoisine: "",
    enrollment: "",
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
    eleve: "",
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

    // La formation voisine : publiée, complète, et à laquelle l'élève n'est
    // **pas** inscrite. C'est elle qui prouve que l'inscription borne la
    // lecture au cours acheté, et pas à l'organisation entière.
    const { data: voisin } = await admin
      .from("academy_courses")
      .insert({
        org_id: ids.org,
        slug: `${RUN}-voisin`,
        title: "Formation voisine",
        published: true,
      })
      .select("id")
      .single();
    ids.courseVoisin = voisin!.id;

    const { data: moduleVoisin } = await admin
      .from("academy_modules")
      .insert({
        course_id: ids.courseVoisin,
        org_id: ids.org,
        slug: "voisin",
        title: "Module voisin",
        order_index: 1,
        published: true,
      })
      .select("id")
      .single();
    ids.moduleVoisin = moduleVoisin!.id;

    const { data: lessonVoisine } = await admin
      .from("academy_lessons")
      .insert({
        module_id: ids.moduleVoisin,
        course_id: ids.courseVoisin,
        org_id: ids.org,
        slug: "lecon-voisine",
        title: "Leçon de la formation voisine",
        script_mdx: "## L'accroche\n\nContenu d'une autre formation.",
        published: true,
      })
      .select("id")
      .single();
    ids.lessonVoisine = lessonVoisine!.id;

    // L'élève : aucune ligne dans `organization_members`, aucune dans
    // `memberships`. Une inscription active, et rien d'autre.
    const { data: enrollment, error: enrollmentError } = await admin
      .from("academy_enrollments")
      .insert({
        org_id: ids.org,
        course_id: ids.course,
        email: emails.eleve,
        user_id: userIds.eleve,
        status: "active",
        activated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (enrollmentError) {
      throw new Error(`Migration 20260902g appliquée ? ${enrollmentError.message}`);
    }
    ids.enrollment = enrollment.id;

    // Une inscription à retirer en cours de suite, pour un autre compte, afin
    // de prouver que le fichier des inscrites ne se lit pas d'à côté.
    await admin.from("academy_enrollments").insert({
      org_id: ids.org,
      course_id: ids.courseVoisin,
      email: `${RUN}-autre@antidotes.test`,
      status: "invited",
    });

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

  describe("une élève ne voit que la formation où elle est inscrite", () => {
    it("lit sa formation, pas la voisine", async () => {
      const { data } = await clients.eleve
        .from("academy_courses")
        .select("id")
        .in("id", [ids.course, ids.courseVoisin]);
      expect(data?.map((row) => row.id)).toEqual([ids.course]);
    });

    it("lit la leçon publiée de sa formation, aucune de la voisine", async () => {
      const { data } = await clients.eleve
        .from("academy_lessons")
        .select("id")
        .in("id", [
          ids.lessonPublished,
          ids.lessonDraft,
          ids.lessonInDraftModule,
          ids.lessonVoisine,
        ]);
      expect(data?.map((row) => row.id)).toEqual([ids.lessonPublished]);
    });

    it("écrit bien sa progression — la moitié qu'on oublie de tester", async () => {
      const { error } = await clients.eleve.from("academy_progress").insert({
        org_id: ids.org,
        user_id: userIds.eleve,
        lesson_id: ids.lessonPublished,
        status: "completed",
        watched_seconds: 120,
      });
      expect(error).toBeNull();
    });

    it("n'écrit pas la progression de quelqu'un d'autre", async () => {
      const { error } = await clients.eleve.from("academy_progress").insert({
        org_id: ids.org,
        user_id: userIds.member,
        lesson_id: ids.lessonPublished,
        status: "completed",
      });
      expect(error).not.toBeNull();
    });

    it("ne modifie pas le contenu", async () => {
      const { data } = await clients.eleve
        .from("academy_lessons")
        .update({ title: "Injection élève" })
        .eq("id", ids.lessonPublished)
        .select("id");
      expect(data ?? []).toEqual([]);
    });

    it("ne lit que sa propre inscription, jamais le fichier des autres", async () => {
      const { data } = await clients.eleve.from("academy_enrollments").select("id");
      expect(data?.map((row) => row.id)).toEqual([ids.enrollment]);
    });

    it("ne s'inscrit pas elle-même à la formation voisine", async () => {
      const { error } = await clients.eleve.from("academy_enrollments").insert({
        org_id: ids.org,
        course_id: ids.courseVoisin,
        email: emails.eleve,
        user_id: userIds.eleve,
        status: "active",
      });
      expect(error).not.toBeNull();
    });

    it("perd tout accès quand l'inscription est retirée", async () => {
      await admin
        .from("academy_enrollments")
        .update({ status: "revoked" })
        .eq("id", ids.enrollment);

      const [{ data: courses }, { data: lessons }] = await Promise.all([
        clients.eleve.from("academy_courses").select("id"),
        clients.eleve.from("academy_lessons").select("id"),
      ]);
      expect(courses ?? []).toEqual([]);
      expect(lessons ?? []).toEqual([]);

      // Remise en état : les cas suivants n'ont pas à hériter du retrait.
      await admin
        .from("academy_enrollments")
        .update({ status: "active" })
        .eq("id", ids.enrollment);
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

    it("lit le fichier complet des inscrites", async () => {
      const { data } = await clients.owner.from("academy_enrollments").select("id");
      expect((data ?? []).length).toBeGreaterThanOrEqual(2);
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
