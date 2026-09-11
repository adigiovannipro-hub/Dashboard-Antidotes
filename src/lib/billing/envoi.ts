import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import { refreshAccessToken, sendMessage } from "@/lib/recus/gmail";
import { decryptSecret, encryptSecret } from "@/lib/moderation/crypto";
import {
  downloadInvoicePdf,
  createBillingCustomer,
  createProduct,
  findBillingCustomerByName,
  emitInvoice,
  getInvoice,
  getInvoiceProductId,
  getInvoiceTemplate,
  type EmittedInvoice,
} from "@/lib/finance/airwallex-emission";
import { formatMoney } from "@/lib/finance/money";
import { longDayLabel, monthLabel, monthOnlyLabel } from "./format";
import { buildInvoiceMime } from "./mime";
import { splitAroundAttachment } from "./signature";
import { decideEnvoi, REFUSAL_LABELS, type SentEmail } from "./relances";
import {
  DEFAULT_REMINDER_1_TEMPLATE,
  DEFAULT_REMINDER_2_TEMPLATE,
  DEFAULT_REMINDER_3_TEMPLATE,
  DEFAULT_REMINDER_1_SUBJECT,
  DEFAULT_REMINDER_2_SUBJECT,
  DEFAULT_REMINDER_3_SUBJECT,
  DEFAULT_SEND_SUBJECT,
  DEFAULT_SEND_TEMPLATE,
  renderEmail,
} from "./templates";
import type { BillingEmailKind } from "./types";

/**
 * Le passage qui émet les factures et relance les impayées.
 *
 * Il tourne sur un runner GitHub, jamais sur l'hébergeur : Airwallex refuse
 * les adresses IP de Vercel, et c'est déjà pour cette raison que toute la
 * synchronisation Finance vit là-bas. Il est aussi **absent du déclenchement
 * depuis l'écran** — ouvrir une page ne doit pas envoyer de mail à un client.
 * Seul le passage horaire le lance.
 *
 * L'interrupteur du dispositif n'est pas une variable d'environnement : c'est
 * l'adresse du destinataire sur le devis. Sans elle, la mensualité reste à
 * facturer à la main, exactement comme avant. Remplir l'adresse, c'est
 * consentir à l'automatisme pour ce client-là ; l'effacer, c'est le reprendre.
 *
 * Trois choses le rendent rejouable sans dégât :
 *
 *   • la contrainte `unique (installment_id, kind)` du journal — un type de
 *     mail ne part qu'une fois par mensualité, et c'est la base qui le tient,
 *     pas une condition dans ce fichier ;
 *   • `airwallex_invoice_id`, posé dès la création — le passage suivant
 *     enverra la facture existante au lieu d'en créer une deuxième ;
 *   • `request_id` stable côté Airwallex, qui rattrape le cas où même cette
 *     colonne aurait été perdue.
 */

/** La copie cachée, sur toute facture et toute relance. Constante et non
    configurable : c'est l'archive de l'expéditeur, elle ne s'oublie pas. */
export const ARCHIVE_BCC = "a.digiovanni.pro@gmail.com";

/**
 * Au-delà, une mensualité n'est plus du courant mais de l'histoire.
 *
 * Sans cette borne, la mise en service enverrait d'un coup les factures de
 * tout l'arriéré — cent quarante mensualités remontant à 2024, dont certaines
 * n'ont jamais été marquées payées. Trois mois couvrent largement un retard
 * de passage ; ce qui est plus vieux se traite à la main, en connaissance de
 * cause.
 */
const MAX_AGE_DAYS = 92;

/** Plafond par passage. Un automate qui part en boucle envoie des mails à des
    clients : mieux vaut qu'il s'arrête et qu'on le voie au passage suivant. */
const MAX_EMAILS_PER_RUN = 12;

export type DispatchOutcome =
  | { kind: "sent"; installmentId: string; emailKind: BillingEmailKind; to: string }
  | { kind: "skipped"; installmentId: string; reason: string }
  | { kind: "failed"; installmentId: string; error: string };

export type DispatchReport = {
  examined: number;
  sent: number;
  skipped: number;
  failed: number;
  outcomes: DispatchOutcome[];
};

