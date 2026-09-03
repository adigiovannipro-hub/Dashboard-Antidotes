/**
 * Isolation du module Échéances de facturation.
 *
 * Ce module porte les devis signés et leurs échéances mensuelles — les
 * montants facturés à chaque client d'Antidotes. Même cloisonnement que
 * Finance : `org_id`, appartenance lue dans `organization_members`, lecture
 * dès qu'on est membre, écriture réservée à l'owner.
 *
 * Ces tests ouvrent de vraies sessions et attaquent l'API REST directement,
 * hors de toute interface. Tout est préfixé `zz-bill-` et nettoyé en fin de
 * suite.
 *
 * Ils vérifient les deux sens de la règle : rien ne traverse la frontière
 * entre organisations, et un owner travaille bien chez lui — une politique
 * trop stricte casserait la création d'engagement aussi sûrement qu'une
 * politique trop large exposerait la facturation.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const configured = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);
const suite = configured ? describe : describe.skip;

const RUN = `zz-bill-${Date.now()}`;
const PASSWORD = "Test!Billing-2026";

const emails = {
  ownerA: `${RUN}-owner-a@antidotes.test`,
  memberA: `${RUN}-member-a@antidotes.test`,
  ownerB: `${RUN}-owner-b@antidotes.test`,
};

suite("isolation du module Échéances de facturation (RLS)", () => {
  // Créé dans `beforeAll` et non ici : le corps d'un `describe.skip` est tout
  // de même exécuté à la collecte, et `createClient(undefined)` ferait échouer
  // le fichier entier sur une machine sans `.env.local` — au lieu de le sauter.
  let admin!: SupabaseClient;

  const ids = {
    orgA: "",
    orgB: "",
    engagementA: "",
    engagementB: "",
    installmentA: "",
    installmentB: "",
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

  /** Une organisation avec un engagement et sa première échéance. */
  async function seedOrg(slug: string, name: string) {
    const { data: org, error } = await admin
      .from("organizations")
      .insert({ name, slug })
      .select("id")
      .single();
    if (error) throw new Error(`Migrations non appliquées ? ${error.message}`);

    const { data: engagement, error: engagementError } = await admin
      .from("billing_engagements")
      .insert({
        org_id: org.id,
        client_name: `Client confidentiel de ${name}`,
        label: "Community management",
        monthly_amount_cents: 250_000,
        currency: "EUR",
        first_month: "2026-08-01",
        months_count: 3,
      })
      .select("id")
      .single();
    if (engagementError) {
      throw new Error(`Migration 0016 non appliquée ? ${engagementError.message}`);
    }

    const { data: installment } = await admin
      .from("billing_installments")
      .insert({
        org_id: org.id,
        engagement_id: engagement.id,
        service_month: "2026-08-01",
        amount_cents: 250_000,
        currency: "EUR",
        issue_on: "2026-09-01",
      })
      .select("id")
      .single();

    return {
      orgId: org.id,
      engagementId: engagement.id,
      installmentId: installment!.id,
    };
  }

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const a = await seedOrg(`${RUN}-a`, "Antidotes A");
    const b = await seedOrg(`${RUN}-b`, "Antidotes B");
    ids.orgA = a.orgId;
    ids.engagementA = a.engagementId;
    ids.installmentA = a.installmentId;
    ids.orgB = b.orgId;
    ids.engagementB = b.engagementId;
    ids.installmentB = b.installmentId;

    // Les invitations précèdent la création des comptes : c'est le trigger
    // `app.handle_new_user` qui transforme l'invitation en accès.
    await admin.from("invitations").insert([
      { email: emails.ownerA, org_id: ids.orgA, workspace_id: null, role: "owner" },
      { email: emails.ownerB, org_id: ids.orgB, workspace_id: null, role: "owner" },
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
       ne crée un `organization_members` que pour le rôle `owner`. La ligne est
       donc posée à la main, c'est le seul chemin qui existe aujourd'hui. */
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
    it("ne lit aucun engagement de l'autre organisation, même en ciblant son id", async () => {
      const { data } = await clients.ownerA
        .from("billing_engagements")
        .select("id, client_name")
        .in("id", [ids.engagementA, ids.engagementB]);
      expect(data?.map((row) => row.id)).toEqual([ids.engagementA]);
    });

    it("ne lit aucune échéance de l'autre organisation", async () => {
      const { data } = await clients.ownerA
        .from("billing_installments")
        .select("id, amount_cents")
        .eq("id", ids.installmentB);
      expect(data).toEqual([]);
    });

    it("ne peut pas créer d'engagement chez l'autre organisation", async () => {
      const { error } = await clients.ownerA.from("billing_engagements").insert({
        org_id: ids.orgB,
        client_name: "Injection",
        label: "X",
        monthly_amount_cents: 1_000,
        currency: "EUR",
        first_month: "2026-08-01",
        months_count: 1,
      });
      expect(error).not.toBeNull();
    });

    it("ne peut pas modifier une échéance de l'autre organisation", async () => {
      const { data } = await clients.ownerA
        .from("billing_installments")
        .update({ status: "paid" })
        .eq("id", ids.installmentB)
        .select("id");
      expect(data ?? []).toEqual([]);

      const { data: after } = await admin
        .from("billing_installments")
        .select("status")
        .eq("id", ids.installmentB)
        .single();
      expect(after?.status).toBe("pending");
    });

    it("ne peut pas supprimer l'engagement de l'autre organisation", async () => {
      await clients.ownerA
        .from("billing_engagements")
        .delete()
        .eq("id", ids.engagementB);

      const { data: still } = await admin
        .from("billing_engagements")
        .select("id")
        .eq("id", ids.engagementB);
      expect(still?.length).toBe(1);
    });
  });

  describe("un owner travaille bien chez lui", () => {
    it("crée un engagement et ses échéances", async () => {
      const { data: engagement, error } = await clients.ownerA
        .from("billing_engagements")
        .insert({
          org_id: ids.orgA,
          client_name: "Nouveau client",
          label: "Campagnes Meta",
          monthly_amount_cents: 180_000,
          currency: "EUR",
          first_month: "2026-09-01",
          months_count: 2,
        })
        .select("id")
        .single();
      expect(error).toBeNull();

      const { error: lineError } = await clients.ownerA
        .from("billing_installments")
        .insert({
          org_id: ids.orgA,
          engagement_id: engagement!.id,
          service_month: "2026-09-01",
          amount_cents: 180_000,
          currency: "EUR",
          issue_on: "2026-10-01",
        });
      expect(lineError).toBeNull();
    });

    it("fait avancer une échéance de chez lui", async () => {
      const { data, error } = await clients.ownerA
        .from("billing_installments")
        .update({ status: "issued", issued_at: new Date().toISOString() })
        .eq("id", ids.installmentA)
        .select("status");
      expect(error).toBeNull();
      expect(data?.[0]?.status).toBe("issued");
    });
  });

  describe("un membre simple lit, mais ne décide pas", () => {
    it("lit bien les engagements et les échéances de son organisation", async () => {
      const [{ data: engagements }, { data: installments }] = await Promise.all([
        clients.memberA
          .from("billing_engagements")
          .select("id")
          .eq("id", ids.engagementA),
        clients.memberA
          .from("billing_installments")
          .select("id")
          .eq("id", ids.installmentA),
      ]);
      expect(engagements?.map((row) => row.id)).toEqual([ids.engagementA]);
      expect(installments?.map((row) => row.id)).toEqual([ids.installmentA]);
    });

    it("ne peut pas créer d'engagement", async () => {
      const { error } = await clients.memberA.from("billing_engagements").insert({
        org_id: ids.orgA,
        client_name: "Par un membre",
        label: "X",
        monthly_amount_cents: 1_000,
        currency: "EUR",
        first_month: "2026-08-01",
        months_count: 1,
      });
      expect(error).not.toBeNull();
    });

    it("ne peut pas faire avancer une échéance", async () => {
      const { data } = await clients.memberA
        .from("billing_installments")
        .update({ status: "paid" })
        .eq("id", ids.installmentA)
        .select("id");
      expect(data ?? []).toEqual([]);
    });
  });

  /* Le journal des envois (20260903e) porte les adresses des clients et le
     texte des mails qui leur sont partis. Il se cloisonne comme le reste du
     module, et il porte en plus la garde qui empêche une relance de partir
     deux fois. */
  describe("le journal des envois", () => {
    it("accepte un envoi chez soi", async () => {
      const { error } = await clients.ownerA.from("billing_invoice_emails").insert({
        org_id: ids.orgA,
        installment_id: ids.installmentA,
        kind: "invoice",
        to_email: "contact@client-a.test",
        cc_emails: ["direction@client-a.test"],
        bcc_email: "a.digiovanni.pro@gmail.com",
        subject: "Facture INV-0001",
        body: "Bonjour, voici la facture.",
      });
      expect(error).toBeNull();
    });

    it("refuse le même mail une seconde fois pour la même mensualité", async () => {
      // C'est la base qui tient l'idempotence, pas le code : un passage
      // rejoué ne doit pas envoyer deux fois la même relance.
      const { error } = await clients.ownerA.from("billing_invoice_emails").insert({
        org_id: ids.orgA,
        installment_id: ids.installmentA,
        kind: "invoice",
        to_email: "contact@client-a.test",
        subject: "Deuxième envoi",
        body: "Non.",
      });
      expect(error).not.toBeNull();
    });

    it("laisse passer une relance, qui est un autre type de mail", async () => {
      const { error } = await clients.ownerA.from("billing_invoice_emails").insert({
        org_id: ids.orgA,
        installment_id: ids.installmentA,
        kind: "reminder_1",
        to_email: "contact@client-a.test",
        subject: "Relance",
        body: "Sauf erreur de ma part…",
      });
      expect(error).toBeNull();
    });

    it("ne laisse pas la voisine lire ce qui est parti", async () => {
      const { data } = await clients.ownerB
        .from("billing_invoice_emails")
        .select("id, to_email")
        .eq("org_id", ids.orgA);
      expect(data ?? []).toEqual([]);
    });

    it("ne laisse pas la voisine journaliser un envoi chez le premier", async () => {
      const { error } = await clients.ownerB.from("billing_invoice_emails").insert({
        org_id: ids.orgA,
        installment_id: ids.installmentA,
        kind: "reminder_2",
        to_email: "voleur@ailleurs.test",
        subject: "Injection",
        body: "Non.",
      });
      expect(error).not.toBeNull();
    });

    it("laisse un membre simple lire le journal sans pouvoir y écrire", async () => {
      const { data } = await clients.memberA
        .from("billing_invoice_emails")
        .select("id")
        .eq("org_id", ids.orgA);
      expect((data ?? []).length).toBeGreaterThan(0);

      const { error } = await clients.memberA.from("billing_invoice_emails").insert({
        org_id: ids.orgA,
        installment_id: ids.installmentA,
        kind: "reminder_3",
        to_email: "contact@client-a.test",
        subject: "Par un membre",
        body: "Non.",
      });
      expect(error).not.toBeNull();
    });

    it("ne laisse pas la voisine lire l'adresse de destinataire d'un devis", async () => {
      // Les colonnes d'envoi vivent sur `billing_engagements` : la politique
      // porte sur la ligne, il faut vérifier qu'aucune ne fuit par là.
      await admin
        .from("billing_engagements")
        .update({ recipient_email: "secret@client-a.test" })
        .eq("id", ids.engagementA);

      const { data } = await clients.ownerB
        .from("billing_engagements")
        .select("id, recipient_email")
        .eq("id", ids.engagementA);
      expect(data ?? []).toEqual([]);
    });
  });
});
