/**
 * Modèle du module Échéances de facturation.
 *
 * Aligné sur `supabase/migrations/0016_billing_schema.sql`. Alias de type et
 * non `interface` : postgrest-js a besoin de l'index signature implicite que
 * TypeScript ne donne qu'aux premiers pour inférer les résultats de requête.
 */

export type BillingEngagementStatus = "active" | "ended";

export const ENGAGEMENT_STATUS_LABELS: Record<BillingEngagementStatus, string> = {
  active: "En cours",
  ended: "Terminé",
};

export type BillingInstallmentStatus = "pending" | "issued" | "paid" | "skipped";

export const INSTALLMENT_STATUS_LABELS: Record<BillingInstallmentStatus, string> = {
  pending: "À émettre",
  issued: "Émise",
  paid: "Payée",
  skipped: "Passée",
};

/** Libellé du retard, dérivé et jamais stocké — voir `isLate`. */
export const LATE_LABEL = "En retard";

export type BillingEngagement = {
  id: string;
  org_id: string;
  client_name: string;
  label: string;
  monthly_amount_cents: number;
  currency: string;
  first_month: string;
  months_count: number;
  status: BillingEngagementStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type BillingInstallment = {
  id: string;
  org_id: string;
  engagement_id: string;
  service_month: string;
  amount_cents: number;
  currency: string;
  issue_on: string;
  status: BillingInstallmentStatus;
  issued_at: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