type EngagementRow = {
  id: string;
  client_name: string;
  label: string;
  recipient_email: string | null;
  cc_emails: string[] | null;
  contact_first_name: string | null;
  billing_name: string | null;
  billing_email: string | null;
  billing_street: string | null;
  billing_city: string | null;
  billing_postcode: string | null;
  billing_country: string | null;
  billing_tax_id: string | null;
  product_name: string | null;
  send_subject: string | null;
  send_template: string | null;
  reminder_1_subject: string | null;
  reminder_2_subject: string | null;
  reminder_3_subject: string | null;
  reminder_1_template: string | null;
  reminder_2_template: string | null;
  reminder_3_template: string | null;
  airwallex_customer_id: string | null;
  airwallex_product_id: string | null;
  template_invoice_external_id: string | null;
};

type InstallmentRow = {
  id: string;
  engagement_id: string;
  service_month: string;
  amount_cents: number;
  currency: string;
  vat_rate: number;
  issue_on: string;
  status: "pending" | "issued" | "paid" | "skipped";
  airwallex_invoice_id: string | null;
};

/** Les colonnes d'un devis telles que l'envoi les lit — une seule liste. */
const ENGAGEMENT_COLUMNS =
  "id, client_name, label, recipient_email, cc_emails, contact_first_name, billing_name, billing_email, billing_street, billing_city, billing_postcode, billing_country, billing_tax_id, product_name, send_subject, send_template, reminder_1_subject, reminder_2_subject, reminder_3_subject, reminder_1_template, reminder_2_template, reminder_3_template, airwallex_customer_id, airwallex_product_id, template_invoice_external_id";

const INSTALLMENT_COLUMNS =
  "id, engagement_id, service_month, amount_cents, currency, vat_rate, issue_on, status, airwallex_invoice_id";

type EmailRow = {
  installment_id: string;
  kind: BillingEmailKind;
  sent_at: string;
};

type SourceRow = {
  id: string;
  email_address: string;
  credentials_encrypted: string | null;
};

/** `AAAA-MM-JJ` en UTC, comme partout ailleurs dans le module. */
function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Le jeton Gmail de la boîte connectée aux Reçus.
 *
 * Une seule chaîne d'envoi pour tout le projet : la boîte qui transfère les
 * justificatifs à Airwallex est celle qui envoie les factures aux clients.
 * Elle porte déjà `gmail.send`, et l'adresse est la bonne — celle qui
 * apparaîtra en expéditeur, et à laquelle un client répondra.
 */
async function gmailAccessToken(
  orgId: string,
): Promise<{ accessToken: string; from: string } | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("receipt_sources")
    .select("id, email_address, credentials_encrypted")
    .eq("org_id", orgId)
    .eq("status", "connected")
    .limit(1);

  /* L'erreur se teste, pas seulement la donnée : une table absente rend un
     `data` nul, donc « aucune boîte connectée », donc un passage muet et
     rassurant. C'est exactement la panne qu'on ne veut pas. */
  if (error) throw new Error(`Lecture des boîtes connectées : ${error.message}`);

  const source = (data as unknown as SourceRow[] | null)?.[0];
  if (!source?.credentials_encrypted) return null;

  const refreshToken = decryptSecret(source.credentials_encrypted);
  const tokens = await refreshAccessToken(refreshToken);

  if (tokens.refreshToken && tokens.refreshToken !== refreshToken) {
    await admin
      .from("receipt_sources")
      .update({ credentials_encrypted: encryptSecret(tokens.refreshToken) } as never)
      .eq("id", source.id);
  }

  return { accessToken: tokens.accessToken, from: source.email_address };
}

/**
 * Le passage complet.
 *
 * `simulation` décide tout sans rien envoyer ni créer : c'est ce qu'on lance
 * la première fois, et à chaque fois qu'on touche à un modèle. Le rapport est
 * identique, à ceci près que rien n'est parti.
 */
