import { cn } from "@/lib/utils";
import { StatusPill, type StatusTone } from "@/components/ds/status-pill";
import {
  DeleteInstallmentButton,
  InstallmentAction,
} from "@/components/billing/installment-action";
import { InstallmentCells } from "@/components/billing/installment-cells";
import { dayLabel } from "@/lib/billing/format";
import { isLate, isPaymentOverdue } from "@/lib/billing/schedule";
import { isOverdue } from "@/lib/finance/invoices";
import type { UnmatchedInvoice } from "@/lib/billing/queries";
import {
  LATE_LABEL,
  STAGE_LABELS,
  type BillingEmailKind,
  type BillingInstallment,
  type InstallmentStage,
} from "@/lib/billing/types";
import { formatMoney } from "@/lib/finance/money";

/**
 * Une échéance, dans n'importe quel groupe de l'écran : son état, qui, quel
 * mois, combien HT, combien TTC — et le filet d'actions manuelles quand le
 * rapprochement Airwallex ne peut pas trancher seul.
 *
 * L'état ouvre la ligne, à gauche du nom : c'est la première chose qu'on
 * cherche en parcourant une colonne, et la chercher à droite obligeait à
 * traverser le libellé à chaque ligne.
 *
 * Au téléphone, la ligne se replie en trois niveaux : l'état et le client,
 * puis la période et les montants, puis les actions.
 */

/** Une échéance aplatie avec son devis — ce que la page assemble. */
export type InstallmentLine = BillingInstallment & {
  client: string;
  project: string;
  /** Ce qui est parti chez le client pour cette mensualité, dans l'ordre. */
  emails?: { kind: BillingEmailKind; sent_at: string }[];
};

/**
 * Ce que le mail dit de cette ligne, en une phrase.
 *
 * L'envoi automatique ne se voit nulle part ailleurs : sans cette mention, un
 * client relancé trois fois et un client jamais contacté auraient exactement
 * la même ligne à l'écran. `null` quand rien n'est parti — la plupart des
 * lignes, tant que l'envoi n'est pas réglé sur leur devis.
 */
function deliveryNote(line: InstallmentLine): string | null {
  if (line.last_send_error) return `envoi bloqué — ${line.last_send_error}`;

  const emails = line.emails ?? [];
  const initial = emails.find((mail) => mail.kind === "invoice");
  if (!initial) return null;

  const reminders = emails.filter((mail) => mail.kind !== "invoice").length;
  const sent = `envoyée le ${dayLabel(initial.sent_at.slice(0, 10))}`;
  if (reminders === 0) return sent;
  return `${sent} · ${reminders} relance${reminders > 1 ? "s" : ""}`;
}

/**
 * Une rangée du board : une mensualité de devis, ou une facture Airwallex
 * qui n'en a pas trouvé — les deux cohabitent dans les mêmes groupes, parce
 * que l'écran montre la facturation réelle, pas seulement la planifiée.
 */
export type BoardRow =
  | { kind: "installment"; line: InstallmentLine }
  | { kind: "invoice"; invoice: UnmatchedInvoice };

/** Gabarit partagé par l'en-tête et les lignes. */
/* Cinq colonnes — la colonne HT est partie : Antidotes facture sans TVA,
   HT et TTC affichaient le même chiffre deux fois, et l'œil devait choisir. */
export const INSTALLMENT_GRID =
  "md:grid md:grid-cols-[8.5rem_minmax(0,1.4fr)_8.5rem_8rem_minmax(9rem,auto)] md:items-center md:gap-x-4";

export function InstallmentsHeader() {
  return (
    <div
      className={cn(
        "type-overline hidden border-b border-border bg-surface-sunken px-5 py-1.5 text-text-secondary",
        INSTALLMENT_GRID,
      )}
    >
      <span>Statut</span>
      <span>Client · Projet</span>
      <span>Période</span>
      <span className="text-right">Montant</span>
      <span>
        <span className="sr-only">Actions</span>
      </span>
    </div>
  );
}

/**
 * Le ton d'un état, identique à celui du dashboard Finance : tout l'en-cours
 * non réglé est orange, l'encaissé vert, le planifié bleu, le retard rouge.
 */
export const STAGE_TONES: Record<InstallmentStage, StatusTone> = {
  confirmed: "info",
  to_invoice: "warning",
  invoiced: "warning",
  paid: "positive",
  skipped: "neutral",
};

/** « Facturée » se dit « Envoyée » sur une ligne : le groupe porte déjà le
    statut, la pastille dit ce qui s'est passé — la facture est partie.
    Exporté parce que le détail d'un devis affiche les mêmes lignes : deux
    noms pour un seul état donneraient deux vérités. */
export const ROW_LABELS: Record<InstallmentStage, string> = {
  ...STAGE_LABELS,
  invoiced: "Envoyée",
};

