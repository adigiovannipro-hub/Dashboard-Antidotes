import { StatusPill, type StatusTone } from "@/components/ds/status-pill";
import {
  groupInvoicesByClient,
  isOverdue,
  type CurrencyTotals,
} from "@/lib/finance/invoices";
import { formatMoney } from "@/lib/finance/money";
import {
  INVOICE_STATUS_LABELS,
  OVERDUE_LABEL,
  type FinanceInvoice,
} from "@/lib/finance/types";

/**
 * Facturation à venir : l'encours, client par client.
 *
 * Les deux totaux — attendu ce mois, en retard — vivent désormais dans la
 * bande de mesures en tête de page, où on les lit sans chercher. Ce bloc ne
 * garde que ce qu'elle ne peut pas dire : qui doit quoi, et pour quand.
 */
export function InvoicesBlock({ invoices }: { invoices: FinanceInvoice[] }) {
  if (invoices.length === 0) {
    return (
      <p className="type-body text-text-secondary">
        Aucune facture synchronisée. Elles apparaîtront au premier passage de la
        synchronisation Airwallex — ou après l&apos;amorçage
        (<code className="type-caption">pnpm seed:finance</code>).
      </p>
    );
  }

  const groups = groupInvoicesByClient(invoices);

  return (
    <ul className="space-y-4">
      {groups.map((group) => (
        <li key={group.client_name}>
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="type-label text-text-primary">{group.client_name}</h4>
            <p className="type-caption text-text-secondary tabular-nums">
              {sumOf(group.open_totals) > 0
                ? `Encours : ${formatTotals(group.open_totals)}`
                : "Soldé"}
            </p>
          </div>
          <ul className="mt-1.5 space-y-1.5">
            {group.invoices.map((invoice) => (
              <InvoiceLine key={invoice.id} invoice={invoice} />
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

/** Une facture émise attend, une facture échue alerte, une payée est close. */
const STATUS_TONES: Record<FinanceInvoice["status"], StatusTone> = {
  draft: "neutral",
  sent: "warning",
  paid: "positive",
  void: "neutral",
};

function InvoiceLine({ invoice }: { invoice: FinanceInvoice }) {
  const overdue = isOverdue(invoice);

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <span className="flex min-w-0 items-center gap-2">
        <StatusPill tone={overdue ? "danger" : STATUS_TONES[invoice.status]}>
          {overdue ? OVERDUE_LABEL : INVOICE_STATUS_LABELS[invoice.status]}
        </StatusPill>
        <span className="type-caption truncate text-text-secondary">
          {invoice.due_on
            ? `échéance ${formatDay(invoice.due_on)}`
            : "sans échéance"}
        </span>
      </span>
      <span className="type-label text-text-primary tabular-nums">
        {formatMoney(invoice.amount_cents, invoice.currency)}
      </span>
    </li>
  );
}

/* Une somme par devise, jointes par « + » : additionner des euros et des
   dollars dans un seul nombre serait une invention. */
function formatTotals(totals: CurrencyTotals): string {
  const entries = Object.entries(totals).filter(([, cents]) => cents !== 0);
  if (entries.length === 0) return formatMoney(0, "EUR");
  return entries
    .map(([currency, cents]) => formatMoney(cents, currency))
    .join(" + ");
}

function sumOf(totals: CurrencyTotals): number {
  return Object.values(totals).reduce((sum, cents) => sum + cents, 0);
}

const DAY = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

function formatDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return DAY.format(parsed);
}