export async function runInvoiceDispatch(options: {
  orgId: string;
  now?: Date;
  simulation?: boolean;
}): Promise<DispatchReport> {
  const now = options.now ?? new Date();
  const admin = createAdminClient();
  const outcomes: DispatchOutcome[] = [];

  /* Seuls les devis qui portent une adresse sont concernés : c'est
     l'interrupteur du dispositif, et il est volontairement là et pas
     ailleurs. */
  const { data: engagementData, error: engagementError } = await admin
    .from("billing_engagements")
    .select(ENGAGEMENT_COLUMNS)
    .eq("org_id", options.orgId)
    .not("recipient_email", "is", null)
    .limit(500);
  if (engagementError) {
    throw new Error(`Lecture des devis : ${engagementError.message}`);
  }

  const engagements = new Map(
    ((engagementData ?? []) as unknown as EngagementRow[]).map((row) => [row.id, row]),
  );
  if (engagements.size === 0) {
    return { examined: 0, sent: 0, skipped: 0, failed: 0, outcomes };
  }

  const floor = new Date(now);
  floor.setUTCDate(floor.getUTCDate() - MAX_AGE_DAYS);

  const { data: installmentData, error: installmentError } = await admin
    .from("billing_installments")
    .select(INSTALLMENT_COLUMNS)
    .eq("org_id", options.orgId)
    .in("engagement_id", [...engagements.keys()])
    .in("status", ["pending", "issued"])
    .lte("issue_on", isoDay(now))
    .gte("issue_on", isoDay(floor))
    .order("issue_on")
    .limit(200);
  if (installmentError) {
    throw new Error(`Lecture des mensualités : ${installmentError.message}`);
  }

  const installments = (installmentData ?? []) as unknown as InstallmentRow[];
  if (installments.length === 0) {
    return { examined: 0, sent: 0, skipped: 0, failed: 0, outcomes };
  }

  const { data: emailData, error: emailError } = await admin
    .from("billing_invoice_emails")
    .select("installment_id, kind, sent_at")
    .eq("org_id", options.orgId)
    .in(
      "installment_id",
      installments.map((line) => line.id),
    )
    .limit(2000);
  if (emailError) throw new Error(`Lecture du journal : ${emailError.message}`);

  const sentByInstallment = new Map<string, SentEmail[]>();
  for (const row of (emailData ?? []) as unknown as EmailRow[]) {
    const list = sentByInstallment.get(row.installment_id) ?? [];
    list.push({ kind: row.kind, sent_at: row.sent_at });
    sentByInstallment.set(row.installment_id, list);
  }

  /* Le jeton n'est demandé qu'une fois, et seulement s'il y a du travail :
     rafraîchir un jeton OAuth pour ne rien envoyer serait un appel de plus
     chez Google à chaque heure de la journée. */
  let mailbox: { accessToken: string; from: string } | null = null;

  let sent = 0;
  for (const line of installments) {
    const engagement = engagements.get(line.engagement_id);
    if (!engagement?.recipient_email) continue;

    const decision = decideEnvoi({
      status: line.status,
      issue_on: line.issue_on,
      airwallex_invoice_id: line.airwallex_invoice_id,
      recipient_email: engagement.recipient_email,
      sent: sentByInstallment.get(line.id) ?? [],
      now,
    });

    if (decision.action === "rien") {
      outcomes.push({
        kind: "skipped",
        installmentId: line.id,
        reason: REFUSAL_LABELS[decision.reason],
      });
      continue;
    }

    if (sent >= MAX_EMAILS_PER_RUN) {
      outcomes.push({
        kind: "skipped",
        installmentId: line.id,
        reason: `Plafond de ${MAX_EMAILS_PER_RUN} envois par passage atteint : la suite au prochain.`,
      });
      continue;
    }

    if (options.simulation) {
      outcomes.push({
        kind: "sent",
        installmentId: line.id,
        emailKind: decision.kind,
        to: engagement.recipient_email,
      });
      sent += 1;
      continue;
    }

    try {
      if (!mailbox) {
        mailbox = await gmailAccessToken(options.orgId);
        if (!mailbox) {
          throw new Error(
            "Aucune boîte Gmail connectée : brancher la boîte dans Reçus avant d'envoyer des factures.",
          );
        }
      }

      const invoice =
        decision.action === "emettre"
          ? await emitFor(line, engagement)
          : await resolveInvoice(line, engagement);

      await sendInvoiceEmail({
        orgId: options.orgId,
        line,
        engagement,
        invoice,
        kind: decision.kind,
        mailbox,
      });

      outcomes.push({
        kind: "sent",
        installmentId: line.id,
        emailKind: decision.kind,
        to: engagement.recipient_email,
      });
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      /* L'erreur se pose sur la ligne : l'écran la montrera, plutôt que de
         laisser une facture ne pas partir dans le silence. */
      await admin
        .from("billing_installments")
        .update({ last_send_error: message.slice(0, 500) } as never)
        .eq("id", line.id);
      outcomes.push({ kind: "failed", installmentId: line.id, error: message });
    }
  }

  return {
    examined: installments.length,
    sent: outcomes.filter((outcome) => outcome.kind === "sent").length,
    skipped: outcomes.filter((outcome) => outcome.kind === "skipped").length,
    failed: outcomes.filter((outcome) => outcome.kind === "failed").length,
    outcomes,
  };
}

