import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import { decryptSecret, encryptSecret } from "@/lib/moderation/crypto";
import { getExpense, listExpenses } from "./airwallex";
import { evaluateAutoForward } from "./auto-forward";
import { extractReceipt } from "./extraction";
import {
  archiveMessage,
  canArchive,
  getAttachment,
  getMessage,
  htmlToText,
  listMessages,
  refreshAccessToken,
  sendMessage,
  type GmailMessage,
} from "./gmail";
import { formatAmount, senderDomain } from "./heuristics";
import { matchDocument, type MatchableExpense } from "./matching";
import { buildForwardMime } from "./mime";
import {
  MAX_ATTACHMENT_BYTES,
  pickInvoiceAttachment,
  receiptFilename,
  renderHtmlToPdf,
} from "./pdf";
import { renderTextToPdf } from "./text-pdf";
import {
  DEFAULT_SOURCE_SETTINGS,
  MAX_ATTACH_CHECKS,
  type MatchCandidate,
  type ReceiptDocument,
  type ReceiptSource,
} from "./types";

/**
 * La chaîne complète, du mail reçu à la pièce accrochée.
 *
 * Quatre étapes, volontairement séparées et rejouables indépendamment :
 *
 *   `syncExpenses`  — miroir des dépenses carte Airwallex ;
 *   `ingestSource`  — lecture de la boîte, classement, rapprochement ;
 *   `forwardDocument` — envoi vers la boîte de reçus d'Airwallex ;
 *   `verifyAttachments` — confirmation que la pièce s'est bien accrochée.
 *
 * Cette séparation n'est pas cosmétique. Chaque étape peut échouer pour ses
 * propres raisons — un quota Gmail, une panne Airwallex — et rejouer la chaîne
 * entière pour rattraper une seule étape ferait relire toute la boîte. Chacune
 * reprend là où elle en était, en lisant l'état stocké plutôt qu'en le
 * recalculant.
 *
 * Toutes les écritures passent par la clé de service : ces fonctions tournent
 * dans un cron, sans `auth.uid()`, donc hors de portée de la RLS.
 */

type Admin = ReturnType<typeof createAdminClient>;

async function logEvent(
  admin: Admin,
  entry: {
    orgId: string;
    documentId?: string | null;
    actorId?: string | null;
    action: string;
    before?: unknown;
    after?: unknown;
  },
): Promise<void> {
  await admin.from("receipt_events").insert({
    org_id: entry.orgId,
    document_id: entry.documentId ?? null,
    actor_id: entry.actorId ?? null,
    action: entry.action,
    before: (entry.before ?? null) as never,
    after: (entry.after ?? null) as never,
  });
}

// --- Jetons -----------------------------------------------------------------

/**
 * Jeton d'accès valide pour une boîte, rafraîchi si nécessaire.
 *
 * Google ne renvoie pas toujours un nouveau refresh token : on ne remplace le
 * refresh stocké que s'il en arrive un, faute de quoi on effacerait le seul
 * moyen de se reconnecter.
 */
async function accessTokenFor(admin: Admin, source: ReceiptSource): Promise<string> {
  if (!source.credentials_encrypted) {
    throw new Error(`La boîte ${source.email_address} n'est pas connectée.`);
  }

  const refreshToken = decryptSecret(source.credentials_encrypted);
  const tokens = await refreshAccessToken(refreshToken);

  if (tokens.refreshToken && tokens.refreshToken !== refreshToken) {
    await admin
      .from("receipt_sources")
      .update({ credentials_encrypted: encryptSecret(tokens.refreshToken) })
      .eq("id", source.id);
  }

  return tokens.accessToken;
}

// --- Dépenses Airwallex -----------------------------------------------------

export type SyncReport = { fetched: number; upserted: number };

/**
 * Rafraîchit le miroir local des dépenses carte.
 *
 * `fromDate` recule volontairement au-delà de la dernière synchronisation :
 * une transaction met parfois plusieurs jours à être comptabilisée, et une
 * fenêtre serrée laisserait passer les lignes rétroactives.
 */
