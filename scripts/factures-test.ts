/**
 * Le banc d'essai de la chaîne de facturation — un client, un produit, une
 * facture modèle et un devis, tous à 1 €, tous marqués « TEST ».
 *
 *   pnpm factures:test --preparer   met le scénario en place
 *   pnpm factures:test --etat       dit où en est le scénario
 *   pnpm factures:test --relance N  antidate le journal pour rendre la
 *                                   relance N due dès le prochain passage
 *   pnpm factures:test --nettoyer   retire le devis et son journal
 *
 * Pourquoi un client et un produit dédiés : la chaîne duplique une facture
 * existante, et prendre celle d'un vrai client ferait apparaître une facture
 * de 1 € dans son historique. Le banc d'essai ne touche à personne.
 *
 * Ce que le nettoyage **ne fait pas** : supprimer les factures émises chez
 * Airwallex. Une facture finalisée porte un numéro et devient un document
 * comptable ; elle s'annule (`void`) depuis l'interface, en connaissance de
 * cause. Le script dit lesquelles.
 *
 * À jouer sur un runner GitHub : Airwallex refuse les adresses IP de Vercel,
 * et les clés ne vivent pas sur la machine de développement.
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

/** Ce qui identifie le banc d'essai partout où il laisse une trace. */
const MARQUEUR = "TEST FACTURATION AUTOMATIQUE";
const DESTINATAIRE = "a.digiovanni.pro@gmail.com";

function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : (process.argv[index + 1] ?? "");
}

function has(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const { createAdminClient } = await import("../src/lib/supabase/server");
  const admin = createAdminClient();

  const { data: orgs, error: orgError } = await admin
    .from("organizations")
    .select("id")
    .order("created_at")
    .limit(1);
  if (orgError) throw new Error(`Lecture des organisations : ${orgError.message}`);
  const orgId = (orgs as { id: string }[] | null)?.[0]?.id;
  if (!orgId) throw new Error("Aucune organisation en base.");

  if (has("nettoyer")) return nettoyer(admin, orgId);
  if (has("etat")) return etat(admin, orgId);
  if (arg("relance") !== null) return antidater(admin, orgId, Number(arg("relance")));
  if (has("preparer")) return preparer(admin, orgId);

  console.error("Choisir : --preparer, --etat, --relance N ou --nettoyer.");
  process.exit(1);
}

type Admin = Awaited<
  ReturnType<typeof import("../src/lib/supabase/server").createAdminClient>
>;

// --- Mise en place ----------------------------------------------------------