/**
 * La facture d'une mensualité déjà émise.
 *
 * Relue à chaque envoi et non mise en cache : c'est le `pdf_url` qu'on vient
 * chercher, et il expire au bout de trente-cinq jours — soit avant la
 * deuxième relance.
 */
async function resolveInvoice(
  line: InstallmentRow,
  engagement: EngagementRow,
): Promise<EmittedInvoice> {
  if (!line.airwallex_invoice_id) {
    throw new Error(
      `La mensualité ${line.service_month} de ${engagement.client_name} n'a pas de facture Airwallex rattachée.`,
    );
  }
  const invoice = await getInvoice(line.airwallex_invoice_id);
  if (!invoice) {
    throw new Error(
      `La facture ${line.airwallex_invoice_id} est introuvable chez Airwallex.`,
    );
  }
  return invoice;
}

/**
 * Crée la facture du mois, à l'image de la précédente.
 *
 * Le modèle est la facture créée à la main la première fois. Ce qu'on en
 * apprend — client de facturation, produit — est mémorisé sur le devis au
 * passage : la deuxième émission ne relit plus rien.
 */
async function emitFor(
  line: InstallmentRow,
  engagement: EngagementRow,
): Promise<EmittedInvoice> {
  /* Une facture modèle, s'il y en a une : elle ne sert plus qu'à reprendre
     des réglages de forme. Le dashboard sait faire sans. */
  const templateId = engagement.template_invoice_external_id;
  const template = templateId ? await getInvoiceTemplate(templateId) : null;

  /* Le client de facturation : celui du devis, sinon celui du modèle, sinon
     on le crée. C'est la première émission qui l'inscrit chez Airwallex, à
     partir de ce qui a été saisi sur la fiche. */
  let customerId =
    engagement.airwallex_customer_id ?? template?.billing_customer_id ?? null;
  if (!customerId) {
    const billingName = engagement.billing_name?.trim() || engagement.client_name;

    /* Chercher avant de créer : le compte porte déjà les clients des factures
       émises à la main, et une seconde fiche du même nom ouvrirait une
       nouvelle série de numéros. */
    customerId = await findBillingCustomerByName(billingName);
  }
  if (!customerId) {
    const billingName = engagement.billing_name?.trim() || engagement.client_name;
    customerId = await createBillingCustomer(
      {
        name: billingName,
        email: engagement.billing_email ?? engagement.recipient_email,
        street: engagement.billing_street,
        city: engagement.billing_city,
        postcode: engagement.billing_postcode,
        country: engagement.billing_country ?? "FR",
        taxId: engagement.billing_tax_id,
      },
      `antidotes-client-${engagement.id}`,
    );
  }

  /* Le produit : celui du devis, sinon celui lu sur le modèle, sinon créé
     depuis le libellé de la prestation. */
  let productId = engagement.airwallex_product_id ?? null;
  if (!productId && templateId) {
    productId = await getInvoiceProductId(templateId);
  }
  if (!productId) {
    productId = await createProduct(
      engagement.product_name?.trim() || engagement.label,
      `antidotes-produit-${engagement.id}`,
    );
  }

  const invoice = await emitInvoice({
    billingCustomerId: customerId,
    productId,
    amountCents: line.amount_cents,
    currency: line.currency || "EUR",
    /* Stable pour cette mensualité : c'est ce qui empêche Airwallex de créer
       deux factures si le passage est rejoué après un plantage réseau. */
    requestId: `antidotes-${line.id}`,
    description: `${engagement.product_name?.trim() || engagement.label} — ${monthLabel(line.service_month)}`,
    template,
  });


  const admin = createAdminClient();
  await admin
    .from("billing_installments")
    .update({
      airwallex_invoice_id: invoice.external_id,
      status: "issued",
      issued_at: new Date().toISOString(),
      last_send_error: null,
    } as never)
    .eq("id", line.id);

  /* Ce qu'on vient d'apprendre du modèle, pour ne plus le relire. */
  if (!engagement.airwallex_customer_id || !engagement.airwallex_product_id) {
    await admin
      .from("billing_engagements")
      .update({
        airwallex_customer_id: customerId,
        airwallex_product_id: productId,
      } as never)
      .eq("id", engagement.id);
  }

  return invoice;
}

