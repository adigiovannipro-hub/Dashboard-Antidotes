/**
 * Isolation du pôle Antidotes.
 *
 * La prospection de l'agence est un outil interne rattaché à l'organisation :
 * un client d'espace ne doit ni la lire, ni y écrire, ni même déduire son
 * existence. Ces tests le prouvent **dans la base** : ils ouvrent de vraies
 * sessions et attaquent l'API REST directement, hors de toute interface.
 *
 * Ils vérifient aussi l'autre moitié de la règle : l'owner travaille — il
 * crée un prospect, lui ajoute un contact, note un appel, le fait avancer.
 * Et les deux garanties que le schéma porte lui-même : le journal ne se
 * réécrit pas, même par l'owner ; une désinscription est définitive.
 *
 * Comme `isolation.test.ts`, jeu éphémère préfixé `zz-antidotes-`, nettoyé
 * en fin de suite.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const configured = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);
const suite = configured ? describe : describe.skip;

const RUN = `zz-antidotes-${Date.now()}`;
const PASSWORD = "Test!Antidotes-2026";

const emails = {
  owner: `${RUN}-owner@antidotes.test`,
  client: `${RUN}-client@antidotes.test`,
};

suite("isolation du pôle Antidotes (RLS)", () => {
  // Créé dans `beforeAll` et non ici : le corps d'un `describe.skip` est tout
  // de même exécuté à la collecte, et `createClient(undefined)` ferait échouer
  // le fichier entier sur une machine sans `.env.local` — au lieu de le sauter.
  let admin!: SupabaseClient;

  const ids = {
    org: "",
    workspace: "",
    prospect: "",
    contact: "",
    interaction: "",
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

    const { data: prospect, error: prospectError } = await admin
      .from("antidotes_prospects")
      .insert({
        org_id: ids.org,
        source: "manual",
        company_name: "Lunettes Témoin",
        country: "FR",
        city: "Lyon",
        sector: "Opticien",
        ads_active: true,
      })
      .select("id")
      .single();
    if (prospectError) {
      throw new Error(`Migration 20260907a non appliquée ? ${prospectError.message}`);
    }
    ids.prospect = prospect.id;

    const { data: contact, error: contactError } = await admin
      .from("antidotes_contacts")
      .insert({
        org_id: ids.org,
        prospect_id: ids.prospect,
        first_name: "Ana",
        email: "ana@lunettes-temoin.fr",
        email_status: "risky",
        is_primary: true,
      })
      .select("id")
      .single();
    if (contactError) throw new Error(contactError.message);
    ids.contact = contact.id;

    const { data: interaction, error: interactionError } = await admin
      .from("antidotes_interactions")
      .insert({
        org_id: ids.org,
        prospect_id: ids.prospect,
        contact_id: ids.contact,
        type: "note",
        payload: { text: "Repérée sur Maps." },
      })
      .select("id")
      .single();
    if (interactionError) throw new Error(interactionError.message);
    ids.interaction = interaction.id;

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

  describe("un client ne voit pas le pôle", () => {
    it("ne lit aucun prospect, même en ciblant son id", async () => {
      const { data } = await clients.client
        .from("antidotes_prospects")
        .select("id, company_name")
        .eq("id", ids.prospect);
      expect(data).toEqual([]);
    });

    it("ne lit ni les contacts ni le journal", async () => {
      const [{ data: contacts }, { data: interactions }] = await Promise.all([
        clients.client.from("antidotes_contacts").select("id").eq("prospect_id", ids.prospect),
        clients.client
          .from("antidotes_interactions")
          .select("id")
          .eq("prospect_id", ids.prospect),
      ]);
      expect(contacts).toEqual([]);
      expect(interactions).toEqual([]);
    });

    it("ne peut pas créer de prospect dans l'organisation", async () => {
      const { error } = await clients.client.from("antidotes_prospects").insert({
        org_id: ids.org,
        source: "manual",
        company_name: "Intrusion",
      });
      expect(error).not.toBeNull();
    });

    it("ne peut ni déplacer ni supprimer un prospect de l'owner", async () => {
      const { data: updated } = await clients.client
        .from("antidotes_prospects")
        .update({ status: "won" })
        .eq("id", ids.prospect)
        .select("id");
      expect(updated ?? []).toEqual([]);

      await clients.client.from("antidotes_prospects").delete().eq("id", ids.prospect);

      const { data: still } = await admin
        .from("antidotes_prospects")
        .select("status")
        .eq("id", ids.prospect)
        .single();
      expect(still?.status).toBe("to_qualify");
    });
  });

  describe("l'owner prospecte chez lui", () => {
    it("lit le pipeline, contacts et journal compris", async () => {
      const [{ data: prospects }, { data: contacts }, { data: interactions }] =
        await Promise.all([
          clients.owner.from("antidotes_prospects").select("id").eq("id", ids.prospect),
          clients.owner
            .from("antidotes_contacts")
            .select("id, outreach_channel")
            .eq("prospect_id", ids.prospect),
          clients.owner
            .from("antidotes_interactions")
            .select("id")
            .eq("prospect_id", ids.prospect),
        ]);
      expect(prospects).toHaveLength(1);
      expect(contacts).toHaveLength(1);
      // Colonne générée : une adresse `risky` route vers LinkedIn.
      expect(contacts?.[0]?.outreach_channel).toBe("linkedin");
      expect(interactions).toHaveLength(1);
    });

    it("crée un prospect à la main puis le fait avancer", async () => {
      const { data: created, error } = await clients.owner
        .from("antidotes_prospects")
        .insert({
          org_id: ids.org,
          source: "manual",
          company_name: "Escalade Témoin",
          country: "FR",
        })
        .select("id, status, score")
        .single();
      expect(error).toBeNull();
      expect(created?.status).toBe("to_qualify");
      expect(created?.score).toBe(0);

      const { data: moved } = await clients.owner
        .from("antidotes_prospects")
        .update({ status: "qualified" })
        .eq("id", created!.id)
        .select("status");
      expect(moved?.[0]?.status).toBe("qualified");
    });

    it("note un appel, ce qui date le dernier contact", async () => {
      const { error } = await clients.owner.from("antidotes_interactions").insert({
        org_id: ids.org,
        prospect_id: ids.prospect,
        contact_id: ids.contact,
        type: "call",
        payload: { text: "Rappel prévu jeudi." },
      });
      expect(error).toBeNull();

      const { data } = await clients.owner
        .from("antidotes_prospects")
        .select("last_contact_at")
        .eq("id", ids.prospect)
        .single();
      expect(data?.last_contact_at).not.toBeNull();
    });

    it("ne peut pas réécrire le journal, même chez lui", async () => {
      const { data: updated } = await clients.owner
        .from("antidotes_interactions")
        .update({ type: "meeting" })
        .eq("id", ids.interaction)
        .select("id");
      expect(updated ?? []).toEqual([]);

      await clients.owner.from("antidotes_interactions").delete().eq("id", ids.interaction);

      const { data: still } = await admin
        .from("antidotes_interactions")
        .select("type")
        .eq("id", ids.interaction)
        .single();
      expect(still?.type).toBe("note");
    });

    it("refuse une boîte générique comme contact", async () => {
      const { error } = await clients.owner.from("antidotes_contacts").insert({
        org_id: ids.org,
        prospect_id: ids.prospect,
        email: "contact@lunettes-temoin.fr",
      });
      expect(error).not.toBeNull();
    });
  });

  describe("la désinscription est définitive", () => {
    it("se date toute seule et ne se retire plus", async () => {
      const { data: optedOut } = await clients.owner
        .from("antidotes_contacts")
        .update({ opted_out: true })
        .eq("id", ids.contact)
        .select("opted_out_at");
      expect(optedOut?.[0]?.opted_out_at).not.toBeNull();

      const { error } = await clients.owner
        .from("antidotes_contacts")
        .update({ opted_out: false })
        .eq("id", ids.contact);
      expect(error).not.toBeNull();

      const { data: still } = await admin
        .from("antidotes_contacts")
        .select("opted_out")
        .eq("id", ids.contact)
        .single();
      expect(still?.opted_out).toBe(true);
    });

    it("bloque toute inscription à une séquence", async () => {
      const { data: sequence, error: sequenceError } = await clients.owner
        .from("antidotes_sequences")
        .insert({ org_id: ids.org, name: "Séquence témoin" })
        .select("id")
        .single();
      expect(sequenceError).toBeNull();

      const { error } = await clients.owner.from("antidotes_sequence_enrollments").insert({
        org_id: ids.org,
        sequence_id: sequence!.id,
        contact_id: ids.contact,
      });
      expect(error).not.toBeNull();
    });
  });
});
