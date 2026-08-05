import { Badge } from "@/components/ui/badge";
import {
  groupInvoicesByClient,
  invoiceKpis,
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
 * Facturation à venir : ce qu'on attend, ce qui traîne, client par client.
 *
 * Les deux indicateurs de tête répondent aux deux questions qu'on se pose
 * devant la facturation — « combien doit rentrer ce mois-ci ? » et « qui est
 * en retard ? ». Le rouge de la charte est réservé au second : un retard est
 * une alerte, un encours ne l'est pas.
 */
export function InvoicesBlock({ invoices }: { invoices: FinanceInvoice[] }) {
  if (invoices.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Aucune facture synchronisée. Elles apparaîtront au premier passage de la
        synchronisation Airwallex — ou après l&apos;amorçage
        (<code className="text-xs">pnpm seed:finance</code>).
      </p>
    );
  }

  const kpis = invoiceKpis(invoices);
  const groups = groupInvoicesByClient(invoices);
  const overdueTotal = sumOf(kpis.overdue);

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-3">
        <div className="bg-background rounded-lg p-3">
          <dt className="text-muted-foreground text-xs">Attendu ce mois</dt>
          <dd className="font-heading mt-1 text-xl tabular-nums">
            {formatTotals(kpis.expected_this_month)}
          </dd>
        </div>
        <div className="bg-background rounded-lg p-3">
          <dt className="text-muted-foreground text-xs">En retard</dt>
          <dd
            className="font-heading mt-1 text-xl tabular-nums"
            style={overdueTotal > 0 ? { color: "var(--brand-red)" } : undefined}
          >
            {formatTotals(kpis.overdue)}
          </dd>
        </div>
      </dl>

      <ul className="space-y-4">
        {groups.map((group) => (
          <li key={group.client_name}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-medium">{group.client_name}</h3>
              <p className="text-muted-foreground text-xs tabular-nums">
                {sumOf(group.open_totals) > 0
                  ? `Encours : ${formatTotals(group.open_totals)}`
                  : "Soldé"}
              </p>
            </div>
            <ul className="mt-1.5 space-y-1">
              {group.invoices.map((invoice) => (
                <InvoiceLine key={invoice.id} invoice={invoice} />
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InvoiceLine({ invoice }: { invoice: FinanceInvoice }) {
  const overdue = isOverdue(invoice);

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        {overdue ? (
          <Badge variant="destructive">{OVERDUE_LABEL}</Badge>
        ) : (
          <Badge variant={invoice.status === "paid" ? "secondary" : "outline"}>
            {INVOICE_STATUS_LABELS[invoice.status]}
          </Badge>
        )}
        <span className="text-muted-foreground truncate text-xs">
          {invoice.due_on
            ? `échéance ${formatDay(invoice.due_on)}`
            : "sans échéance"}
        </span>
      </span>
      <span className="font-medium tabular-nums">
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
