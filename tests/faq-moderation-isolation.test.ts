/**
 * Isolation de la FAQ Modération ouverte aux espaces clients.
 *
 * La migration 20260830 ouvre trois lectures aux membres d'un espace — les
 * entrées FAQ, leurs catégories et la ligne du client de modération rattaché —
 * et rien d'autre : l'inbox reste un outil interne. 20260912b-c y ajoutent le
 * fil de discussion d'un élément de langage, la seule table du module où le
 * rôle client **écrit**.
 *
 * Ces tests le prouvent dans la base, en vraies sessions contre l'API REST,
 * dans les deux sens : le client lit bien sa FAQ (une politique trop stricte
 * casserait la page `/espace/[workspace]/faq`) et pose un message dans son
 * fil, mais il ne lit ni la FAQ ni le fil du voisin, ne lit pas les
 * conversations, ne pose pas son verdict en écriture directe —
 * `setFaqClientReview` passe par une action serveur à garde applicative — et
 * personne, pas même l'owner, ne réécrit un message déjà posté.
 *
 * Comme les suites sœurs : jeu éphémère préfixé `zz-faqm-`, nettoyé à la fin.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const configured = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);

/* Ces migrations partent avec le push sur `main` : tant qu'elles ne sont pas
   appliquées, la base n'a ni `client_review`, ni `faq_comments`, ni les
   politiques à prouver, et la
   suite se saute **en le disant** — un rouge structurel bloquerait la porte des
   quatre commandes pour une cause qui se résout au merge, un vert silencieux
   ferait croire à une preuve. Sonde à la collecte, comme l'autorise Vitest. */