export async function syncExpenses(
  orgId: string,
  options: { lookbackDays?: number } = {},
): Promise<SyncReport> {
  const admin = createAdminClient();
  const lookback = options.lookbackDays ?? 60;
  const fromDate = new Date(Date.now() - lookback * 24 * 60 * 60 * 1000);

  const expenses = await listExpenses({ fromDate });
  if (expenses.length === 0) return { fetched: 0, upserted: 0 };

  const rows = expenses.map((expense) => ({
    org_id: orgId,
    external_id: expense.external_id,
    merchant: expense.merchant,
    amount_cents: expense.amount_cents,
    currency: expense.currency,
    billing_amount_cents: expense.billing_amount_cents,
    billing_currency: expense.billing_currency,
    transaction_date: expense.transaction_date,
    posted_at: expense.posted_at,
    card_last_four: expense.card_last_four,
    cardholder_name: expense.cardholder_name,
    category: expense.category,
    expense_status: expense.expense_status,
    attachment_count: expense.attachment_count,
    raw: expense.raw as never,
    synced_at: new Date().toISOString(),
  }));

  const { error } = await admin
    .from("receipt_expenses")
    .upsert(rows as never, { onConflict: "org_id,external_id" });
  if (error) throw new Error(`Écriture des dépenses impossible : ${error.message}`);

  return { fetched: expenses.length, upserted: rows.length };
}

// --- Rapprochement ----------------------------------------------------------

async function candidateExpenses(
  admin: Admin,
  orgId: string,
  around: Date,
): Promise<MatchableExpense[]> {
  /* Fenêtre de vingt jours autour de la pièce : `matchDocument` disqualifie
     au-delà de quinze, la marge couvre les décalages de comptabilisation. */
  const WINDOW_DAYS = 20;
  const from = new Date(around.getTime() - WINDOW_DAYS * 86_400_000);
  const to = new Date(around.getTime() + WINDOW_DAYS * 86_400_000);

  const { data } = await admin
    .from("receipt_expenses")
    .select(
      "id, amount_cents, currency, billing_amount_cents, billing_currency, transaction_date, posted_at, merchant, attachment_count",
    )
    .eq("org_id", orgId)
    .gte("transaction_date", from.toISOString().slice(0, 10))
    .lte("transaction_date", to.toISOString().slice(0, 10));

  return (data ?? []) as unknown as MatchableExpense[];
}

/**
 * Re-rapprocher les pièces encore en attente contre le miroir rafraîchi.
 *
 * Deux raisons d'exister, toutes deux constatées : une dépense carte peut
 * arriver **après** le mail qui la justifie — Airwallex comptabilise avec des
 * jours de retard — et une correction du miroir (le montant local rétabli le
 * 7 août) doit profiter aux pièces déjà lues sans les faire relire au modèle.
 * Ne touche qu'aux pièces qui attendent une décision : une pièce validée,
 * transférée ou ignorée est de l'histoire.
 */
export async function rematchPendingDocuments(orgId: string): Promise<{
  examined: number;
  updated: number;
}> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("receipt_documents")
    .select("id, amount_cents, currency, document_date, received_at, merchant, expense_id, match_confidence")
    .eq("org_id", orgId)
    .eq("status", "awaiting_validation")
    .is("forwarded_at", null);
  if (error) throw new Error(`Lecture des pièces en attente : ${error.message}`);

  const documents = (data ?? []) as unknown as Pick<
    ReceiptDocument,
    | "id"
    | "amount_cents"
    | "currency"
    | "document_date"
    | "received_at"
    | "merchant"
    | "expense_id"
    | "match_confidence"
  >[];

  let updated = 0;
  for (const document of documents) {
    const around = new Date(document.document_date ?? document.received_at);
    const expenses = await candidateExpenses(admin, orgId, around);
    const match = matchDocument(
      {
        amount_cents: document.amount_cents,
        currency: document.currency,
        document_date: document.document_date,
        received_at: document.received_at,
        merchant: document.merchant,
      },
      expenses,
    );

    const nextExpenseId = match.best?.expense_id ?? null;
    const nextConfidence = match.best?.confidence ?? null;
    if (
      nextExpenseId === document.expense_id &&
      nextConfidence === document.match_confidence
    ) {
      continue; // Rien de neuf : ne pas réécrire pour réécrire.
    }

    const { error: updateError } = await admin
      .from("receipt_documents")
      .update({
        expense_id: nextExpenseId,
        match_confidence: nextConfidence,
        match_method: match.best?.method ?? "none",
        match_candidates: match.candidates as never,
      } as never)
      .eq("id", document.id);
    if (updateError) {
      throw new Error(`Re-rapprochement impossible : ${updateError.message}`);
    }
    updated += 1;
  }

  return { examined: documents.length, updated };
}

