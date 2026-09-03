/**
 * Le banc d'essai de la chaîne de facturation — un devis à 1 €, marqué
 * « TEST », et rien d'autre.
 *
 *   pnpm factures:test --preparer   met le scénario en place
 *   pnpm factures:test --etat       dit où en est le scénario
 *   pnpm factures:test --relance N  antidate le journal pour rendre la
 *                                   relance N due dès le prochain passage
 *   pnpm factures:test --nettoyer   retire le devis et son journal
 *
 * Rien n'est préparé chez Airwallex : le dashboard crée lui-même la fiche
 * client, le produit et la facture. Le banc part donc de ce que remplit un
 * humain, et vérifie que la chaîne fait le reste. Il porte son propre nom de
 * client — une facture d'essai n'a rien à faire dans l'historique d'un vrai.
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
  /* Rien n'est créé chez Airwallex ici, et c'est tout l'intérêt : depuis que
     le dashboard crée lui-même la fiche client, le produit et la facture, le
     banc doit partir de ce que remplit un humain — un devis, des coordonnées
     de facturation — et vérifier que la chaîne fait le reste. Préparer le
     terrain chez Airwallex reviendrait à tester le banc, pas le dispositif. */

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
      /* L'identité facturée, telle qu'un humain la saisirait sur la fiche. */
      billing_name: MARQUEUR,
      billing_email: DESTINATAIRE,
      billing_street: "34 Rue de Bélissen",
      billing_city: "Lyon",
      billing_postcode: "69005",
      billing_country: "FR",
      product_name: "ESSAI FACTURATION AUTOMATIQUE",
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

  /* On **positionne** l'envoi initial à J-(palier + 1), au lieu de le reculer
     d'un décalage fixe : appelé deux fois de suite, un décalage fixe s'empile
     et fait franchir le palier suivant — le passage enverrait la relance 3 là
     où on voulait éprouver la 2. Les mails déjà partis suivent le même
     décalage et gardent donc leur écart relatif. */
  const initial = rows.find((mail) => mail.kind === "invoice");
  if (!initial) throw new Error("L'envoi initial n'est pas au journal.");

  const startOfDay = (date: Date) =>
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const elapsed = Math.floor(
    (startOfDay(new Date()) - startOfDay(new Date(initial.sent_at))) / 86_400_000,
  );
  const shiftDays = AFTER_DAYS[n - 1]! + 1 - elapsed;

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
