/**
 * Isolation du module Finance.
 *
 * Ce module porte la trésorerie, les factures clients et les dépenses carte
 * d'Antidotes. Comme les Reçus, il se cloisonne par `org_id` et lit
 * l'appartenance dans `organization_members` — mais il partage la lecture plus
 * largement : les neuf tables se lisent dès qu'on est membre de
 * l'organisation, alors que toute écriture reste réservée à l'owner.
 *
 * Ces tests ouvrent de vraies sessions et attaquent l'API REST directement,
 * hors de toute interface. Tout est préfixé `zz-fin-` et nettoyé en fin de
 * suite.
 *
 * Ils vérifient les deux sens de la règle : rien ne traverse la frontière
 * entre organisations, et un owner travaille bien chez lui — une politique
 * trop stricte casserait l'écran de recatégorisation aussi sûrement qu'une
 * politique trop large exposerait la trésorerie.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const configured = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);
const suite = configured ? describe : describe.skip;

const RUN = `zz-fin-${Date.now()}`;
const PASSWORD = "Test!Finance-2026";

const emails = {
  ownerA: `${RUN}-owner-a@antidotes.test`,
  memberA: `${RUN}-member-a@antidotes.test`,
  ownerB: `${RUN}-owner-b@antidotes.test`,
  client: `${RUN}-client@antidotes.test`,
};

suite("isolation du module Finance (RLS)", () => {
  // Créé dans `beforeAll` et non ici : le corps d'un `describe.skip` est tout
  // de même exécuté à la collecte, et `createClient(undefined)` ferait échouer
  // le fichier entier sur une machine sans `.env.local` — au lieu de le sauter.
  let admin!: SupabaseClient;
  let anon!: SupabaseClient;

  const ids = {
    orgA: "",
    orgB: "",
    workspaceA: "",
    accountA: "",
    accountB: "",
    balanceB: "",
    invoiceB: "",
    categoryA: "",
    categoryB: "",
    transactionA: "",
    transactionB: "",
    ledgerA: "",
    ledgerB: "",
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

  /** Une organisation avec sa trésorerie, une facture, une catégorie, une dépense. */
  async function seedOrg(slug: string, name: string) {
    const { data: org, error } = await admin
      .from("organizations")
      .insert({ name, slug })
      .select("id")
      .single();
    if (error) throw new Error(`Migrations non appliquées ? ${error.message}`);

    const { data: account, error: accountError } = await admin
      .from("finance_accounts")
      .insert({
        org_id: org.id,
        external_id: `acc-${slug}`,
        currency: "EUR",
        name: `Compte principal de ${name}`,
      })
      .select("id")
      .single();
    if (accountError) throw new Error(`Migration 0012 non appliquée ? ${accountError.message}`);

    const { data: balance } = await admin
      .from("finance_balances_history")
      .insert({
        org_id: org.id,
        account_id: account.id,
        currency: "EUR",
        available_cents: 4_200_000,
        snapshot_hour: "2026-07-14T09:00:00Z",
      })
      .select("id")
      .single();

    const { data: invoice } = await admin
      .from("finance_invoices")
      .insert({
        org_id: org.id,
        external_id: `inv-${slug}`,
        client_name: `Client confidentiel de ${name}`,
        amount_cents: 350_000,
        currency: "EUR",
        status: "sent",
        due_on: "2026-08-31",
      })
      .select("id")
      .single();

    const { data: category } = await admin
      .from("finance_categories")
      .insert({ org_id: org.id, name: "Déplacements", slug: "deplacements" })
      .select("id")
      .single();

    const { data: transaction } = await admin
      .from("finance_transactions")
      .insert({
        org_id: org.id,
        external_id: `txn-${slug}`,
        occurred_at: "2026-07-14T12:30:00Z",
        merchant: `Fournisseur confidentiel de ${name}`,
        amount_cents: 15_880,
        currency: "EUR",
      })
      .select("id")
      .single();

    const { data: ledger } = await admin
      .from("finance_ledger_entries")
      .insert({
        org_id: org.id,
        external_id: `ft-${slug}`,
        occurred_at: "2026-07-02T08:00:00Z",
        amount_cents: 250_000,
        currency: "EUR",
        transaction_type: "DEPOSIT",
      })
      .select("id")
      .single();

    return {
      orgId: org.id,
      accountId: account.id,
      balanceId: balance!.id,
      invoiceId: invoice!.id,
      categoryId: category!.id,
      transactionId: transaction!.id,
      ledgerId: ledger!.id,
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
    ids.accountA = a.accountId;
    ids.categoryA = a.categoryId;
    ids.transactionA = a.transactionId;
    ids.ledgerA = a.ledgerId;
    ids.orgB = b.orgId;
    ids.accountB = b.accountId;
    ids.balanceB = b.balanceId;
    ids.invoiceB = b.invoiceId;
    ids.categoryB = b.categoryId;
    ids.transactionB = b.transactionId;
    ids.ledgerB = b.ledgerId;

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
        .from("finance_transactions")
        .select("id, merchant")
        .in("id", [ids.transactionA, ids.transactionB]);
      expect(data?.map((row) => row.id)).toEqual([ids.transactionA]);
    });

    it("ne lit ni les comptes ni la trésorerie de l'autre organisation", async () => {
      const [{ data: accounts }, { data: balances }] = await Promise.all([
        clients.ownerA.from("finance_accounts").select("id").eq("id", ids.accountB),
        clients.ownerA.from("finance_balances_history").select("id").eq("id", ids.balanceB),
      ]);
      expect(accounts).toEqual([]);
      expect(balances).toEqual([]);
    });

    it("ne lit aucun mouvement du grand livre de l'autre organisation", async () => {
      const { data } = await clients.ownerA
        .from("finance_ledger_entries")
        .select("id")
        .in("id", [ids.ledgerA, ids.ledgerB]);
      expect(data?.map((row) => row.id)).toEqual([ids.ledgerA]);
    });

    it("ne lit aucune facture de l'autre organisation", async () => {
      const { data } = await clients.ownerA
        .from("finance_invoices")
        .select("id, client_name, amount_cents")
        .eq("id", ids.invoiceB);
      expect(data).toEqual([]);
    });

    it("ne peut pas recatégoriser une dépense de l'autre organisation", async () => {
      const { data } = await clients.ownerA
        .from("finance_transactions")
        .update({ merchant: "Injection" })
        .eq("id", ids.transactionB)
        .select("id");
      expect(data ?? []).toEqual([]);

      const { data: after } = await admin
        .from("finance_transactions")
        .select("merchant")
        .eq("id", ids.transactionB)
        .single();
      expect(after?.merchant).toContain("Antidotes B");
    });

    it("ne peut pas créer de catégorie chez l'autre organisation", async () => {
      const { error } = await clients.ownerA
        .from("finance_categories")
        .insert({ org_id: ids.orgB, name: "Injection", slug: "injection" });
      expect(error).not.toBeNull();
    });

    it("ne peut pas déposer de justificatif chez l'autre organisation", async () => {
      const { error } = await clients.ownerA.from("finance_receipts").insert({
        org_id: ids.orgB,
        source: "manual",
        storage_path: `${ids.orgB}/injection.pdf`,
      });
      expect(error).not.toBeNull();
    });
  });

  describe("un membre simple lit, mais ne décide pas", () => {
    it("lit bien les dépenses et la trésorerie de son organisation", async () => {
      const [{ data: transactions }, { data: accounts }] = await Promise.all([
        clients.memberA.from("finance_transactions").select("id").eq("id", ids.transactionA),
        clients.memberA.from("finance_accounts").select("id").eq("id", ids.accountA),
      ]);
      expect(transactions?.map((row) => row.id)).toEqual([ids.transactionA]);
      expect(accounts?.map((row) => row.id)).toEqual([ids.accountA]);
    });

    it("ne peut pas recatégoriser une dépense", async () => {
      const { data } = await clients.memberA
        .from("finance_transactions")
        .update({ category_id: ids.categoryA })
        .eq("id", ids.transactionA)
        .select("id");
      expect(data ?? []).toEqual([]);

      const { data: after } = await admin
        .from("finance_transactions")
        .select("category_id")
        .eq("id", ids.transactionA)
        .single();
      expect(after?.category_id).toBeNull();
    });

    it("ne peut pas créer de catégorie", async () => {
      const { error } = await clients.memberA
        .from("finance_categories")
        .insert({ org_id: ids.orgA, name: "Par un membre", slug: "par-un-membre" });
      expect(error).not.toBeNull();
    });

    it("ne peut pas déposer de justificatif", async () => {
      const { error } = await clients.memberA.from("finance_receipts").insert({
        org_id: ids.orgA,
        source: "manual",
        storage_path: `${ids.orgA}/par-un-membre.pdf`,
      });
      expect(error).not.toBeNull();
    });
  });

  describe("les miroirs Airwallex ne s'écrivent pas depuis l'application", () => {
    it("un owner ne peut pas inventer une facture", async () => {
      const { error } = await clients.ownerA.from("finance_invoices").insert({
        org_id: ids.orgA,
        external_id: "inv-invente",
        client_name: "Client fantôme",
        amount_cents: 1,
        currency: "EUR",
      });
      expect(error).not.toBeNull();
    });

    it("un owner ne peut pas renommer un compte, miroir d'Airwallex", async () => {
      const { data } = await clients.ownerA
        .from("finance_accounts")
        .update({ name: "Compte renommé" })
        .eq("id", ids.accountA)
        .select("id");
      expect(data ?? []).toEqual([]);

      const { data: after } = await admin
        .from("finance_accounts")
        .select("name")
        .eq("id", ids.accountA)
        .single();
      expect(after?.name).toContain("Antidotes A");
    });

    it("un owner ne peut pas inventer un mouvement du grand livre", async () => {
      const { error } = await clients.ownerA.from("finance_ledger_entries").insert({
        org_id: ids.orgA,
        external_id: "ft-invente",
        occurred_at: "2026-08-01T00:00:00Z",
        amount_cents: 1,
        currency: "EUR",
      });
      expect(error).not.toBeNull();
    });

    it("un owner ne peut pas supprimer une dépense", async () => {
      await clients.ownerA.from("finance_transactions").delete().eq("id", ids.transactionA);

      const { data: still } = await admin
        .from("finance_transactions")
        .select("id")
        .eq("id", ids.transactionA)
        .maybeSingle();
      expect(still?.id).toBe(ids.transactionA);
    });
  });

  describe("un owner travaille bien chez lui", () => {
    it("recatégorise une dépense de son organisation", async () => {
      const { data } = await clients.ownerA
        .from("finance_transactions")
        .update({ category_id: ids.categoryA })
        .eq("id", ids.transactionA)
        .select("id, category_id");
      expect(data?.[0]?.category_id).toBe(ids.categoryA);
    });

    it("crée une catégorie et la règle qui l'alimente", async () => {
      const { data: category, error } = await clients.ownerA
        .from("finance_categories")
        .insert({ org_id: ids.orgA, name: "Restauration", slug: "restauration" })
        .select("id")
        .single();
      expect(error).toBeNull();

      const { error: ruleError } = await clients.ownerA
        .from("finance_category_rules")
        .insert({ org_id: ids.orgA, matcher: "Restaurants", category_id: category!.id });
      expect(ruleError).toBeNull();
    });

    it("dépose un justificatif chez lui", async () => {
      const { error } = await clients.ownerA.from("finance_receipts").insert({
        org_id: ids.orgA,
        source: "manual",
        storage_path: `${ids.orgA}/facture.pdf`,
        amount_cents: 15_880,
        currency: "EUR",
      });
      expect(error).toBeNull();
    });
  });

  describe("qui n'est pas de l'organisation ne voit rien", () => {
    it("un client d'espace ne lit aucune des neuf tables", async () => {
      const [accounts, balances, invoices, categories, rules, transactions, receipts, runs, ledger] =
        await Promise.all([
          clients.client.from("finance_accounts").select("id"),
          clients.client.from("finance_balances_history").select("id"),
          clients.client.from("finance_invoices").select("id"),
          clients.client.from("finance_categories").select("id"),
          clients.client.from("finance_category_rules").select("id"),
          clients.client.from("finance_transactions").select("id"),
          clients.client.from("finance_receipts").select("id"),
          clients.client.from("finance_sync_runs").select("id"),
          clients.client.from("finance_ledger_entries").select("id"),
        ]);
      expect(accounts.data).toEqual([]);
      expect(balances.data).toEqual([]);
      expect(invoices.data).toEqual([]);
      expect(categories.data).toEqual([]);
      expect(rules.data).toEqual([]);
      expect(transactions.data).toEqual([]);
      expect(receipts.data).toEqual([]);
      expect(runs.data).toEqual([]);
      expect(ledger.data).toEqual([]);
    });

    it("un visiteur anonyme n'obtient rien", async () => {
      const { data } = await anon.from("finance_transactions").select("id");
      expect(data ?? []).toEqual([]);
    });
  });
});