// --- Ingestion --------------------------------------------------------------

export type IngestReport = {
  examined: number;
  created: number;
  autoForwarded: number;
  awaitingValidation: number;
  errors: string[];
};

/**
 * Requête Gmail de la fenêtre à relire.
 *
 * On repart de la dernière lecture réussie, en reculant d'un jour. Ce
 * chevauchement fait relire quelques messages déjà connus — l'unicité sur
 * l'identifiant Gmail les écarte sans frais — et couvre les mails arrivés
 * pendant le passage précédent.
 */
export function buildGmailQuery(source: {
  last_polled_at: string | null;
  settings: { lookback_days: number };
}): string {
  const since = source.last_polled_at
    ? new Date(new Date(source.last_polled_at).getTime() - 86_400_000)
    : new Date(Date.now() - source.settings.lookback_days * 86_400_000);

  const stamp = `${since.getFullYear()}/${since.getMonth() + 1}/${since.getDate()}`;

  /* `-in:chats` et `-from:me` retirent deux catégories qui ne contiennent
     jamais de justificatif et gonflent inutilement la liste. */
  return `after:${stamp} -in:chats -from:me`;
}

export async function ingestSource(sourceId: string): Promise<IngestReport> {
  const admin = createAdminClient();
  const report: IngestReport = {
    examined: 0,
    created: 0,
    autoForwarded: 0,
    awaitingValidation: 0,
    errors: [],
  };

  const { data: sourceRow } = await admin
    .from("receipt_sources")
    .select("*")
    .eq("id", sourceId)
    .single();
  if (!sourceRow) throw new Error("Boîte introuvable.");

  const source = sourceRow as unknown as ReceiptSource;
  const settings = { ...DEFAULT_SOURCE_SETTINGS, ...source.settings };

  let accessToken: string;
  try {
    accessToken = await accessTokenFor(admin, source);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connexion impossible.";
    await admin
      .from("receipt_sources")
      .update({ status: "error", last_error: message })
      .eq("id", source.id);
    throw error;
  }

  const refs = await listMessages({
    accessToken,
    query: buildGmailQuery({ ...source, settings }),
    maxResults: 200,
  });

  // Les messages déjà connus sont écartés avant tout téléchargement : c'est ce
  // qui rend le chevauchement de fenêtre gratuit.
  const { data: known } = await admin
    .from("receipt_documents")
    .select("external_message_id")
    .eq("source_id", source.id)
    .in("external_message_id", refs.map((ref) => ref.id));

  const seen = new Set(
    ((known ?? []) as { external_message_id: string }[]).map(
      (row) => row.external_message_id,
    ),
  );

  const fresh = refs.filter((ref) => !seen.has(ref.id));

  for (const ref of fresh) {
    report.examined += 1;
    try {
      const outcome = await ingestMessage({
        admin,
        source,
        settings,
        accessToken,
        messageId: ref.id,
      });
      if (outcome === "created") report.created += 1;
      if (outcome === "auto_forwarded") {
        report.created += 1;
        report.autoForwarded += 1;
      }
      if (outcome === "awaiting") {
        report.created += 1;
        report.awaitingValidation += 1;
      }
    } catch (error) {
      // Un mail illisible ne doit pas interrompre la lecture des suivants.
      report.errors.push(
        `${ref.id} : ${error instanceof Error ? error.message : "erreur inconnue"}`,
      );
    }
  }

  await admin
    .from("receipt_sources")
    .update({
      last_polled_at: new Date().toISOString(),
      status: "connected",
      last_error: report.errors.length > 0 ? report.errors[0] : null,
    })
    .eq("id", source.id);

  return report;
}

type IngestOutcome = "skipped" | "created" | "awaiting" | "auto_forwarded";

