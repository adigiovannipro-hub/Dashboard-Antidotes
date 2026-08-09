import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/ds/status-pill";
import { ArchiveAction } from "@/components/billing/archive-action";
import { EditInstallment } from "@/components/billing/edit-installment";
import { InstallmentAction } from "@/components/billing/installment-action";
import { dayLabel, monthLabel, periodLabel } from "@/lib/billing/format";
import { isLate, ttcCentsOf } from "@/lib/billing/schedule";
import { isOverdue } from "@/lib/finance/invoices";
import type { UnmatchedInvoice } from "@/lib/billing/queries";
import { LATE_LABEL, type BillingInstallment, type InstallmentStage } from "@/lib/billing/types";
import { formatMoney } from "@/lib/finance/money";

/**
 * Une échéance, dans n'importe quel groupe de l'écran : qui, quel mois,
 * combien HT, combien TTC — et le filet d'actions manuelles quand le
 * rapprochement Airwallex ne peut pas trancher seul.
 *
 * Au téléphone, la ligne se replie en trois niveaux : le client, puis la
 * période et les montants, puis les actions.
 */

/** Une échéance aplatie avec son devis — ce que la page assemble. */
export type InstallmentLine = BillingInstallment & {
  client: string;
  project: string;
};

/**
 * Une rangée du board : une mensualité de devis, ou une facture Airwallex
 * qui n'en a pas trouvé — les deux cohabitent dans les mêmes groupes, parce
 * que l'écran montre la facturation réelle, pas seulement la planifiée.
 */
export type BoardRow =
  | { kind: "installment"; line: InstallmentLine }
  | { kind: "invoice"; invoice: UnmatchedInvoice };

/** Gabarit partagé par l'en-tête et les lignes. */
export const INSTALLMENT_GRID =
  "md:grid md:grid-cols-[minmax(0,1.6fr)_8.5rem_7.5rem_7.5rem_minmax(9.5rem,auto)] md:items-center md:gap-x-4";

export function InstallmentsHeader() {
  return (
    <div
      className={cn(
        "type-overline hidden border-b border-border bg-surface-sunken px-5 py-1.5 text-text-secondary",
        INSTALLMENT_GRID,
      )}
    >
      <span>Client · Projet</span>
      <span>Période</span>
      <span className="text-right">Montant HT</span>
      <span className="text-right">Montant TTC</span>
      <span>
        <span className="sr-only">Actions</span>
      </span>
    </div>
  );
}

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

  return (
    <div
      className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3", INSTALLMENT_GRID)}
    >
      {/* Le nom prend sa propre ligne au téléphone : coincé dans le rang
          flex, il se faisait tronquer jusqu'à « Bon… ». */}
      <div className="min-w-0 basis-full md:basis-auto">
        <p className="type-label text-text-primary flex items-center gap-2">
          <span className="truncate">{line.client}</span>
          {late ? <StatusPill tone="danger">{LATE_LABEL}</StatusPill> : null}
          {line.matched_invoice_id ? (
            <StatusPill tone="positive">Airwallex</StatusPill>
          ) : null}
        </p>
        <p className="type-caption text-text-secondary truncate">
          {line.project}
          {line.notes ? ` · ${line.notes}` : ""}
        </p>
      </div>

      <span className="type-caption bg-neutral-subtle text-neutral-ink inline-flex w-fit items-center rounded-pill px-2.5 py-0.5 font-medium whitespace-nowrap tabular-nums">
        {periodLabel(line.service_month)}
      </span>

      <span className="type-label text-text-primary text-left tabular-nums md:text-right">
        {formatMoney(line.amount_cents, line.currency)}
      </span>
      <span className="type-body text-text-secondary text-left tabular-nums md:text-right">
        {formatMoney(ttcCentsOf(line.amount_cents, line.vat_rate), line.currency)}
      </span>

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
 * Le montant Airwallex est le total de la facture, sans détail de taxe : il
 * s'affiche tel quel dans les deux colonnes — exact tant que la facturation
 * se fait sans TVA, et de toute façon la seule valeur connue.
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
      <div className="min-w-0 basis-full md:basis-auto">
        <p className="type-label text-text-primary flex items-center gap-2">
          <span className="truncate">{invoice.client_name}</span>
          {overdue ? <StatusPill tone="danger">{LATE_LABEL}</StatusPill> : null}
          <StatusPill tone="positive">Airwallex</StatusPill>
        </p>
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
      <span className="type-body text-text-secondary text-left tabular-nums md:text-right">
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
  const month = monthLabel(line.service_month);

  switch (stage) {
    case "confirmed":
      return (
        <>
          <EditInstallment
            installmentId={line.id}
            monthLabel={month}
            amountCents={line.amount_cents}
            notes={line.notes}
          />
          <InstallmentAction installmentId={line.id} status="skipped" variant="ghost">
            Passer
          </InstallmentAction>
        </>
      );
    case "to_invoice":
      return (
        <>
          <EditInstallment
            installmentId={line.id}
            monthLabel={month}
            amountCents={line.amount_cents}
            notes={line.notes}
          />
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
          <InstallmentAction installmentId={line.id} status="paid">
            Payée
          </InstallmentAction>
          <InstallmentAction installmentId={line.id} status="pending" variant="ghost">
            Rouvrir
          </InstallmentAction>
        </>
      );
    case "paid":
      return (
        <>
          <ArchiveAction installmentId={line.id} archived>
            Archiver
          </ArchiveAction>
          <InstallmentAction installmentId={line.id} status="pending" variant="ghost">
            Rouvrir
          </InstallmentAction>
        </>
      );
    case "archived":
      return (
        <ArchiveAction installmentId={line.id} archived={false} variant="ghost">
          Ressortir
        </ArchiveAction>
      );
    case "skipped":
      return (
        <InstallmentAction installmentId={line.id} status="pending" variant="ghost">
          Rétablir
        </InstallmentAction>
      );
  }
}
