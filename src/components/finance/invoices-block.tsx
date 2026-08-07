import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { StatusPill } from "@/components/ds/status-pill";
import { isLate } from "@/lib/billing/schedule";
import {
  INSTALLMENT_STATUS_LABELS,
  LATE_LABEL,
  type BillingInstallment,
} from "@/lib/billing/types";
import { formatMoney } from "@/lib/finance/money";

/**
 * Facturation à venir : les prochaines échéances, client par client.
 *
 * Le bloc lit le module Échéances — la source que je maintiens — et non plus
 * les factures synchronisées d'Airwallex, dont les noms de clients ne
 * correspondaient pas à la réalité. Le détail et les actions vivent sur la
 * page Échéances ; ici, la lecture d'un coup d'œil.
 */
export type UpcomingLine = BillingInstallment & {
  client_name: string;
  engagement_label: string;
};

export function InvoicesBlock({ lines }: { lines: UpcomingLine[] }) {
  if (lines.length === 0) {
    return (
      <div className="space-y-3">
        <p className="type-body text-text-secondary">
          Aucune échéance de facturation enregistrée.
        </p>
        <Link
          href="/entreprise/echeances"
          className="type-label text-accent-ink inline-flex items-center gap-1 hover:underline"
        >
          Ajouter un engagement
          <ArrowRight strokeWidth={1.75} className="size-4" aria-hidden />
        </Link>
      </div>
    );
  }

  const groups = groupByClient(lines);

  return (
    <div className="space-y-4">
      <ul className="space-y-4">
        {groups.map((group) => (
          <li key={group.client}>
            <div className="flex items-baseline justify-between gap-3">
              <h4 className="type-label text-text-primary">{group.client}</h4>
              <p className="type-caption text-text-secondary tabular-nums">
                {formatTotals(group.totals)}
              </p>
            </div>
            <ul className="mt-1.5 space-y-1.5">
              {group.lines.map((line) => (
                <InstallmentLine key={line.id} line={line} />
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <Link
        href="/entreprise/echeances"
        className="type-label text-accent-ink inline-flex items-center gap-1 hover:underline"
      >
        Toutes les échéances
        <ArrowRight strokeWidth={1.75} className="size-4" aria-hidden />
      </Link>
    </div>
  );
}

function InstallmentLine({ line }: { line: UpcomingLine }) {
  const late = isLate(line);

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <span className="flex min-w-0 items-center gap-2">
        <StatusPill tone={late ? "danger" : line.status === "issued" ? "warning" : "info"}>
          {late ? LATE_LABEL : INSTALLMENT_STATUS_LABELS[line.status]}
        </StatusPill>
        <span className="type-caption truncate text-text-secondary">
          {line.engagement_label} — émission {dayLabel(line.issue_on)}
        </span>
      </span>
      <span className="type-label text-text-primary tabular-nums">
        {formatMoney(line.amount_cents, line.currency)}
      </span>
    </li>
  );
}

function groupByClient(lines: UpcomingLine[]) {
  const byClient = new Map<string, UpcomingLine[]>();
  for (const line of lines) {
    const list = byClient.get(line.client_name) ?? [];
    list.push(line);
    byClient.set(line.client_name, list);
  }

  return [...byClient.entries()]
    .map(([client, clientLines]) => ({
      client,
      lines: clientLines,
      totals: totalsOf(clientLines),
    }))
    /* Le client dont l'échéance est la plus proche en premier : c'est la
       question que pose le bloc. */
    .sort((a, b) => a.lines[0]!.issue_on.localeCompare(b.lines[0]!.issue_on));
}

function totalsOf(lines: UpcomingLine[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const line of lines) {
    totals[line.currency] = (totals[line.currency] ?? 0) + line.amount_cents;
  }
  return totals;
}

/* Une somme par devise, jointes par « + » : additionner des euros et des
   dollars dans un seul nombre serait une invention. */
function formatTotals(totals: Record<string, number>): string {
  const entries = Object.entries(totals).filter(([, cents]) => cents !== 0);
  if (entries.length === 0) return formatMoney(0, "EUR");
  return entries
    .map(([currency, cents]) => formatMoney(cents, currency))
    .join(" + ");
}

const DAY = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function dayLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return DAY.format(parsed);
}