async function ingestMessage(context: {
  admin: Admin;
  source: ReceiptSource;
  settings: typeof DEFAULT_SOURCE_SETTINGS;
  accessToken: string;
  messageId: string;
}): Promise<IngestOutcome> {
  const { admin, source, settings, accessToken, messageId } = context;

  const message = await getMessage(accessToken, messageId);
  const domain = senderDomain(message.fromEmail);

  const extraction = await extractReceipt({
    subject: message.subject,
    from_email: message.fromEmail,
    from_name: message.fromName,
    received_at: message.receivedAt,
    snippet: message.snippet,
    text: message.text,
    attachmentNames: message.attachments.map((attachment) => attachment.filename),
  });

  // Écarté par le tri : aucune ligne créée, aucun coût. Le mail sera réexaminé
  // au prochain chevauchement de fenêtre, ce qui ne coûte rien non plus.
  if (!extraction) return "skipped";

  const documentDate = extraction.document_date;
  const around = documentDate ? new Date(documentDate) : message.receivedAt;

  const expenses = await candidateExpenses(admin, source.org_id, around);
  const match = matchDocument(
    {
      amount_cents: extraction.amount_cents,
      currency: extraction.currency,
      document_date: documentDate,
      received_at: message.receivedAt.toISOString(),
      merchant: extraction.merchant,
    },
    expenses,
  );

  const accountable = extraction.kind !== "other";

  const { data: inserted, error } = await admin
    .from("receipt_documents")
    .insert({
      org_id: source.org_id,
      source_id: source.id,
      external_message_id: message.id,
      external_thread_id: message.threadId,
      received_at: message.receivedAt.toISOString(),
      from_email: message.fromEmail,
      from_name: message.fromName,
      subject: message.subject,
      snippet: message.snippet,
      kind: extraction.kind,
      classification_confidence: extraction.confidence,
      classification_reason: extraction.reason,
      classified_by: extraction.source,
      merchant: extraction.merchant,
      amount_cents: extraction.amount_cents,
      currency: extraction.currency,
      document_date: documentDate,
      invoice_number: extraction.invoice_number,
      tax_cents: extraction.tax_cents,
      // Une pièce sans valeur comptable est enregistrée « ignorée » plutôt que
      // laissée de côté : c'est ce qui évite de la faire relire au modèle à
      // chaque passage du cron.
      status: accountable ? "awaiting_validation" : "ignored",
      expense_id: match.best?.expense_id ?? null,
      match_confidence: match.best?.confidence ?? null,
      match_method: match.best?.method ?? "none",
      match_candidates: match.candidates as never,
    } as never)
    .select("*")
    .single();

  if (error || !inserted) {
    throw new Error(`Enregistrement impossible : ${error?.message ?? "inconnu"}`);
  }

  const document = inserted as unknown as ReceiptDocument;

  await logEvent(admin, {
    orgId: source.org_id,
    documentId: document.id,
    action: accountable ? "document.detected" : "document.dismissed",
    after: {
      kind: extraction.kind,
      confidence: extraction.confidence,
      reason: extraction.reason,
      matched: match.best?.expense_id ?? null,
      ambiguous: match.ambiguous,
    },
  });

  if (!accountable) return "created";

  /* Le rendu fidèle se fait ici, et pas au transfert : c'est ici qu'on a le
     HTML du mail en main **et** un navigateur — la validation, elle, part de
     l'hébergeur, qui n'en a pas. Meilleur effort : sans navigateur, le
     transfert retombera sur le PDF de texte. */
  await storeRenderedPdf(admin, document.id, source.org_id, message.html);

  // Le fournisseur est vu : la règle est créée dès maintenant, à zéro
  // validation, pour que l'écran puisse compter les approbations à venir.
  await touchMerchantRule(admin, source.org_id, domain, extraction.merchant);

  const { data: ruleRow } = await admin
    .from("receipt_merchant_rules")
    .select("auto_forward")
    .eq("org_id", source.org_id)
    .eq("sender_domain", domain)
    .maybeSingle();

  /* Le débit réel de la dépense rapprochée : c'est lui, en euros, que le
     plafond compare — le montant de la pièce est dans la devise du
     commerçant, et 154 400 IDR n'est pas 154 400 €. */
  const matched = expenses.find(
    (expense) => expense.id === match.best?.expense_id,
  );
  const billedEurCents =
    matched?.billing_currency?.toUpperCase() === "EUR"
      ? matched.billing_amount_cents
      : null;

  const decision = evaluateAutoForward({
    settings: settings.auto_forward,
    document: {
      kind: extraction.kind,
      classification_confidence: extraction.confidence,
      amount_cents: extraction.amount_cents,
      currency: extraction.currency,
      status: "awaiting_validation",
    },
    billedEurCents,
    match,
    rule: (ruleRow as { auto_forward: boolean } | null) ?? null,
    senderDomain: domain,
    ignoredSenders: settings.ignored_senders,
    autoForwardedLastHour: await countAutoForwardedLastHour(admin, source.org_id),
  });

  if (!decision.allowed) {
    await logEvent(admin, {
      orgId: source.org_id,
      documentId: document.id,
      action: "auto_forward.declined",
      after: { refusals: decision.refusals },
    });
    return "awaiting";
  }

  await forwardDocument({ documentId: document.id, actorId: null, auto: true });
  return "auto_forwarded";
}