async function preparer(admin: Admin, orgId: string) {
  const { post } = await import("../src/lib/airwallex/transport");
  const { emitInvoiceFromTemplate, getInvoiceTemplate } = await import(
    "../src/lib/finance/airwallex-emission"
  );

  const stamp = Date.now();

  /* Un client de facturation à nous : la facture d'essai ne doit apparaître
     dans l'historique d'aucun vrai client. */
  const customer = await post<{ id?: string }>("/api/v1/billing_customers/create", {
    request_id: `test-client-${stamp}`,
    name: MARQUEUR,
    email: DESTINATAIRE,
    type: "BUSINESS",
  });
  const customerId = customer.id;
  if (!customerId) throw new Error("Client de facturation non créé.");
  console.log(`Client de facturation : ${customerId}`);

  const product = await post<{ id?: string }>("/api/v1/products/create", {
    request_id: `test-produit-${stamp}`,
    name: MARQUEUR,
    description: "Essai de la chaîne d'émission automatique. Un euro.",
    active: true,
  });
  const productId = product.id;
  if (!productId) throw new Error("Produit non créé.");
  console.log(`Produit : ${productId}`);

  const price = await post<{ id?: string }>("/api/v1/prices/create", {
    request_id: `test-prix-${stamp}`,
    product_id: productId,
    currency: "EUR",
    unit_amount: 1,
    type: "ONE_OFF",
    pricing_model: "PER_UNIT",
    active: true,
  });
  const priceId = price.id;
  if (!priceId) throw new Error("Prix non créé.");

  /* La facture modèle — celle qu'on créerait à la main la première fois. Elle
     est finalisée : c'est ce qui lui donne son numéro, et le dispositif lit sa
     forme, pas son statut. */
  const draft = await post<{ id?: string }>("/api/v1/invoices/create", {
    request_id: `test-modele-${stamp}`,
    billing_customer_id: customerId,
    currency: "EUR",
    collection_method: "OUT_OF_BAND",
    days_until_due: 30,
    memo: "Facture d'essai — chaîne d'envoi automatique. Aucun règlement attendu.",
  });
  const modelId = draft.id;
  if (!modelId) throw new Error("Facture modèle non créée.");

  await post(`/api/v1/invoices/${modelId}/add_line_items`, {
    request_id: `test-modele-lignes-${stamp}`,
    line_items: [{ price_id: priceId, quantity: 1 }],
  });
  await post(`/api/v1/invoices/${modelId}/finalize`, {
    request_id: `test-modele-finalisation-${stamp}`,
  });
  console.log(`Facture modèle : ${modelId}`);

  /* Contrôle : le dispositif doit savoir relire cette facture pour la
     dupliquer. Mieux vaut le découvrir ici que dans le passage. */
  const template = await getInvoiceTemplate(modelId);
  if (!template?.billing_customer_id) {
    throw new Error(`La facture modèle ${modelId} est illisible.`);
  }
  console.log(`Modèle relu : client ${template.billing_customer_id}, ${template.currency}`);
  void emitInvoiceFromTemplate;

  /* Le devis : un mois de prestation terminé, donc une mensualité à facturer
     tout de suite. Le mois précédent celui d'aujourd'hui. */
  const now = new Date();
  const serviceMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const issueOn = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const { data: engagement, error } = await admin
    .from("billing_engagements")
    .insert({
      org_id: orgId,
      client_name: MARQUEUR,
      label: "Essai de la chaîne d'envoi",
      monthly_amount_cents: 100,
      currency: "EUR",
      vat_rate: 0,
      first_month: serviceMonth.toISOString().slice(0, 10),
      months_count: 1,
      notes: "Banc d'essai — à supprimer une fois la chaîne vérifiée.",
      recipient_email: DESTINATAIRE,
      cc_emails: [],
      contact_first_name: "Alessandro",
      airwallex_customer_id: customerId,
      airwallex_product_id: productId,
      template_invoice_external_id: modelId,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(`Création du devis : ${error.message}`);

  const engagementId = (engagement as { id: string }).id;

  const { error: lineError } = await admin.from("billing_installments").insert({
    org_id: orgId,
    engagement_id: engagementId,
    service_month: serviceMonth.toISOString().slice(0, 10),
    amount_cents: 100,
    currency: "EUR",
    vat_rate: 0,
    issue_on: issueOn.toISOString().slice(0, 10),
    status: "pending",
  } as never);
  if (lineError) throw new Error(`Création de la mensualité : ${lineError.message}`);

  console.log(`\nDevis d'essai : ${engagementId}`);
  console.log(
    `Mensualité de ${serviceMonth.toISOString().slice(0, 7)}, à facturer depuis le ${issueOn.toISOString().slice(0, 10)}.`,
  );
  console.log("Le prochain passage doit émettre la facture et l'envoyer.");
}

// --- État -------------------------------------------------------------------

async function etat(admin: Admin, orgId: string) {
  const { data: engagements } = await admin
    .from("billing_engagements")
    .select("id, recipient_email, template_invoice_external_id")
    .eq("org_id", orgId)
    .eq("client_name", MARQUEUR);

  const rows = (engagements ?? []) as unknown as {
    id: string;
    recipient_email: string | null;
    template_invoice_external_id: string | null;
  }[];
  if (rows.length === 0) return console.log("Aucun devis d'essai en base.");

  for (const engagement of rows) {
    console.log(`\nDevis ${engagement.id} → ${engagement.recipient_email}`);
    console.log(`  modèle : ${engagement.template_invoice_external_id}`);

    const { data: lines } = await admin
      .from("billing_installments")
      .select("id, service_month, status, airwallex_invoice_id, last_send_error")
      .eq("engagement_id", engagement.id);

    for (const line of (lines ?? []) as unknown as {
      id: string;
      service_month: string;
      status: string;
      airwallex_invoice_id: string | null;
      last_send_error: string | null;
    }[]) {
      console.log(
        `  ${line.service_month} · ${line.status} · facture ${line.airwallex_invoice_id ?? "aucune"}${line.last_send_error ? ` · ERREUR ${line.last_send_error}` : ""}`,
      );

      const { data: mails } = await admin
        .from("billing_invoice_emails")
        .select("kind, sent_at, subject, gmail_message_id")
        .eq("installment_id", line.id)
        .order("sent_at");

      for (const mail of (mails ?? []) as unknown as {
        kind: string;
        sent_at: string;
        subject: string;
        gmail_message_id: string | null;
      }[]) {
        console.log(
          `    ${mail.kind} · ${mail.sent_at.slice(0, 16).replace("T", " ")} · « ${mail.subject} » · gmail ${mail.gmail_message_id ?? "?"}`,
        );
      }
    }
  }
}

// --- Antidatage -------------------------------------------------------------

/**
 * Rend la relance `n` due dès maintenant, en reculant la date de l'envoi
 * initial et des relances déjà parties.
 *
 * On recule le journal plutôt que d'avancer l'horloge du passage : c'est la
 * même chose vue de la décision, et cela laisse le passage strictement
 * identique à celui qui tournera pour de vrai.
 */
async function antidater(admin: Admin, orgId: string, n: number) {
  const AFTER_DAYS = [31, 46, 61];
  if (!Number.isInteger(n) || n < 1 || n > 3) {
    throw new Error("--relance attend 1, 2 ou 3.");
  }

  const { data: engagements } = await admin
    .from("billing_engagements")
    .select("id")
    .eq("org_id", orgId)
    .eq("client_name", MARQUEUR);
  const engagementIds = ((engagements ?? []) as unknown as { id: string }[]).map(
    (row) => row.id,
  );
  if (engagementIds.length === 0) throw new Error("Aucun devis d'essai.");

  const { data: lines } = await admin
    .from("billing_installments")
    .select("id")
    .in("engagement_id", engagementIds);
  const lineIds = ((lines ?? []) as unknown as { id: string }[]).map((row) => row.id);

  const { data: mails } = await admin
    .from("billing_invoice_emails")
    .select("id, kind, sent_at")
    .in("installment_id", lineIds);

  const rows = (mails ?? []) as unknown as {
    id: string;
    kind: string;
    sent_at: string;
  }[];
  if (rows.length === 0) throw new Error("Rien n'est encore parti : envoyer d'abord.");

  /* Reculer de ce qu'il faut pour que le palier visé soit franchi d'un jour :
     l'envoi initial part à J-(afterDays + 1), les relances déjà envoyées
     gardent leur écart relatif. */
  const shiftDays = AFTER_DAYS[n - 1]! + 1;

  for (const mail of rows) {
    const sent = new Date(mail.sent_at);
    sent.setUTCDate(sent.getUTCDate() - shiftDays);
    const { error } = await admin
      .from("billing_invoice_emails")
      .update({ sent_at: sent.toISOString() } as never)
      .eq("id", mail.id);
    if (error) throw new Error(`Antidatage refusé : ${error.message}`);
    console.log(`${mail.kind} reculé au ${sent.toISOString().slice(0, 10)}`);
  }

  console.log(`\nLa relance ${n} est due au prochain passage.`);
}

// --- Nettoyage --------------------------------------------------------------

async function nettoyer(admin: Admin, orgId: string) {
  const { data: engagements } = await admin
    .from("billing_engagements")
    .select("id, template_invoice_external_id")
    .eq("org_id", orgId)
    .eq("client_name", MARQUEUR);

  const rows = (engagements ?? []) as unknown as {
    id: string;
    template_invoice_external_id: string | null;
  }[];
  if (rows.length === 0) return console.log("Rien à nettoyer.");

  /* Les factures émises restent : une facture finalisée est un document
     comptable, elle s'annule à la main. On dit lesquelles. */
  const { data: lines } = await admin
    .from("billing_installments")
    .select("airwallex_invoice_id")
    .in(
      "engagement_id",
      rows.map((row) => row.id),
    );

  const factures = [
    ...rows.map((row) => row.template_invoice_external_id),
    ...((lines ?? []) as unknown as { airwallex_invoice_id: string | null }[]).map(
      (line) => line.airwallex_invoice_id,
    ),
  ].filter((id): id is string => Boolean(id));

  /* La cascade emporte mensualités et journal — les deux tables référencent
     l'engagement avec `on delete cascade`. */
  const { error } = await admin
    .from("billing_engagements")
    .delete()
    .in(
      "id",
      rows.map((row) => row.id),
    );
  if (error) throw new Error(`Suppression refusée : ${error.message}`);

  console.log(`${rows.length} devis d'essai supprimé(s), journal compris.`);
  if (factures.length > 0) {
    console.log("\nFactures Airwallex laissées en place — à annuler à la main :");
    for (const id of factures) console.log(`  ${id}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
