/**
 * Isolation du module Reçus.
 *
 * Les Reçus ne vivent pas dans un espace client mais dans une organisation :
 * la colonne de cloisonnement est `org_id`, et l'appartenance se lit dans
 * `organization_members`. C'est un troisième modèle de tenant, distinct de
 * celui du Planning (`workspace_id`) et de celui de la Modération
 * (`client_id`) — raison de plus pour le prouver plutôt que de le supposer.
 *
 * Comme les deux autres suites d'isolation, ces tests ouvrent de vraies
 * sessions et attaquent l'API REST directement, hors de toute interface. Tout
 * est préfixé `zz-recu-` et nettoyé en fin de suite.
 *
 * Trois choses sont vérifiées, pas une :
 *
 *   • une organisation ne voit rien de l'organisation voisine ;
 *   • un membre simple n'est pas un owner — il lit les dépenses, mais ni la
 *     boîte surveillée, qui porte le refresh token, ni le droit de décider ;
 *   • et l'autre moitié de la règle, celle qu'on oublie : un owner travaille
 *     bien chez lui, sans quoi la politique serait juste et le produit cassé.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const configured = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);
const suite = configured ? describe : describe.skip;

const RUN = `zz-recu-${Date.now()}`;
const PASSWORD = "Test!Recus-2026";

const emails = {
  ownerA: `${RUN}-owner-a@antidotes.test`,
  memberA: `${RUN}-member-a@antidotes.test`,
  ownerB: `${RUN}-owner-b@antidotes.test`,
  client: `${RUN}-client@antidotes.test`,
};

suite("isolation du module Reçus (RLS)", () => {
  // Créé dans `beforeAll` et non ici : le corps d'un `describe.skip` est tout
  // de même exécuté à la collecte, et `createClient(undefined)` ferait échouer
  // le fichier entier sur une machine sans `.env.local` — au lieu de le sauter.
  let admin!: SupabaseClient;
  let anon!: SupabaseClient;

  const ids = {
    orgA: "",
    orgB: "",
    workspaceA: "",
    sourceA: "",
    sourceB: "",
    expenseA: "",
    expenseB: "",
    documentA: "",
    documentB: "",
    ruleB: "",
  };
  const userIds: Record<keyof typeof emails, string> = {} as never;
  const clients: Record<keyof typeof emails, SupabaseClient> = {} as never;

  async function signIn(email: string) {
    const client = createClient(SUPABASE_URL!, ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
    if (error) throw new Error(`Connexion impossible (${email}) : ${error.message}`);
    return client;
  }

  /** Une organisation avec sa boîte surveillée, une dépense et une pièce. */
  async function seedOrg(slug: string, name: string) {
    const { data: org, error } = await admin
      .from("organizations")
      .insert({ name, slug })
      .select("id")
      .single();
    if (error) throw new Error(`Migrations non appliquées ? ${error.message}`);

    const { data: source, error: sourceError } = await admin
      .from("receipt_sources")
      .insert({
        org_id: org.id,
        email_address: `${slug}@antidotes.test`,
        credentials_encrypted: `jeton-chiffre-de-${slug}`,
      })
      .select("id")
      .single();
    if (sourceError) throw new Error(`Migration 0010 non appliquée ? ${sourceError.message}`);

    const { data: expense } = await admin
      .from("receipt_expenses")
      .insert({
        org_id: org.id,
        external_id: `exp-${slug}`,
        merchant: `Fournisseur confidentiel de ${name}`,
        amount_cents: 12_900,
        currency: "EUR",
        transaction_date: "2026-07-14",
      })
      .select("id")
      .single();

    const { data: document } = await admin
      .from("receipt_documents")
      .insert({
        org_id: org.id,
        source_id: source.id,
        external_message_id: `msg-${slug}`,
        received_at: "2026-07-14T09:00:00Z",
        from_email: `facturation@${slug}.test`,
        subject: `Facture confidentielle de ${name}`,
        kind: "invoice",
        amount_cents: 12_900,
        currency: "EUR",
        status: "awaiting_validation",
      })
      .select("id")
      .single();

    const { data: rule } = await admin
      .from("receipt_merchant_rules")
      .insert({ org_id: org.id, sender_domain: `${slug}.test`, merchant: name })
      .select("id")
      .single();

    await admin
      .from("receipt_events")
      .insert({ org_id: org.id, document_id: document!.id, action: "detected" });

    return {
      orgId: org.id,
      sourceId: source.id,
      expenseId: expense!.id,
      documentId: document!.id,
      ruleId: rule!.id,
    };
  }

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    anon = createClient(SUPABASE_URL!, ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const a = await seedOrg(`${RUN}-a`, "Antidotes A");
    const b = await seedOrg(`${RUN}-b`, "Antidotes B");
    ids.orgA = a.orgId;
    ids.sourceA = a.sourceId;
    ids.expenseA = a.expenseId;
    ids.documentA = a.documentId;
    ids.orgB = b.orgId;
    ids.sourceB = b.sourceId;
    ids.expenseB = b.expenseId;
    ids.documentB = b.documentId;
    ids.ruleB = b.ruleId;

    // L'espace client sert uniquement à fabriquer un utilisateur qui a bien un
    // accès à la plateforme, mais aucune appartenance à l'organisation.
    const { data: workspace } = await admin
      .from("workspaces")
      .insert({ org_id: ids.orgA, type: "client", slug: `${RUN}-espace`, name: "Client tiers" })
      .select("id")
      .single();
    ids.workspaceA = workspace!.id;

    // Les invitations précèdent la création des comptes : c'est le trigger
    // `app.handle_new_user` qui transforme l'invitation en accès.
    await admin.from("invitations").insert([
      { email: emails.ownerA, org_id: ids.orgA, workspace_id: null, role: "owner" },
      { email: emails.ownerB, org_id: ids.orgB, workspace_id: null, role: "owner" },
      {
        email: emails.client,
        org_id: ids.orgA,
        workspace_id: ids.workspaceA,
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
      clients[key as keyof typeof emails] = await signIn(email);
    }

    /* Aucune invitation ne produit un membre simple d'organisation : le trigger
       ne crée un `organization_members` que pour le rôle `owner`, les autres
       rôles atterrissant dans `memberships`. La ligne est donc posée à la main,
       c'est le seul chemin qui existe aujourd'hui. */
    await admin
      .from("organization_members")
      .insert({ org_id: ids.orgA, user_id: userIds.memberA, role: "member" });
  });

  afterAll(async () => {
    for (const userId of Object.values(userIds)) {
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    }
    if (ids.orgA) await admin.from("organizations").delete().eq("id", ids.orgA);
    if (ids.orgB) await admin.from("organizations").delete().eq("id", ids.orgB);
    await admin.from("invitations").delete().like("email", `${RUN}%`);
  });

  describe("une organisation ne voit rien de la voisine", () => {
    it("ne lit aucune dépense de l'autre organisation, même en ciblant son id", async () => {
      const { data } = await clients.ownerA
        .from("receipt_expenses")
        .select("id, merchant")
        .eq("id", ids.expenseB);
      expect(data).toEqual([]);
    });

    it("ne lit aucune pièce de l'autre organisation", async () => {
      const { data } = await clients.ownerA
        .from("receipt_documents")
        .select("id, subject")
        .in("id", [ids.documentA, ids.documentB]);
      expect(data?.map((row) => row.id)).toEqual([ids.documentA]);
    });

    it("ne lit ni les règles ni le journal de l'autre organisation", async () => {
      const [{ data: rules }, { data: events }] = await Promise.all([
        clients.ownerA.from("receipt_merchant_rules").select("id").eq("org_id", ids.orgB),
        clients.ownerA.from("receipt_events").select("id").eq("org_id", ids.orgB),
      ]);
      expect(rules).toEqual([]);
      expect(events).toEqual([]);
    });

    it("ne lit pas la boîte surveillée de l'autre organisation, jeton compris", async () => {
      const { data } = await clients.ownerA
        .from("receipt_sources")
        .select("id, credentials_encrypted")
        .eq("id", ids.sourceB);
      expect(data).toEqual([]);
    });

    it("ne peut pas décider d'une pièce de l'autre organisation", async () => {
      const { data } = await clients.ownerA
        .from("receipt_documents")
        .update({ status: "ignored" })
        .eq("id", ids.documentB)
        .select("id");
      expect(data ?? []).toEqual([]);

      const { data: after } = await admin
        .from("receipt_documents")
        .select("status")
        .eq("id", ids.documentB)
        .single();
      expect(after?.status).toBe("awaiting_validation");
    });

    it("ne peut pas poser de règle fournisseur chez l'autre organisation", async () => {
      const { error } = await clients.ownerA
        .from("receipt_merchant_rules")
        .insert({ org_id: ids.orgB, sender_domain: "injection.test", auto_forward: true });
      expect(error).not.toBeNull();
    });
  });

  describe("un membre simple n'est pas un owner", () => {
    it("lit bien les dépenses de son organisation", async () => {
      const { data } = await clients.memberA
        .from("receipt_expenses")
        .select("id")
        .eq("id", ids.expenseA);
      expect(data?.map((row) => row.id)).toEqual([ids.expenseA]);
    });

    it("ne lit pas la boîte surveillée, qui porte le refresh token", async () => {
      const { data } = await clients.memberA
        .from("receipt_sources")
        .select("id, credentials_encrypted")
        .eq("id", ids.sourceA);
      expect(data).toEqual([]);
    });

    it("ne peut pas décider d'une pièce", async () => {
      const { data } = await clients.memberA
        .from("receipt_documents")
        .update({ status: "ignored" })
        .eq("id", ids.documentA)
        .select("id");
      expect(data ?? []).toEqual([]);

      const { data: after } = await admin
        .from("receipt_documents")
        .select("status")
        .eq("id", ids.documentA)
        .single();
      expect(after?.status).toBe("awaiting_validation");
    });

    it("ne peut pas poser de règle fournisseur", async () => {
      const { error } = await clients.memberA
        .from("receipt_merchant_rules")
        .insert({ org_id: ids.orgA, sender_domain: "membre.test" });
      expect(error).not.toBeNull();
    });
  });

  describe("le miroir et le journal ne s'écrivent pas depuis l'application", () => {
    it("un owner ne peut pas inventer une dépense", async () => {
      const { error } = await clients.ownerA.from("receipt_expenses").insert({
        org_id: ids.orgA,
        external_id: "exp-invente",
        amount_cents: 100,
        currency: "EUR",
      });
      expect(error).not.toBeNull();
    });

    it("un owner ne peut pas modifier le montant d'une dépense", async () => {
      const { data } = await clients.ownerA
        .from("receipt_expenses")
        .update({ amount_cents: 1 })
        .eq("id", ids.expenseA)
        .select("id");
      expect(data ?? []).toEqual([]);

      const { data: after } = await admin
        .from("receipt_expenses")
        .select("amount_cents")
        .eq("id", ids.expenseA)
        .single();
      expect(after?.amount_cents).toBe(12_900);
    });

    it("un owner ne peut pas écrire dans le journal", async () => {
      const { error } = await clients.ownerA
        .from("receipt_events")
        .insert({ org_id: ids.orgA, document_id: ids.documentA, action: "forge" });
      expect(error).not.toBeNull();
    });

    it("un owner ne peut pas supprimer une pièce partie", async () => {
      await clients.ownerA.from("receipt_documents").delete().eq("id", ids.documentA);

      const { data: still } = await admin
        .from("receipt_documents")
        .select("id")
        .eq("id", ids.documentA)
        .maybeSingle();
      expect(still?.id).toBe(ids.documentA);
    });
  });

  describe("un owner travaille bien chez lui", () => {
    it("lit sa boîte surveillée", async () => {
      const { data } = await clients.ownerA
        .from("receipt_sources")
        .select("id")
        .eq("id", ids.sourceA);
      expect(data?.map((row) => row.id)).toEqual([ids.sourceA]);
    });

    it("décide d'une pièce de son organisation", async () => {
      const { data } = await clients.ownerA
        .from("receipt_documents")
        .update({ status: "ignored" })
        .eq("id", ids.documentA)
        .select("id, status");
      expect(data?.[0]?.status).toBe("ignored");
    });

    it("pose une règle fournisseur chez lui", async () => {
      const { error } = await clients.ownerA
        .from("receipt_merchant_rules")
        .insert({ org_id: ids.orgA, sender_domain: "fournisseur-valide.test" });
      expect(error).toBeNull();
    });
  });

  describe("qui n'est pas de l'organisation ne voit rien", () => {
    it("un client d'espace ne lit aucune des cinq tables", async () => {
      const [sources, expenses, documents, rules, events] = await Promise.all([
        clients.client.from("receipt_sources").select("id"),
        clients.client.from("receipt_expenses").select("id"),
        clients.client.from("receipt_documents").select("id"),
        clients.client.from("receipt_merchant_rules").select("id"),
        clients.client.from("receipt_events").select("id"),
      ]);
      expect(sources.data).toEqual([]);
      expect(expenses.data).toEqual([]);
      expect(documents.data).toEqual([]);
      expect(rules.data).toEqual([]);
      expect(events.data).toEqual([]);
    });

    it("un visiteur anonyme n'obtient rien", async () => {
      const { data } = await anon.from("receipt_documents").select("id");
      expect(data ?? []).toEqual([]);
    });
  });
});