/** Le bucket privé où dort le mail rendu, entre sa lecture et son transfert. */
const RENDERED_BUCKET = "receipt-pdfs";

/**
 * Rend le mail en PDF fidèle et le range, si un navigateur répond.
 *
 * Silencieux en cas d'échec, et c'est voulu : perdre la mise en page est une
 * dégradation, perdre le justificatif serait une panne.
 */
async function storeRenderedPdf(
  admin: Admin,
  documentId: string,
  orgId: string,
  html: string | null,
): Promise<void> {
  if (!html) return;

  try {
    const pdf = await renderHtmlToPdf(html);
    if (!pdf || pdf.length > MAX_ATTACHMENT_BYTES) return;

    const path = `${orgId}/${documentId}.pdf`;
    const { error } = await admin.storage
      .from(RENDERED_BUCKET)
      .upload(path, pdf, { contentType: "application/pdf", upsert: true });
    if (error) return;

    await admin
      .from("receipt_documents")
      .update({ pdf_storage_path: path })
      .eq("id", documentId);
  } catch {
    // Rendu ou stockage en échec : le transfert utilisera le PDF de texte.
  }
}

async function touchMerchantRule(
  admin: Admin,
  orgId: string,
  domain: string,
  merchant: string | null,
): Promise<void> {
  await admin.from("receipt_merchant_rules").upsert(
    {
      org_id: orgId,
      sender_domain: domain,
      merchant,
      last_seen_at: new Date().toISOString(),
    } as never,
    { onConflict: "org_id,sender_domain", ignoreDuplicates: false },
  );
}

async function countAutoForwardedLastHour(admin: Admin, orgId: string): Promise<number> {
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await admin
    .from("receipt_documents")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("auto_decided", true)
    .gte("forwarded_at", since);
  return count ?? 0;
}

// --- Transfert --------------------------------------------------------------

export type ForwardResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

/**
 * Envoie la pièce à la boîte de reçus d'Airwallex.
 *
 * Le mail part **depuis l'adresse connectée**, ce qui n'est pas un détail :
 * Airwallex rejette un reçu venu d'une adresse qui n'est pas rattachée au
 * compte. C'est la raison pour laquelle le module passe par l'API Gmail plutôt
 * que par un relais SMTP quelconque.
 */
/**
 * Sort de la boîte de réception le mail d'une pièce partie, et le note.
 *
 * Jamais bloquant : un rangement raté ne doit pas faire passer pour échoué un
 * transfert qui, lui, a réussi — la pièce repartirait une seconde fois. Le
 * mail reste alors en boîte, et le rattrapage horaire le reprendra.
 *
 * Le refus de Gmail se dit à voix haute plutôt que de se deviner. La version
 * précédente lisait `granted_scopes` et ne tentait rien quand le droit
 * d'écriture manquait : un silence de plus, exactement ce qu'on cherche à
 * supprimer partout ailleurs dans ce module.
 */