export function InstallmentRow({
  line,
  stage,
  canDecide,
}: {
  line: InstallmentLine;
  stage: InstallmentStage;
  canDecide: boolean;
}) {
  const late = stage === "to_invoice" && isLate(line);
  const overdue = isPaymentOverdue(line);
  const enRetard = late || overdue;
  const delivery = deliveryNote(line);

  return (
    <div
      className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3", INSTALLMENT_GRID)}
    >
      <StatusPill tone={enRetard ? "danger" : STAGE_TONES[stage]} className="w-fit">
        {enRetard ? LATE_LABEL : ROW_LABELS[stage]}
      </StatusPill>

      {/* Le nom prend sa propre ligne au téléphone : coincé dans le rang
          flex, il se faisait tronquer jusqu'à « Bon… ». */}
      <div className="min-w-0 basis-full md:basis-auto">
        <p className="type-label text-text-primary truncate">{line.client}</p>
        <p className="type-caption text-text-secondary truncate">
          {line.project}
          {overdue && line.invoice_due_on
            ? ` · échéance dépassée le ${dayLabel(line.invoice_due_on)}`
            : ""}
          {line.notes ? ` · ${line.notes}` : ""}
        </p>
        {delivery ? (
          <p
            className={cn(
              "type-caption truncate",
              line.last_send_error ? "text-danger-ink" : "text-text-tertiary",
            )}
          >
            {delivery}
          </p>
        ) : null}
      </div>

      <InstallmentCells
        installmentId={line.id}
        serviceMonth={line.service_month}
        amountCents={line.amount_cents}
        vatRate={line.vat_rate}
        currency={line.currency}
        notes={line.notes}
        canEdit={canDecide}
      />

      {canDecide ? (
        <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
          <RowActions line={line} stage={stage} />
        </div>
      ) : (
        <span />
      )}
    </div>
  );
}

/**
 * Une facture Airwallex sans devis, dans les mêmes colonnes. Aucune action :
 * son statut EST celui d'Airwallex, la synchronisation horaire le tient à
 * jour — et le jour où un devis correspondant est saisi, le rapprochement la
 * déplacera sur sa mensualité.
 *
 * Le montant est le total de la facture, sans détail de taxe : il s'affiche
 * tel quel dans les deux colonnes — exact tant que la facturation se fait
 * sans TVA, et de toute façon la seule valeur connue.
 */
export function InvoiceRow({
  invoice,
  stage,
}: {
  invoice: UnmatchedInvoice;
  stage: InstallmentStage;
}) {
  const overdue = stage === "invoiced" && isOverdue(invoice);
  const chip =
    stage === "invoiced"
      ? invoice.issued_on
        ? `émise le ${dayLabel(invoice.issued_on)}`
        : "émise"
      : invoice.paid_at
        ? `payée le ${dayLabel(invoice.paid_at.slice(0, 10))}`
        : "payée";

  return (
    <div
      className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3", INSTALLMENT_GRID)}
    >
      <StatusPill tone={overdue ? "danger" : STAGE_TONES[stage]} className="w-fit">
        {overdue ? LATE_LABEL : ROW_LABELS[stage]}
      </StatusPill>

      <div className="min-w-0 basis-full md:basis-auto">
        <p className="type-label text-text-primary truncate">{invoice.client_name}</p>
        <p className="type-caption text-text-secondary truncate">
          Facture hors devis
          {overdue && invoice.due_on ? ` · échéance dépassée le ${dayLabel(invoice.due_on)}` : ""}
        </p>
      </div>

      <span className="type-caption bg-neutral-subtle text-neutral-ink inline-flex w-fit items-center rounded-pill px-2.5 py-0.5 font-medium whitespace-nowrap tabular-nums">
        {chip}
      </span>

      <span className="type-label text-text-primary text-left tabular-nums md:text-right">
        {formatMoney(invoice.amount_cents, invoice.currency)}
      </span>

      <span />
    </div>
  );
}

/**
 * Le filet manuel, calibré par groupe : chaque étape n'offre que les gestes
 * qui ont un sens depuis elle. En temps normal, personne ne clique — le
 * rapprochement horaire fait avancer les lignes tout seul.
 */
function RowActions({ line, stage }: { line: InstallmentLine; stage: InstallmentStage }) {
  switch (stage) {
    case "confirmed":
      /* « Passer » n'a plus sa place ici : un mois planifié qui ne doit pas
         exister se supprime — la trace d'un mois offert se pose au moment de
         facturer, pas des mois à l'avance. */
      return <DeleteInstallmentButton installmentId={line.id} />;
    case "to_invoice":
      return (
        <>
          <InstallmentAction installmentId={line.id} status="issued">
            Facturée
          </InstallmentAction>
          <InstallmentAction installmentId={line.id} status="skipped" variant="ghost">
            Passer
          </InstallmentAction>
        </>
      );
    case "invoiced":
      return (
        <>
          <InstallmentAction installmentId={line.id} status="paid" icon="check">
            Payée
          </InstallmentAction>
          <InstallmentAction installmentId={line.id} status="pending" variant="ghost">
            Rouvrir
          </InstallmentAction>
        </>
      );
    case "paid":
      /* « Pas encaissée » plutôt que « Rouvrir » : le cas réel est une ligne
         dite payée que la banque contredit. Elle redescend d'un cran, garde
         sa facture — donc son échéance de règlement — et repasse « En
         retard » toute seule si le délai est dépassé. « Rouvrir » la
         remonterait jusqu'à « à facturer », ce qui nierait une facture bel
         et bien partie. */
      return (
        <>
          <InstallmentAction installmentId={line.id} status="issued" variant="outline">
            Pas encaissée
          </InstallmentAction>
          <InstallmentAction installmentId={line.id} status="pending" variant="ghost">
            Rouvrir
          </InstallmentAction>
        </>
      );
    case "skipped":
      return (
        <InstallmentAction installmentId={line.id} status="pending" variant="ghost">
          Rétablir
        </InstallmentAction>
      );
  }
}
