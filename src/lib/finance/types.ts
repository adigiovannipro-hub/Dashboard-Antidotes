/**
 * Modèle du module Finance.
 *
 * Aligné sur `supabase/migrations/0012_finance_schema.sql`. Alias de type et
 * non `interface` : postgrest-js a besoin de l'index signature implicite que
 * TypeScript ne donne qu'aux premiers pour inférer les résultats de requête.
 *
 * Les statuts Airwallex arrivent bruts de la base : leur traduction vit ici,
 * dans `transactionStatusLabel`, où elle se corrige sans migration.
 */

export type FinanceInvoiceStatus = "draft" | "sent" | "paid" | "void";

export type FinanceTransactionSource = "airwallex" | "whatsapp" | "manual";

export type FinanceReceiptSource = "whatsapp" | "manual" | "email";

export type FinanceMatchStatus =
  | "none"
  | "auto"
  | "pending"
  | "confirmed"
  | "rejected";

export type FinanceSyncKind = "balances" | "transactions" | "invoices";

export type FinanceSyncStatus = "running" | "success" | "error";

export type FinanceAccount = {
  id: string;
  org_id: string;
  external_id: string;
  currency: string;
  name: string;
  account_status: string | null;
  raw: Record<string, unknown> | null;
  synced_at: string;
  created_at: string;
};

export type FinanceBalanceSnapshot = {
  id: number;
  org_id: string;
  account_id: string;
  currency: string;
  available_cents: number;
  pending_cents: number;
  reserved_cents: number;
  snapshot_hour: string;
  captured_at: string;
};

export type FinanceInvoice = {
  id: string;
  org_id: string;
  external_id: string;
  client_name: string;
  client_external_id: string | null;
  amount_cents: number;
  currency: string;
  status: FinanceInvoiceStatus;
  raw_status: string | null;
  issued_on: string | null;
  due_on: string | null;
  paid_at: string | null;
  raw: Record<string, unknown> | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
};

export type FinanceCategory = {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  position: number;
  created_at: string;
};

export type FinanceCategoryRule = {
  id: string;
  org_id: string;
  matcher: string;
  category_id: string;
  created_at: string;
};

export type FinanceTransaction = {
  id: string;
  org_id: string;
  external_id: string;
  occurred_at: string;
  posted_at: string | null;
  merchant: string | null;
  merchant_raw: string | null;
  amount_cents: number;
  currency: string;
  billing_amount_cents: number | null;
  billing_currency: string | null;
  category_id: string | null;
  category_raw: string | null;
  status: string | null;
  source: FinanceTransactionSource;
  has_receipt: boolean;
  card_last_four: string | null;
  cardholder_name: string | null;
  raw: Record<string, unknown> | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
};

export type FinanceReceipt = {
  id: string;
  org_id: string;
  source: FinanceReceiptSource;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  merchant: string | null;
  amount_cents: number | null;
  currency: string | null;
  occurred_on: string | null;
  payment_method: string | null;
  extracted: Record<string, unknown> | null;
  extraction_confidence: number | null;
  transaction_id: string | null;
  match_confidence: number | null;
  match_status: FinanceMatchStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type FinanceSyncRun = {
  id: number;
  org_id: string;
  kind: FinanceSyncKind;
  status: FinanceSyncStatus;
  triggered_via: "cron" | "manual";
  started_at: string;
  finished_at: string | null;
  rows_synced: number;
  error: string | null;
  requested_by: string | null;
};

// --- Libellés --------------------------------------------------------------

export const INVOICE_STATUS_LABELS: Record<FinanceInvoiceStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyée",
  paid: "Payée",
  void: "Annulée",
};

/** Libellé du retard, dérivé et jamais stocké — voir `isOverdue`. */
export const OVERDUE_LABEL = "En retard";

export type BadgeTone = "neutral" | "positive" | "warning" | "critical";

/**
 * Traduction des statuts de dépense Airwallex.
 *
 * La liste suit ce que l'API renvoie aujourd'hui ; un statut inconnu s'affiche
 * tel quel plutôt que de casser — le vocabulaire d'un tiers n'est pas un
 * invariant sur lequel bâtir.
 */
const TRANSACTION_STATUS_LABELS: Record<string, { label: string; tone: BadgeTone }> = {
  // Une dépense qui vient d'être créée chez Airwallex, pas encore finalisée —
  // observée sur les lignes du jour, affichée « DRAFT » brut avant d'être ici.
  draft: { label: "Nouvelle", tone: "neutral" },
  incomplete: { label: "Incomplet", tone: "warning" },
  pending: { label: "En attente", tone: "neutral" },
  pending_approval: { label: "En attente d'approbation", tone: "neutral" },
  in_approval: { label: "En attente d'approbation", tone: "neutral" },
  approved: { label: "Approuvée", tone: "positive" },
  settled: { label: "Réglée", tone: "positive" },
  completed: { label: "Réglée", tone: "positive" },
  disputed: { label: "Contestée", tone: "critical" },
  cancelled: { label: "Annulée", tone: "neutral" },
};

export function transactionStatusLabel(status: string | null): {
  label: string;
  tone: BadgeTone;
} {
  if (!status) return { label: "—", tone: "neutral" };
  const known = TRANSACTION_STATUS_LABELS[status.toLowerCase()];
  return known ?? { label: status, tone: "neutral" };
}

export const SOURCE_LABELS: Record<FinanceTransactionSource, string> = {
  airwallex: "Airwallex",
  whatsapp: "WhatsApp",
  manual: "Saisie manuelle",
};

// --- Fenêtres de la courbe -------------------------------------------------

export const CHART_WINDOWS = [7, 30, 90] as const;
export type ChartWindow = (typeof CHART_WINDOWS)[number];

export type FinanceMerchantLogo = {
  id: string;
  org_id: string;
  merchant_key: string;
  domain: string | null;
  storage_path: string | null;
  fetched_at: string;
  created_at: string;
};
