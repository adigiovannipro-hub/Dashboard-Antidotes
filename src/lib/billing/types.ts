/**
 * Modèle du module Échéances de facturation.
 *
 * Aligné sur `supabase/migrations/0016_billing_schema.sql` et
 * `0025_billing_reconcile.sql`. Alias de type et non `interface` :
 * postgrest-js a besoin de l'index signature implicite que TypeScript ne
 * donne qu'aux premiers pour inférer les résultats de requête.
 */

export type BillingEngagementStatus = "active" | "ended";

export const ENGAGEMENT_STATUS_LABELS: Record<BillingEngagementStatus, string> = {
  active: "En cours",
  ended: "Terminé",
};

/**
 * Le statut stocké d'une échéance. Il ne connaît pas « à facturer » : une
 * échéance `pending` dont le mois de prestation est fini est à facturer, et
 * un état qui dépend de l'heure qu'il est n'a pas sa place en base — c'est
 * le rôle de `stageOf` (`schedule.ts`) de le dériver à la lecture.
 */
export type BillingInstallmentStatus = "pending" | "issued" | "paid" | "skipped";

/**
 * L'étape affichée — les groupes de l'écran, calqués sur le board Monday
 * qu'il remplace. Dérivée du statut, de la date d'émission et de
 * l'archivage ; jamais stockée.
 */
export type InstallmentStage =
  | "confirmed" // devis signé, mois de prestation pas encore fini
  | "to_invoice" // le mois est fini : la facture doit partir
  | "invoiced" // facture émise, en attente de règlement
  | "paid" // réglée
  | "archived" // réglée et descendue en bas de page
  | "skipped"; // annulée : mois offert, avoir, résiliation

export const STAGE_LABELS: Record<InstallmentStage, string> = {
  confirmed: "Devis confirmé",
  to_invoice: "À facturer",
  invoiced: "Facturée",
  paid: "Payée",
  archived: "Archivée",
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
  /** Taux de TVA en pourcentage — `20` pour 20 %. Le montant stocké est HT. */
  vat_rate: number;
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
  /** Copié de l'engagement à la génération, puis indépendant. */
  vat_rate: number;
  issue_on: string;
  status: BillingInstallmentStatus;
  issued_at: string | null;
  paid_at: string | null;
  /** La facture Airwallex rapprochée — la preuve que l'automate a avancé. */
  matched_invoice_id: string | null;
  /** Posé quand la ligne payée descend en bas de page ; jamais un statut. */
  archived_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