/** Écrit le mail, l'envoie, et le journalise — dans cet ordre. */
async function sendInvoiceEmail(options: {
  orgId: string;
  line: InstallmentRow;
  engagement: EngagementRow;
  invoice: EmittedInvoice;
  kind: BillingEmailKind;
  mailbox: { accessToken: string; from: string };
  /** Ajouté tel quel en fin d'objet : un renvoi se dit dans l'objet. */
  subjectSuffix?: string;
  /**
   * Où poser la trace. Une ligne nouvelle par défaut ; un renvoi met à jour
   * celle du premier envoi — le journal est unique par (mensualité, type),
   * et c'est cette contrainte qui empêche un passage rejoué de doubler un
   * mail. Elle vaut aussi pour un renvoi voulu.
   */
  journal?: { mode: "insert" } | { mode: "update"; emailId: string } | { mode: "none" };
  /**
   * À qui envoyer, à la place du client : un test vers sa propre boîte, avec
   * la vraie facture et la vraie chaîne. Sans copie, et sans journal — un
   * test ne compte pas comme reçu par le client.
   */
  recipient?: { to: string; cc: string[] };
}): Promise<{ messageId: string; subject: string }> {
  const { engagement, invoice, line } = options;

  /* Chaque relance a son texte : la deuxième n'est pas la première répétée.
     L'objet, lui, ne change pas — c'est ce qui garde les relances dans le fil
     de la facture d'origine chez le client. */
  const bodyByKind: Record<BillingEmailKind, string> = {
    invoice: engagement.send_template ?? DEFAULT_SEND_TEMPLATE,
    reminder_1: engagement.reminder_1_template ?? DEFAULT_REMINDER_1_TEMPLATE,
    reminder_2: engagement.reminder_2_template ?? DEFAULT_REMINDER_2_TEMPLATE,
    reminder_3: engagement.reminder_3_template ?? DEFAULT_REMINDER_3_TEMPLATE,
  };

  /* Chaque mail a aussi son objet : « facture du mois d'août » pour l'envoi,
     « relance de la facture… », puis « seconde », puis « troisième ». Une
     boîte de réception encombrée doit les distinguer sans les ouvrir. */
  const subjectByKind: Record<BillingEmailKind, string> = {
    invoice: engagement.send_subject ?? DEFAULT_SEND_SUBJECT,
    reminder_1: engagement.reminder_1_subject ?? DEFAULT_REMINDER_1_SUBJECT,
    reminder_2: engagement.reminder_2_subject ?? DEFAULT_REMINDER_2_SUBJECT,
    reminder_3: engagement.reminder_3_subject ?? DEFAULT_REMINDER_3_SUBJECT,
  };

  const subjectTemplate = subjectByKind[options.kind];
  const bodyTemplate = bodyByKind[options.kind];

  const rendered = renderEmail(subjectTemplate, bodyTemplate, {
    firstName: engagement.contact_first_name,
    clientName: engagement.client_name,
    projectLabel: engagement.label,
    month: monthOnlyLabel(line.service_month),
    period: monthLabel(line.service_month),
    /* Le montant de la facture émise, et non celui de la mensualité : c'est
       le document qui fait foi, TVA comprise s'il y en a une. */
    amount: formatMoney(invoice.amount_cents, invoice.currency),
    invoiceNumber: invoice.number,
    dueDate: invoice.due_on ? longDayLabel(invoice.due_on) : "réception",
  });

  if (!rendered.ok) {
    throw new Error(
      `Le modèle porte des variables inconnues : ${rendered.unknownVariables.join(", ")}. Rien n'est parti.`,
    );
  }

  const pdf = invoice.pdf_url ? await downloadInvoicePdf(invoice.pdf_url) : null;
  if (!pdf) {
    throw new Error(
      `La facture ${invoice.number} n'expose pas de PDF : rien n'a été envoyé.`,
    );
  }

  const parts = splitAroundAttachment(rendered.body);
  const to = options.recipient?.to ?? engagement.recipient_email!;
  const cc = options.recipient?.cc ?? engagement.cc_emails ?? [];
  const subject = `${rendered.subject}${options.subjectSuffix ?? ""}`;

  const messageId = await sendMessage({
    accessToken: options.mailbox.accessToken,
    mime: buildInvoiceMime({
      from: options.mailbox.from,
      to,
      cc,
      bcc: ARCHIVE_BCC,
      subject,
      /* Le message s'arrête à « À dispo, », la facture suit, la carte de
         signature ferme : l'ordre d'un mail écrit à la main. */
      body: parts.before.text,
      bodyHtml: parts.before.html,
      attachment: {
        filename: `${invoice.number || "facture"}.pdf`,
        content: pdf,
      },
      signature: parts.after,
    }),
  });

  const journal = options.journal ?? { mode: "insert" };
  if (journal.mode === "none") return { messageId, subject };

  const admin = createAdminClient();
  const { error } =
    journal.mode === "insert"
      ? await admin.from("billing_invoice_emails").insert({
          org_id: options.orgId,
          installment_id: line.id,
          kind: options.kind,
          to_email: to,
          cc_emails: cc,
          bcc_email: ARCHIVE_BCC,
          subject,
          body: rendered.body,
          invoice_external_id: invoice.external_id,
          gmail_message_id: messageId,
        } as never)
      : /* La date d'envoi suit : le client a reçu la facture aujourd'hui, et
           c'est d'aujourd'hui que se comptent les relances. */
        await admin
          .from("billing_invoice_emails")
          .update({
            subject,
            invoice_external_id: invoice.external_id,
            gmail_message_id: messageId,
            sent_at: new Date().toISOString(),
          } as never)
          .eq("id", journal.emailId);

  /* Le mail est parti : si le journal refuse la ligne, il faut le savoir
     bruyamment. Une relance non journalisée repartirait à l'identique au
     passage suivant, et le client recevrait deux fois le même mail. */
  if (error) {
    throw new Error(
      `Mail envoyé (${messageId}) mais journal refusé — risque de doublon au prochain passage : ${error.message}`,
    );
  }

  await admin
    .from("billing_installments")
    .update({ last_send_error: null } as never)
    .eq("id", line.id);

  return { messageId, subject };
}