const migrated = configured
  ? await (async () => {
      const probe = createClient(SUPABASE_URL!, SERVICE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await probe
        .from("faq_entries")
        .select("client_review")
        .limit(1);
      const { error: threadError } = await probe
        .from("faq_comments")
        .select("id")
        .limit(1);
      const { error: repliesError } = await probe
        .from("saved_replies")
        .select("id")
        .limit(1);
      const missing = error ?? threadError ?? repliesError;
      if (missing) {
        console.warn(
          `[faq-moderation-isolation] suite sautée : migrations 20260830 / 20260912b-c / 20260913a-b non appliquées (${missing.message}). À rejouer après le push sur main.`,
        );
        return false;
      }
      return true;
    })()
  : false;

const suite = configured && migrated ? describe : describe.skip;

const RUN = `zz-faqm-${Date.now()}`;
const PASSWORD = "Test!FaqModeration-2026";

const emails = {
  owner: `${RUN}-owner@antidotes.test`,
  clientA: `${RUN}-client-a@antidotes.test`,
  clientB: `${RUN}-client-b@antidotes.test`,
};

suite("isolation de la FAQ Modération (RLS)", () => {
  let admin!: SupabaseClient;

  const ids = {
    org: "",
    workspaceA: "",
    workspaceB: "",
    modClientA: "",
    modClientB: "",
    entryA: "",
    entryB: "",
    categoryA: "",
    commentA: "",
    commentB: "",
    conversationA: "",
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

  /** Un espace, son client de modération rattaché, une catégorie, une entrée. */
  async function seedClient(slug: string, name: string) {
    const { data: workspace, error } = await admin
      .from("workspaces")
      .insert({ org_id: ids.org, type: "client", slug, name })
      .select("id")
      .single();
    if (error) throw new Error(`Migrations non appliquées ? ${error.message}`);

    const { data: modClient, error: clientError } = await admin
      .from("moderation_clients")
      .insert({
        org_id: ids.org,
        workspace_id: workspace.id,
        slug,
        name,
      })
      .select("id")
      .single();
    if (clientError) throw new Error(`Migration 0004 appliquée ? ${clientError.message}`);

    const { data: category } = await admin
      .from("faq_categories")
      .insert({ client_id: modClient.id, name: "Livraison" })
      .select("id")
      .single();

    const { data: entry, error: entryError } = await admin
      .from("faq_entries")
      .insert({
        client_id: modClient.id,
        title: `ÉLÉMENT DE LANGAGE ${name}`,
        question_canonical: `Question confidentielle de ${name}`,
        answer_fr: `Réponse confidentielle de ${name}`,
        category_id: category!.id,
        client_review: "pending",
      })
      .select("id")
      .single();
    if (entryError) throw new Error(`Migration 20260830 appliquée ? ${entryError.message}`);

    const { data: comment, error: commentError } = await admin
      .from("faq_comments")
      .insert({
        client_id: modClient.id,
        entry_id: entry.id,
        author_name: "Agence",
        body: `Autorisation demandée à ${name}`,
      })
      .select("id")
      .single();
    if (commentError) {
      throw new Error(`Migration 20260912b appliquée ? ${commentError.message}`);
    }

    return {
      workspaceId: workspace.id,
      modClientId: modClient.id,
      entryId: entry.id,
      categoryId: category!.id,
      commentId: comment.id,
    };
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

    const a = await seedClient(`${RUN}-a`, "Client A");
    const b = await seedClient(`${RUN}-b`, "Client B");
    ids.workspaceA = a.workspaceId;
    ids.modClientA = a.modClientId;
    ids.entryA = a.entryId;
    ids.categoryA = a.categoryId;
    ids.commentA = a.commentId;
    ids.workspaceB = b.workspaceId;
    ids.modClientB = b.modClientId;
    ids.entryB = b.entryId;
    ids.commentB = b.commentId;

    // L'inbox du client A : ce que la FAQ ouverte ne doit PAS entraîner.
    const { data: conversation } = await admin
      .from("conversations")
      .insert({
        client_id: ids.modClientA,
        channel: "instagram",
        kind: "comment",
        external_thread_id: `${RUN}-thread`,
        participant_handle: "client.mecontent",
        excerpt: "Message privé confidentiel",
      })
      .select("id")
      .single();
    ids.conversationA = conversation!.id;

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

  describe("un client lit sa FAQ, et elle seule", () => {
    it("lit les entrées de son espace, titre et réponse compris", async () => {
      const { data } = await clients.clientA
        .from("faq_entries")
        .select("id, title, answer_fr, client_review")
        .in("id", [ids.entryA, ids.entryB]);
      expect(data?.map((row) => row.id)).toEqual([ids.entryA]);
      expect(data?.[0]?.title).toBe("ÉLÉMENT DE LANGAGE Client A");
    });

    it("ne lit pas l'entrée du voisin, même en ciblant son id", async () => {
      const { data } = await clients.clientA
        .from("faq_entries")
        .select("id, answer_fr")
        .eq("id", ids.entryB);
      expect(data).toEqual([]);
    });

    it("lit ses catégories, pas celles du voisin", async () => {
      const { data } = await clients.clientA
        .from("faq_categories")
        .select("client_id")
        .in("client_id", [ids.modClientA, ids.modClientB]);
      expect(data?.map((row) => row.client_id)).toEqual([ids.modClientA]);
    });

    it("lit la ligne de son client de modération, pas celle du voisin", async () => {
      const { data } = await clients.clientA
        .from("moderation_clients")
        .select("id")
        .in("id", [ids.modClientA, ids.modClientB]);
      expect(data?.map((row) => row.id)).toEqual([ids.modClientA]);
    });
  });

  describe("la FAQ ouverte n'ouvre pas l'inbox", () => {
    it("un client ne lit aucune conversation, pas même celles de son compte", async () => {
      const { data } = await clients.clientA
        .from("conversations")
        .select("id, excerpt")
        .eq("client_id", ids.modClientA);
      expect(data).toEqual([]);
    });
  });

  describe("le verdict ne se pose jamais en écriture directe", () => {
    it("un client ne modifie pas son propre client_review par l'API", async () => {
      const { data } = await clients.clientA
        .from("faq_entries")
        .update({ client_review: "approved" })
        .eq("id", ids.entryA)
        .select("id");
      expect(data ?? []).toEqual([]);

      const { data: after } = await admin
        .from("faq_entries")
        .select("client_review")
        .eq("id", ids.entryA)
        .single();
      expect(after?.client_review).toBe("pending");
    });

    it("un client ne réécrit pas la réponse d'un élément de langage", async () => {
      const { data } = await clients.clientA
        .from("faq_entries")
        .update({ answer_fr: "Réponse falsifiée" })
        .eq("id", ids.entryA)
        .select("id");
      expect(data ?? []).toEqual([]);
    });

    it("un client ne crée pas d'entrée FAQ", async () => {
      const { data } = await clients.clientA
        .from("faq_entries")
        .insert({
          client_id: ids.modClientA,
          question_canonical: "Entrée intruse",
        } as never)
        .select("id");
      expect(data ?? []).toEqual([]);
    });
  });

  describe("le fil d'un élément de langage", () => {
    it("un client lit le fil de sa FAQ", async () => {
      const { data } = await clients.clientA
        .from("faq_comments")
        .select("id, body")
        .in("id", [ids.commentA, ids.commentB]);
      expect(data?.map((row) => row.id)).toEqual([ids.commentA]);
    });

    it("un client écrit dans le fil de sa FAQ", async () => {
      const { data, error } = await clients.clientA
        .from("faq_comments")
        .insert({
          client_id: ids.modClientA,
          entry_id: ids.entryA,
          body: "C'est d'accord pour nous.",
        } as never)
        .select("id");
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(1);
    });

    it("un client ne lit pas le fil du voisin, même en ciblant son id", async () => {
      const { data } = await clients.clientA
        .from("faq_comments")
        .select("id, body")
        .eq("id", ids.commentB);
      expect(data).toEqual([]);
    });

    it("un client n'écrit pas dans le fil du voisin", async () => {
      const { data } = await clients.clientA
        .from("faq_comments")
        .insert({
          client_id: ids.modClientB,
          entry_id: ids.entryB,
          body: "Message intrus",
        } as never)
        .select("id");
      expect(data ?? []).toEqual([]);
    });

    it("personne ne réécrit ni n'efface un message posté, pas même l'owner", async () => {
      for (const session of [clients.clientA, clients.owner]) {
        const { data: rewritten } = await session
          .from("faq_comments")
          .update({ body: "Message falsifié" })
          .eq("id", ids.commentA)
          .select("id");
        expect(rewritten ?? []).toEqual([]);

        const { data: removed } = await session
          .from("faq_comments")
          .delete()
          .eq("id", ids.commentA)
          .select("id");
        expect(removed ?? []).toEqual([]);
      }

      const { data: after } = await admin
        .from("faq_comments")
        .select("body")
        .eq("id", ids.commentA)
        .single();
      expect(after?.body).toBe("Autorisation demandée à Client A");
    });
  });

  describe("les réponses enregistrées (20260913a-b)", () => {
    /* La bibliothèque est un outil **interne** : elle vit sur `client_id` et
       passe par `app.moderation_client_ids()`, comme les conversations. Un
       client d'espace, qui lit pourtant la FAQ depuis 20260830, n'y a aucun
       accès — c'est la limite qu'on vérifie dans les deux sens. */
    let replyA = "";

    it("l'owner enregistre une réponse chez son client", async () => {
      const { data, error } = await clients.owner
        .from("saved_replies")
        .insert({
          client_id: ids.modClientA,
          title: `${RUN} accueil`,
          body: "Bonjour, merci pour votre message.",
          tags: ["accueil"],
          scope: ["dm"],
        })
        .select("id")
        .maybeSingle();
      expect(error).toBeNull();
      expect(data?.id).toBeTruthy();
      replyA = (data as { id: string }).id;
    });

    it("l'owner la relit", async () => {
      const { data } = await clients.owner
        .from("saved_replies")
        .select("id, title")
        .eq("id", replyA);
      expect(data).toHaveLength(1);
    });

    it("le client de l'espace ne la lit pas — la FAQ est ouverte, pas l'inbox", async () => {
      const { data } = await clients.clientA
        .from("saved_replies")
        .select("id")
        .eq("id", replyA);
      expect(data ?? []).toHaveLength(0);
    });

    it("le client de l'espace n'en crée pas", async () => {
      const { error } = await clients.clientA.from("saved_replies").insert({
        client_id: ids.modClientA,
        title: `${RUN} intrus`,
        body: "Ne doit jamais entrer.",
      });
      expect(error).not.toBeNull();
    });

    it("le client voisin ne la lit pas davantage", async () => {
      const { data } = await clients.clientB
        .from("saved_replies")
        .select("id")
        .eq("id", replyA);
      expect(data ?? []).toHaveLength(0);
    });

    it("l'owner la retire", async () => {
      const { error } = await clients.owner
        .from("saved_replies")
        .delete()
        .eq("id", replyA);
      expect(error).toBeNull();
    });
  });

  describe("l'owner de l'organisation", () => {
    it("lit les FAQ des deux clients", async () => {
      const { data } = await clients.owner
        .from("faq_entries")
        .select("id")
        .in("id", [ids.entryA, ids.entryB]);
      expect(data).toHaveLength(2);
    });

    it("écrit dans une entrée — le circuit interne reste entier", async () => {
      const { data } = await clients.owner
        .from("faq_entries")
        .update({ answer_en: "Answer for English speakers" })
        .eq("id", ids.entryA)
        .select("id, answer_en");
      expect(data?.[0]?.answer_en).toBe("Answer for English speakers");
    });
  });
});
