/**
 * Modèle du module Reçus.
 *
 * Aligné sur `supabase/migrations/0010_receipts_schema.sql`. Alias de type et
 * non `interface` : postgrest-js a besoin de l'index signature implicite que
 * TypeScript ne donne qu'aux premiers pour inférer les résultats de requête.
 */

export type ReceiptProvider = "gmail";

export type ReceiptSourceStatus = "pending" | "connected" | "error" | "disabled";

export type ReceiptKind =
  | "invoice"
  | "receipt"
  | "subscription"
  | "statement"
  | "other";

export const KIND_LABELS: Record<ReceiptKind, string> = {
  invoice: "Facture",
  receipt: "Reçu",
  subscription: "Abonnement",
  statement: "Relevé",
  other: "Sans valeur comptable",
};

/** Natures qui méritent d'être rangées dans Airwallex. */
export const ACCOUNTABLE_KINDS: ReceiptKind[] = [
  "invoice",
  "receipt",
  "subscription",
];

export function isAccountable(kind: ReceiptKind): boolean {
  return ACCOUNTABLE_KINDS.includes(kind);
}

export type ReceiptStatus =
  | "detected"
  | "awaiting_validation"
  | "queued"
  | "forwarded"
  | "attached"
  | "unmatched"
  | "ignored"
  | "failed";

export const STATUS_LABELS: Record<ReceiptStatus, string> = {
  detected: "En cours d'analyse",
  awaiting_validation: "À valider",
  queued: "Transfert en cours",
  forwarded: "Transféré, accrochage en attente",
  attached: "Rangé",
  unmatched: "Non rapproché par Airwallex",
  ignored: "Ignoré",
  failed: "Échec",
};

/**
 * Statuts qui comptent dans le badge « à gérer ».
 *
 * `forwarded` en est exclu : la pièce est partie, il n'y a rien à faire qu'à
 * attendre l'OCR d'Airwallex. `unmatched` y est, lui, parce qu'il appelle un
 * geste — retrouver la ligne à la main dans Airwallex.
 */
export const ACTIONABLE_STATUSES: ReceiptStatus[] = [
  "awaiting_validation",
  "unmatched",
  "failed",
];

export function isActionable(status: ReceiptStatus): boolean {
  return ACTIONABLE_STATUSES.includes(status);
}

/** Statuts dont on ne revient pas : plus aucune décision n'est possible. */
export const TERMINAL_STATUSES: ReceiptStatus[] = ["attached", "ignored"];

export type ReceiptPdfOrigin = "attachment" | "rendered" | "none";

export const PDF_ORIGIN_LABELS: Record<ReceiptPdfOrigin, string> = {
  attachment: "PDF joint au mail",
  rendered: "PDF généré depuis le mail",
  none: "Mail transféré tel quel",
};

export type ReceiptMatchMethod = "exact" | "fuzzy" | "manual" | "none";

export const MATCH_METHOD_LABELS: Record<ReceiptMatchMethod, string> = {
  exact: "Montant et date concordants",
  fuzzy: "Rapprochement approché",
  manual: "Ligne choisie à la main",
  none: "Aucun rapprochement",
};

/** Réglages d'auto-transfert, tels qu'ils vivent dans `receipt_sources.settings`. */
export type AutoForwardSettings = {
  enabled: boolean;
  /** Confiance minimale exigée, classification et rapprochement confondus. */
  min_confidence: number;
  /** Au-delà, une pièce passe toujours par une validation humaine. */
  max_amount_cents: number;
  hourly_cap: number;
  /** Coupe tout sans avoir à défaire le reste du réglage. */
  emergency_stop: boolean;
  /** Exiger qu'une dépense carte corresponde avant d'envoyer quoi que ce soit. */
  require_expense_match: boolean;
};

export type ReceiptSourceSettings = {
  auto_forward: AutoForwardSettings;
  lookback_days: number;
  ignored_senders: string[];
};

