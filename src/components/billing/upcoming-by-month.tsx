import type { EngagementNames } from "@/components/billing/names";
import { addMonths, currentMonth, totalsOf } from "@/lib/billing/schedule";
import { formatMoney } from "@/lib/finance/money";
import type { BillingInstallment } from "@/lib/billing/types";

/**
 * Les échéances à venir, regroupées par mois d'émission sur six mois.
 *
 * C'est la lecture « qu'est-ce qui va rentrer » : un total par mois, puis le
 * détail par client. Au-delà de six mois, la liste n'apprendrait rien — les
 * engagements longs se lisent dans leur panneau.
 */
export function UpcomingByMonth({
  installments,
  names,
}: {
  installments: BillingInstallment[];
  names: EngagementNames;
}) {
  if (installments.length === 0) {
    return (
      <p className="type-body text-text-secondary">
        Aucune échéance à venir. Elles apparaissent à la création d&apos;un
        engagement.
      </p>
    );
  }

  const start = currentMonth();
  const horizon = addMonths(start, 6);
  const byMonth = new Map<string, BillingInstallment[]>();
  for (const installment of installments) {
    if (installment.issue_on >= horizon) continue;
    const month = installment.issue_on.slice(0, 7);
    const list = byMonth.get(month) ?? [];
    list.push(installment);
    byMonth.set(month, list);
  }

  const months = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <ul className="space-y-4">
      {months.map(([month, lines]) => (
        <li key={month}>
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="type-label text-text-primary capitalize">
              {monthLabel(`${month}-01`)}
            </h4>
            <p className="type-caption text-text-secondary tabular-nums">
              {formatTotals(totalsOf(lines))}
            </p>
          </div>
          <ul className="mt-1.5 space-y-1">
            {lines.map((installment) => {
              const name = names[installment.engagement_id];
              return (
                <li
                  key={installment.id}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="type-caption text-text-secondary min-w-0 truncate">
                    {name?.client ?? "—"} · {name?.label ?? ""}
                  </span>
                  <span className="type-caption text-text-primary tabular-nums">
                    {formatMoney(installment.amount_cents, installment.currency)}
                  </span>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}

const MONTH = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function monthLabel(isoMonth: string): string {
  const date = new Date(`${isoMonth}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? isoMonth : MONTH.format(date);
}

function formatTotals(totals: Record<string, number>): string {
  const entries = Object.entries(totals).filter(([, cents]) => cents !== 0);
  if (entries.length === 0) return formatMoney(0, "EUR");
  return entries
    .map(([currency, cents]) => formatMoney(cents, currency))
    .join(" + ");
}