async function archiveForwardedMail(
  admin: ReturnType<typeof createAdminClient>,
  options: {
    accessToken: string;
    source: ReceiptSource;
    documentId: string;
    messageId: string;
  },
): Promise<boolean> {
  try {
    await archiveMessage({
      accessToken: options.accessToken,
      messageId: options.messageId,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "erreur inconnue";
    console.error(
      canArchive(options.source.granted_scopes)
        ? `Rangement Gmail refusé pour ${options.documentId} : ${reason}`
        : `Rangement Gmail impossible pour ${options.documentId} : la boîte ${options.source.email_address} a été connectée avant l'ajout du droit d'écriture. La reconnecter depuis Finance pour que les mails se rangent. (${reason})`,
    );
    return false;
  }

  await admin
    .from("receipt_documents")
    .update({ gmail_archived_at: new Date().toISOString() })
    .eq("id", options.documentId);

  return true;
}

/**
 * Range les mails des pièces parties avant que le droit d'écriture existe.
 *
 * Sans ce rattrapage, tout ce qui a été transféré jusqu'ici resterait en boîte
 * pour toujours : le rangement n'a lieu qu'au moment du transfert, et un
 * transfert ne se rejoue pas. Passage horaire, borné à trente jours — au-delà,
 * le mail a de toute façon été rangé à la main.
 */
export async function archivePendingMails(sourceId: string): Promise<{
  examined: number;
  archived: number;
}> {
  const admin = createAdminClient();

  const { data: sourceRow } = await admin
    .from("receipt_sources")
    .select("*")
    .eq("id", sourceId)
    .single();
  if (!sourceRow) throw new Error("Boîte introuvable.");
  const source = sourceRow as unknown as ReceiptSource;

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await admin
    .from("receipt_documents")
    .select("id, external_message_id")
    .eq("source_id", sourceId)
    .not("forwarded_at", "is", null)
    .is("gmail_archived_at", null)
    .gte("forwarded_at", since)
    .limit(50);
  if (error) throw new Error(`Lecture des pièces à ranger : ${error.message}`);

  const pending = (data ?? []) as unknown as {
    id: string;
    external_message_id: string;
  }[];
  if (pending.length === 0) return { examined: 0, archived: 0 };

  const accessToken = await accessTokenFor(admin, source);

  let archived = 0;
  for (const document of pending) {
    const done = await archiveForwardedMail(admin, {
      accessToken,
      source,
      documentId: document.id,
      messageId: document.external_message_id,
    });
    if (done) archived += 1;
    /* Un refus vaut pour toute la boîte — droit manquant, jeton révoqué. En
       insister cinquante fois ne ferait que cinquante lignes de log. */
    if (!done) break;
  }

  return { examined: pending.length, archived };
}

export async function forwardDocument(options: {
  documentId: string;
  actorId: string | null;
  auto: boolean;
}): Promise<ForwardResult> {
  const admin = createAdminClient();

  const { data: documentRow } = await admin
    .from("receipt_documents")
    .select("*")
    .eq("id", options.documentId)
    .single();
  if (!documentRow) return { ok: false, error: "Pièce introuvable." };

  const document = documentRow as unknown as ReceiptDocument;

  /* Garde-fou contre le double envoi. La contrainte d'unicité empêche deux
     lignes pour un même mail, mais rien n'empêcherait deux clics sur le même
     bouton de partir deux fois. */
  if (document.forwarded_at) {
    return { ok: false, error: "Cette pièce a déjà été transférée." };
  }

  const { data: sourceRow } = await admin
    .from("receipt_sources")
    .select("*")
    .eq("id", document.source_id)
    .single();
  if (!sourceRow) return { ok: false, error: "Boîte introuvable." };
  const source = sourceRow as unknown as ReceiptSource;

  await admin
    .from("receipt_documents")
    .update({ status: "queued" })
    .eq("id", document.id);

  try {
    const accessToken = await accessTokenFor(admin, source);
    const message = await getMessage(accessToken, document.external_message_id);
    const file = await buildReceiptFile({ accessToken, message, document });

    const mime = buildForwardMime({
      from: source.email_address,
      to: source.forward_to,
      subject: document.subject,
      originalBody: message.text,
      attachment:
        file.origin === "none"
          ? null
          : {
              filename: file.filename,
              contentType: file.contentType,
              content: file.content,
            },
      summary: {
        merchant: document.merchant,
        amount:
          document.amount_cents !== null && document.currency
            ? formatAmount(document.amount_cents, document.currency)
            : null,
        date: document.document_date,
        invoiceNumber: document.invoice_number,
      },
    });

    const sentId = await sendMessage({ accessToken, mime });

    // L'état de la dépense au moment de l'envoi : c'est le point de comparaison
    // qui permettra d'affirmer que notre pièce s'est bien accrochée.
    const baseline = await expenseAttachmentCount(admin, document.expense_id);

    await admin
      .from("receipt_documents")
      .update({
        status: "forwarded",
        forwarded_at: new Date().toISOString(),
        forwarded_message_id: sentId,
        expense_attachment_baseline: baseline,
        pdf_origin: file.origin,
        pdf_filename: file.origin === "none" ? null : file.filename,
        pdf_size_bytes: file.origin === "none" ? null : file.content.length,
        external_attachment_id:
          file.origin === "attachment" ? file.externalAttachmentId : null,
        decided_by: options.actorId,
        decided_at: new Date().toISOString(),
        auto_decided: options.auto,
        failure_reason: null,
      })
      .eq("id", document.id);

    /* Le mail sort de la boîte de réception une fois la pièce partie : elle
       est traitée, elle n'a plus rien à faire sous les yeux. Jamais bloquant —
       un archivage raté ne doit pas faire passer pour échoué un transfert qui,
       lui, a réussi ; le mail restera simplement dans la boîte.

       Les boîtes connectées avant l'ajout du droit d'écriture n'ont que
       `gmail.readonly` : on ne tente rien plutôt que d'appeler pour un 403. */
    const archived = await archiveForwardedMail(admin, {
      accessToken,
      source,
      documentId: document.id,
      messageId: document.external_message_id,
    });

    await logEvent(admin, {
      orgId: document.org_id,
      documentId: document.id,
      actorId: options.actorId,
      action: options.auto ? "document.auto_forwarded" : "document.forwarded",
      after: {
        to: source.forward_to,
        pdf_origin: file.origin,
        gmail_id: sentId,
        gmail_archived: archived,
      },
    });

    return { ok: true, messageId: sentId };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Échec du transfert.";

    await admin
      .from("receipt_documents")
      .update({ status: "failed", failure_reason: reason })
      .eq("id", document.id);

    await logEvent(admin, {
      orgId: document.org_id,
      documentId: document.id,
      actorId: options.actorId,
      action: "document.forward_failed",
      after: { reason },
    });

    return { ok: false, error: reason };
  }
}

async function expenseAttachmentCount(
  admin: Admin,
  expenseId: string | null,
): Promise<number | null> {
  if (!expenseId) return null;
  const { data } = await admin
    .from("receipt_expenses")
    .select("attachment_count")
    .eq("id", expenseId)
    .maybeSingle();
  return (data as { attachment_count: number } | null)?.attachment_count ?? null;
}

type BuiltFile =
  | { origin: "attachment"; filename: string; contentType: string; content: Buffer; externalAttachmentId: string }
  | { origin: "rendered"; filename: string; contentType: string; content: Buffer }
  | { origin: "none" };

async function buildReceiptFile(context: {
  accessToken: string;
  message: GmailMessage;
  document: ReceiptDocument;
}): Promise<BuiltFile> {
  const { accessToken, message, document } = context;

  const attachment = pickInvoiceAttachment(message.attachments);
  if (attachment && attachment.size <= MAX_ATTACHMENT_BYTES) {
    const content = await getAttachment({
      accessToken,
      messageId: message.id,
      attachmentId: attachment.attachmentId,
    });
    return {
      origin: "attachment",
      filename: attachment.filename,
      contentType: "application/pdf",
      content,
      externalAttachmentId: attachment.attachmentId,
    };
  }

  const filename = receiptFilename({
    merchant: document.merchant,
    documentDate: document.document_date,
    invoiceNumber: document.invoice_number,
  });

  /* Le rendu fidèle, préparé à la lecture du mail là où un navigateur
     répondait. C'est lui qui donne « le mail exporté en PDF » — logo,
     couleurs, mise en page — que le transfert seul ne saurait produire. */
  if (document.pdf_storage_path) {
    const { data } = await createAdminClient()
      .storage.from(RENDERED_BUCKET)
      .download(document.pdf_storage_path);
    if (data) {
      const content = Buffer.from(await data.arrayBuffer());
      if (content.length > 0 && content.length <= MAX_ATTACHMENT_BYTES) {
        return { origin: "rendered", filename, contentType: "application/pdf", content };
      }
    }
  }

  // À défaut, un rendu à la volée — utile quand le transfert lui-même tourne
  // sur une machine dotée d'un navigateur.
  if (message.html) {
    const rendered = await renderHtmlToPdf(message.html);
    if (rendered && rendered.length <= MAX_ATTACHMENT_BYTES) {
      return {
        origin: "rendered",
        filename,
        contentType: "application/pdf",
        content: rendered,
      };
    }
  }

  /* À défaut, le mail devient un PDF de texte. C'est le cas courant — Grab et
     la plupart des reçus n'envoient que du HTML — et c'était jusqu'ici un
     transfert **sans pièce jointe** : Airwallex recevait un courrier vide de
     justificatif et n'accrochait rien, indéfiniment. */
  const body = message.text?.trim() || (message.html ? htmlToText(message.html) : "");
  if (body !== "") {
    const content = renderTextToPdf({
      title: document.subject ?? "Reçu",
      meta: [
        document.merchant ? `Marchand : ${document.merchant}` : "",
        document.amount_cents !== null && document.currency
          ? `Montant : ${formatAmount(document.amount_cents, document.currency)}`
          : "",
        document.document_date ? `Date : ${document.document_date}` : "",
        document.invoice_number ? `Facture : ${document.invoice_number}` : "",
        `Source : ${message.fromName ?? message.fromEmail}`,
      ],
      body,
    });
    if (content.length <= MAX_ATTACHMENT_BYTES) {
      return { origin: "rendered", filename, contentType: "application/pdf", content };
    }
  }

  // Un mail sans corps exploitable : il part tel quel, sans pièce.
  return { origin: "none" };
}

// --- Vérification de l'accrochage -------------------------------------------

export type VerifyReport = { checked: number; attached: number; unmatched: number };

/**
 * Confirme, ou infirme, que les pièces transférées ont trouvé leur ligne.
 *
 * C'est l'étape qui distingue cet outil d'une simple règle de transfert Gmail.
 * Sans elle, on enverrait des mails dans le vide en croyant tenir une
 * comptabilité à jour — et l'on ne s'en apercevrait qu'à la clôture.
 */
export async function verifyAttachments(orgId: string): Promise<VerifyReport> {
  const admin = createAdminClient();
  const report: VerifyReport = { checked: 0, attached: 0, unmatched: 0 };

  /* Une minute de battement : interroger l'API dans la seconde qui suit
     l'envoi ne ferait que consommer un appel pour un « pas encore ». */
  const cutoff = new Date(Date.now() - 60_000).toISOString();

  const { data: pending } = await admin
    .from("receipt_documents")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "forwarded")
    .lte("forwarded_at", cutoff)
    .order("forwarded_at")
    .limit(50);

  for (const row of (pending ?? []) as unknown as ReceiptDocument[]) {
    report.checked += 1;

    const attached = await hasAttachmentLanded(admin, row);

    if (attached) {
      await admin
        .from("receipt_documents")
        .update({
          status: "attached",
          attached_at: new Date().toISOString(),
          attach_checks: row.attach_checks + 1,
        })
        .eq("id", row.id);

      await logEvent(admin, {
        orgId,
        documentId: row.id,
        action: "document.attached",
        after: { expense_id: row.expense_id },
      });
      report.attached += 1;
      continue;
    }

    const checks = row.attach_checks + 1;

    if (checks >= MAX_ATTACH_CHECKS) {
      /* Airwallex ne l'accrochera manifestement pas seul. La pièce n'est pas
         perdue : elle est dans leur boîte de reçus, et repasse ici en « à
         rattacher à la main » avec le lien vers la ligne pressentie. */
      await admin
        .from("receipt_documents")
        .update({ status: "unmatched", attach_checks: checks })
        .eq("id", row.id);

      await logEvent(admin, {
        orgId,
        documentId: row.id,
        action: "document.unmatched",
        after: { checks },
      });
      report.unmatched += 1;
    } else {
      await admin
        .from("receipt_documents")
        .update({ attach_checks: checks })
        .eq("id", row.id);
    }
  }

  return report;
}

async function hasAttachmentLanded(
  admin: Admin,
  document: ReceiptDocument,
): Promise<boolean> {
  /* Sans ligne pressentie, il n'y a rien à interroger : Airwallex a peut-être
     rapproché la pièce d'une dépense qu'on n'avait pas identifiée, mais aucune
     API ne permet de le demander. On laisse le compteur expirer et la pièce
     ressort en « à vérifier ». */
  if (!document.expense_id) return false;

  const { data: expenseRow } = await admin
    .from("receipt_expenses")
    .select("external_id, attachment_count")
    .eq("id", document.expense_id)
    .maybeSingle();
  if (!expenseRow) return false;

  const expense = expenseRow as { external_id: string; attachment_count: number };
  const fresh = await getExpense(expense.external_id);
  if (!fresh) return false;

  await admin
    .from("receipt_expenses")
    .update({
      attachment_count: fresh.attachment_count,
      synced_at: new Date().toISOString(),
    })
    .eq("id", document.expense_id);

  const baseline = document.expense_attachment_baseline ?? expense.attachment_count;
  return fresh.attachment_count > baseline;
}

/** Candidats de rapprochement d'une pièce, relus depuis la base. */
export function candidatesOf(document: ReceiptDocument): MatchCandidate[] {
  return Array.isArray(document.match_candidates) ? document.match_candidates : [];
}