export const DEFAULT_SOURCE_SETTINGS: ReceiptSourceSettings = {
  auto_forward: {
    enabled: false,
    min_confidence: 0.9,
    max_amount_cents: 50_000,
    hourly_cap: 10,
    emergency_stop: false,
    require_expense_match: true,
  },
  lookback_days: 30,
  ignored_senders: [],
};

export type ReceiptSource = {
  id: string;
  org_id: string;
  provider: ReceiptProvider;
  email_address: string;
  credentials_encrypted: string | null;
  granted_scopes: string[];
  token_expires_at: string | null;
  history_id: string | null;
  last_polled_at: string | null;
  status: ReceiptSourceStatus;
  last_error: string | null;
  forward_to: string;
  settings: ReceiptSourceSettings;
  created_at: string;
};

export type ReceiptExpense = {
  id: string;
  org_id: string;
  external_id: string;
  merchant: string | null;
  /** Montant local — celui des reçus. Le débité est à côté, jamais converti. */
  amount_cents: number;
  currency: string;
  billing_amount_cents: number | null;
  billing_currency: string | null;
  transaction_date: string | null;
  posted_at: string | null;
  card_last_four: string | null;
  cardholder_name: string | null;
  category: string | null;
  expense_status: string | null;
  attachment_count: number;
  raw: Record<string, unknown> | null;
  synced_at: string;
};

/** Candidat de rapprochement conservé pour l'écran de validation. */
export type MatchCandidate = {
  expense_id: string;
  confidence: number;
  method: ReceiptMatchMethod;
  /** Phrase affichable : pourquoi cette ligne plutôt qu'une autre. */
  reason: string;
};

export type ReceiptDocument = {
  id: string;
  org_id: string;
  source_id: string;
  external_message_id: string;
  external_thread_id: string | null;
  received_at: string;
  from_email: string;
  from_name: string | null;
  subject: string | null;
  snippet: string | null;
  kind: ReceiptKind;
  classification_confidence: number;
  classification_reason: string | null;
  classified_by: string | null;
  merchant: string | null;
  amount_cents: number | null;
  currency: string | null;
  document_date: string | null;
  invoice_number: string | null;
  tax_cents: number | null;
  pdf_origin: ReceiptPdfOrigin;
  pdf_filename: string | null;
  pdf_size_bytes: number | null;
  /** Chemin du mail rendu en PDF fidèle, dans le bucket `receipt-pdfs`. */
  pdf_storage_path: string | null;
  external_attachment_id: string | null;
  status: ReceiptStatus;
  expense_id: string | null;
  match_confidence: number | null;
  match_method: ReceiptMatchMethod;
  match_candidates: MatchCandidate[];
  forwarded_at: string | null;
  forwarded_message_id: string | null;
  expense_attachment_baseline: number | null;
  attached_at: string | null;
  attach_checks: number;
  failure_reason: string | null;
  decided_by: string | null;
  decided_at: string | null;
  auto_decided: boolean;
  created_at: string;
  updated_at: string;
};

export type ReceiptMerchantRule = {
  id: string;
  org_id: string;
  sender_domain: string;
  merchant: string | null;
  category: string | null;
  auto_forward: boolean;
  approvals: number;
  rejections: number;
  last_seen_at: string | null;
  created_at: string;
};

export type ReceiptEvent = {
  id: number;
  org_id: string;
  document_id: string | null;
  actor_id: string | null;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
};

/**
 * Nombre de validations manuelles concordantes avant de proposer l'automatisme
 * pour un fournisseur.
 *
 * Trois : en dessous, on propose sur du bruit ; au-dessus, la proposition
 * arrive après que l'agacement s'est installé.
 */
export const AUTO_FORWARD_SUGGESTION_THRESHOLD = 3;

/**
 * Combien de fois vérifier qu'Airwallex a bien accroché une pièce avant de
 * conclure qu'il ne le fera pas.
 *
 * L'OCR répond en quelques minutes d'ordinaire. Six passages du cron laissent
 * largement le temps, et évitent de surveiller indéfiniment une pièce qui
 * restera dans leur boîte de reçus.
 */
export const MAX_ATTACH_CHECKS = 6;
