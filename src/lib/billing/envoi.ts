import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import { refreshAccessToken, sendMessage } from "@/lib/recus/gmail";
import { decryptSecret, encryptSecret } from "@/lib/moderation/crypto";
import {
  downloadInvoicePdf,
  emitInvoiceFromTemplate,
  getInvoice,
  getInvoiceProductId,
  getInvoiceTemplate,
  type EmittedInvoice,
} from "@/lib/finance/airwallex-emission";
import { formatMoney } from "@/lib/finance/money";
import { longDayLabel, monthLabel, monthOnlyLabel } from "./format";
import { buildInvoiceMime } from "./mime";
import { bodyAsHtml } from "./signature";
import { decideEnvoi, REFUSAL_LABELS, type SentEmail } from "./relances";
import {
  DEFAULT_REMINDER_1_TEMPLATE,
  DEFAULT_REMINDER_2_TEMPLATE,
  DEFAULT_REMINDER_3_TEMPLATE,
  DEFAULT_REMINDER_SUBJECT,
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
  send_subject: string | null;
  send_template: string | null;
  reminder_subject: string | null;
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
    .select(
      "id, client_name, label, recipient_email, cc_emails, contact_first_name, send_subject, send_template, reminder_subject, reminder_1_template, reminder_2_template, reminder_3_template, airwallex_customer_id, airwallex_product_id, template_invoice_external_id",
    )
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
    .select(
      "id, engagement_id, service_month, amount_cents, currency, vat_rate, issue_on, status, airwallex_invoice_id",
    )
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
  const templateId = engagement.template_invoice_external_id;
  if (!templateId) {
    throw new Error(
      `Aucune facture modèle sur le devis « ${engagement.label} » : créer la première facture dans Airwallex, puis coller son identifiant sur le devis.`,
    );
  }

  const template = await getInvoiceTemplate(templateId);
  if (!template) {
    throw new Error(`La facture modèle ${templateId} est introuvable chez Airwallex.`);
  }

  /* Le client de facturation du modèle fait foi, celui mémorisé n'est qu'un
     repli — une facture dupliquée doit partir chez le même client que celle
     qu'on duplique. */
  const customerId = template.billing_customer_id ?? engagement.airwallex_customer_id;
  if (!customerId) {
    throw new Error(
      `La facture modèle ${templateId} ne porte aucun client de facturation.`,
    );
  }

  const productId =
    engagement.airwallex_product_id ?? (await getInvoiceProductId(templateId));
  if (!productId) {
    throw new Error(
      `Impossible de lire le produit facturé sur ${templateId} : le renseigner sur le devis.`,
    );
  }

  const invoice = await emitInvoiceFromTemplate({
    template: { ...template, billing_customer_id: customerId },
    productId,
    amountCents: line.amount_cents,
    /* Stable pour cette mensualité : c'est ce qui empêche Airwallex de créer
       deux factures si le passage est rejoué après un plantage réseau. */
    requestId: `antidotes-${line.id}`,
    description: `${engagement.label} — ${monthLabel(line.service_month)}`,
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
}): Promise<void> {
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

  const subjectTemplate =
    options.kind === "invoice"
      ? (engagement.send_subject ?? DEFAULT_SEND_SUBJECT)
      : (engagement.reminder_subject ?? DEFAULT_REMINDER_SUBJECT);
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

  const to = engagement.recipient_email!;
  const cc = engagement.cc_emails ?? [];

  const messageId = await sendMessage({
    accessToken: options.mailbox.accessToken,
    mime: buildInvoiceMime({
      from: options.mailbox.from,
      to,
      cc,
      bcc: ARCHIVE_BCC,
      subject: rendered.subject,
      body: rendered.body,
      bodyHtml: bodyAsHtml(rendered.body),
      attachment: {
        filename: `${invoice.number || "facture"}.pdf`,
        content: pdf,
      },
    }),
  });

  const admin = createAdminClient();
  const { error } = await admin.from("billing_invoice_emails").insert({
    org_id: options.orgId,
    installment_id: line.id,
    kind: options.kind,
    to_email: to,
    cc_emails: cc,
    bcc_email: ARCHIVE_BCC,
    subject: rendered.subject,
    body: rendered.body,
    invoice_external_id: invoice.external_id,
    gmail_message_id: messageId,
  } as never);

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
}