type JournalRow = {
  id: string;
  installment_id: string;
  to_email: string;
  subject: string;
  sent_at: string;
};

export type ResendOutcome =
  | { kind: "sent"; installmentId: string; to: string; subject: string }
  | { kind: "failed"; installmentId: string; error: string };

/**
 * Renvoie les derniers envois de factures, tels quels, l'objet complété.
 *
 * Pour le jour où un défaut d'affichage a touché ce qui est parti : le même
 * modèle, la même facture relue chez Airwallex (son `pdf_url` a expiré
 * depuis), le même destinataire — et une mention en fin d'objet qui dit au
 * client pourquoi il reçoit deux fois la même chose. Les relances ne sont pas
 * concernées : on ne renvoie que ce qui a un document à montrer.
 *
 * La ligne du journal est mise à jour, jamais doublée. Les envois repartent
 * dans l'ordre où ils étaient partis.
 */
export async function resendRecentInvoices(options: {
  orgId: string;
  count: number;
  subjectSuffix: string;
  simulation?: boolean;
  /** Tout part vers cette adresse, sans copie ni journal : un test. */
  testRecipient?: string;
}): Promise<ResendOutcome[]> {
  const count = Math.min(Math.max(options.count, 0), MAX_EMAILS_PER_RUN);
  if (count === 0) return [];

  const admin = createAdminClient();
  const outcomes: ResendOutcome[] = [];

  const { data: emailData, error: emailError } = await admin
    .from("billing_invoice_emails")
    .select("id, installment_id, to_email, subject, sent_at")
    .eq("org_id", options.orgId)
    .eq("kind", "invoice")
    .order("sent_at", { ascending: false })
    .limit(count);
  if (emailError) throw new Error(`Lecture du journal : ${emailError.message}`);

  const emails = ((emailData ?? []) as unknown as JournalRow[]).reverse();
  if (emails.length === 0) return outcomes;

  const { data: installmentData, error: installmentError } = await admin
    .from("billing_installments")
    .select(INSTALLMENT_COLUMNS)
    .eq("org_id", options.orgId)
    .in(
      "id",
      emails.map((email) => email.installment_id),
    );
  if (installmentError) {
    throw new Error(`Lecture des mensualités : ${installmentError.message}`);
  }
  const installments = new Map(
    ((installmentData ?? []) as unknown as InstallmentRow[]).map((row) => [row.id, row]),
  );

  const { data: engagementData, error: engagementError } = await admin
    .from("billing_engagements")
    .select(ENGAGEMENT_COLUMNS)
    .eq("org_id", options.orgId)
    .in("id", [...new Set([...installments.values()].map((row) => row.engagement_id))]);
  if (engagementError) {
    throw new Error(`Lecture des devis : ${engagementError.message}`);
  }
  const engagements = new Map(
    ((engagementData ?? []) as unknown as EngagementRow[]).map((row) => [row.id, row]),
  );

  let mailbox: { accessToken: string; from: string } | null = null;

  for (const email of emails) {
    const line = installments.get(email.installment_id);
    const engagement = line ? engagements.get(line.engagement_id) : undefined;
    if (!line || !engagement?.recipient_email) {
      outcomes.push({
        kind: "failed",
        installmentId: email.installment_id,
        error: "Mensualité ou devis introuvable, ou devis sans adresse de destinataire.",
      });
      continue;
    }

    const to = options.testRecipient ?? engagement.recipient_email;

    if (options.simulation) {
      outcomes.push({
        kind: "sent",
        installmentId: line.id,
        to,
        subject: `${email.subject}${options.subjectSuffix}`,
      });
      continue;
    }

    try {
      if (!mailbox) {
        mailbox = await gmailAccessToken(options.orgId);
        if (!mailbox) {
          throw new Error(
            "Aucune boîte Gmail connectée : brancher la boîte dans Reçus avant d'envoyer des factures.",
          );
        }
      }

      const invoice = await resolveInvoice(line, engagement);
      const sent = await sendInvoiceEmail({
        orgId: options.orgId,
        line,
        engagement,
        invoice,
        kind: "invoice",
        mailbox,
        subjectSuffix: options.subjectSuffix,
        journal: options.testRecipient
          ? { mode: "none" }
          : { mode: "update", emailId: email.id },
        recipient: options.testRecipient
          ? { to: options.testRecipient, cc: [] }
          : undefined,
      });

      outcomes.push({ kind: "sent", installmentId: line.id, to, subject: sent.subject });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      /* Un test qui échoue n'est pas une facture en souffrance : la ligne du
         client ne porte pas l'erreur. */
      if (!options.testRecipient) {
        await admin
          .from("billing_installments")
          .update({ last_send_error: message.slice(0, 500) } as never)
          .eq("id", line.id);
      }
      outcomes.push({ kind: "failed", installmentId: line.id, error: message });
    }
  }

  return outcomes;
}
