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
 * qu'il remplace. Dérivée du statut et de la date d'émission ; jamais
 * stockée. Il n'y a pas d'archivage : une fois payé, c'est payé, et un
 * second classement par-dessus n'apprendrait rien de plus.
 */
export type InstallmentStage =
  | "confirmed" // devis signé, mois de prestation pas encore fini
  | "to_invoice" // le mois est fini : la facture doit partir
  | "invoiced" // facture émise, en attente de règlement
  | "paid" // réglée
  | "skipped"; // annulée : mois offert, avoir, résiliation

export const STAGE_LABELS: Record<InstallmentStage, string> = {
  confirmed: "Facture confirmée",
  to_invoice: "À facturer",
  invoiced: "Facturée",
  paid: "Payée",
  skipped: "Passée",
};

/** Libellé du retard, dérivé et jamais stocké — voir `isLate`. */
export const LATE_LABEL = "En retard";

/**
 * Les quatre mails de la vie d'une facture. L'ordre est la cadence : l'envoi
 * part à l'émission, puis J+31, J+46, J+61 tant que le règlement n'arrive
 * pas. Après la troisième relance, plus rien ne part tout seul — un impayé
 * qui a résisté à trois mails ne se règle pas par un quatrième.
 */
export type BillingEmailKind =
  | "invoice"
  | "reminder_1"
  | "reminder_2"
  | "reminder_3";

export const EMAIL_KIND_LABELS: Record<BillingEmailKind, string> = {
  invoice: "Facture envoyée",
  reminder_1: "1re relance",
  reminder_2: "2e relance",
  reminder_3: "3e relance",
};

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
  /** Sans destinataire, rien ne part : la mensualité reste à facturer à la
      main. C'est la porte de sortie volontaire de l'automatisme. */
  recipient_email: string | null;
  cc_emails: string[];
  /** Pour `[prénom]` : Airwallex ne connaît que la raison sociale, et
      « Bonjour SARL DUPONT » n'est pas une formule de politesse. */
  contact_first_name: string | null;
  /** `null` : le modèle commun s'applique — voir `templates.ts`. L'objet est
      un champ à part du corps : la première ligne d'un texte ne se distingue
      pas à l'œil de son premier paragraphe. */
  send_subject: string | null;
  send_template: string | null;
  reminder_subject: string | null;
  reminder_template: string | null;
  /** Le client de facturation Airwallex (`bcus_…`) et le produit facturé
      (`prd_…`), tous deux appris de la facture modèle. Le produit et non le
      prix : le montant d'une mensualité varie au centime, un prix Airwallex
      est fixe — il s'en crée un par facture. */
  airwallex_customer_id: string | null;
  airwallex_product_id: string | null;
  /** La facture créée à la main dont les suivantes reprennent la forme. */
  template_invoice_external_id: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * La correspondance entre un nom vu sur une facture — la raison sociale
 * qu'Airwallex connaît — et le nom que les devis portent, celui de la
 * marque. `client_name` à `null` : la facture n'est pas une prestation
 * client, l'écran des échéances l'ignore.
 */
export type BillingClientAlias = {
  id: string;
  org_id: string;
  alias: string;
  client_name: string | null;
  note: string | null;
  created_at: string;
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
  /** La facture Airwallex émise pour cette mensualité (`inv_…`). Posée dès
      la création, avant même que la synchronisation ne la rapatrie : c'est
      elle qui empêche le passage suivant d'en créer une seconde. */
  airwallex_invoice_id: string | null;
  /** Ce qui a empêché l'émission ou l'envoi, en clair. Effacé au succès. */
  last_send_error: string | null;
  /** Vestige de l'archivage, retiré en 0028 : plus rien ne le pose ni ne le
      lit. La colonne reste pour ne pas réécrire l'histoire des lignes. */
  archived_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /** L'échéance de règlement de la facture rapprochée — jamais stockée sur
      la mensualité, jointe à la lecture. Absente tant qu'aucun lien n'est
      posé. */
  invoice_due_on?: string | null;
};

/**
 * Un mail parti, tel qu'il est parti.
 *
 * Les adresses et le texte sont copiés et non référencés : un client qui
 * change d'adresse, un template qu'on retouche, ne réécrivent pas l'histoire
 * de ce qui a été reçu. C'est un journal, pas une vue.
 */
export type BillingInvoiceEmail = {
  id: string;
  org_id: string;
  installment_id: string;
  kind: BillingEmailKind;
  to_email: string;
  cc_emails: string[];
  bcc_email: string | null;
  subject: string;
  body: string;
  invoice_external_id: string | null;
  gmail_message_id: string | null;
  sent_at: string;
  created_at: string;
};
