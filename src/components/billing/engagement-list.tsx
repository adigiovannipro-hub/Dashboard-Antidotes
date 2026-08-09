import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Panel, PanelBody, PanelHeader, PanelRows } from "@/components/ds/surface";
import { StatusPill } from "@/components/ds/status-pill";
import { EditInstallment } from "@/components/billing/edit-installment";
import { EngagementActions } from "@/components/billing/engagement-actions";
import { InstallmentAction } from "@/components/billing/installment-action";
import type { InstallmentLine } from "@/components/billing/installment-row";
import { formatTotals, monthLabel } from "@/lib/billing/format";
import {
  lastMonthOf,
  stageOf,
  totalsOf,
  ttcCentsOf,
  ttcTotalsOf,
} from "@/lib/billing/schedule";
import {
  ENGAGEMENT_STATUS_LABELS,
  STAGE_LABELS,
  type BillingEngagement,
  type InstallmentStage,
} from "@/lib/billing/types";
import { formatMoney } from "@/lib/finance/money";

/**
 * Les devis signés — la « ligne total » au-dessus des mensualités.
 *
 * Chaque devis se déplie sur ses mois : c'est là qu'on ajuste un montant —
 * « des fois c'est plus, des fois c'est moins » — ou qu'on passe un mois
 * offert. Le total affiché est la somme réelle des lignes, ajustements
 * compris, pas le montant théorique du devis.
 */
export function EngagementList({
  engagements,
  linesByEngagement,
  canDecide,
  action,
}: {
  engagements: BillingEngagement[];
  linesByEngagement: Record<string, InstallmentLine[]>;
  canDecide: boolean;
  action?: React.ReactNode;
}) {
  return (
    <Panel>
      <PanelHeader
        title="Devis signés"
        count={engagements.length}
        description="Une ligne par devis, ses mensualités en dépliant. La saisie se fait une fois, le reste avance tout seul."
        action={action}
      />

      {engagements.length === 0 ? (
        <PanelBody>
          <p className="type-body text-text-secondary">
            Aucun devis. « Ajouter un devis » génère ses mensualités d&apos;un
            coup — elles avancent ensuite toutes seules avec Airwallex.
          </p>
        </PanelBody>
      ) : (
        <PanelRows>
          {engagements.map((engagement) => (
            <EngagementDetails
              key={engagement.id}
              engagement={engagement}
              lines={linesByEngagement[engagement.id] ?? []}
              canDecide={canDecide}
            />
          ))}
        </PanelRows>
      )}
    </Panel>
  );
}

const MONTH_GRID =
  "md:grid md:grid-cols-[minmax(0,1fr)_8.5rem_7.5rem_7.5rem_6.5rem] md:items-center md:gap-x-4";

function EngagementDetails({
  engagement,
  lines,
  canDecide,
}: {
  engagement: BillingEngagement;
  lines: InstallmentLine[];
  canDecide: boolean;
}) {
  const active = engagement.status === "active";
  const period = `${monthLabel(engagement.first_month)} → ${monthLabel(lastMonthOf(engagement))}`;
  /* Le total vit dans les lignes : un mois ajusté doit se lire ici aussi. */
  const billable = lines.filter((line) => line.status !== "skipped");

  return (
    <details className="group/devis">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 basis-full md:basis-auto md:min-w-0 md:flex-1">
          <p className="type-label text-text-primary truncate">
            {engagement.client_name}
            <span className="text-text-secondary font-normal"> · {engagement.label}</span>
          </p>
          <p className="type-caption text-text-secondary">
            {period} · {engagement.months_count} mois ·{" "}
            {formatMoney(engagement.monthly_amount_cents, engagement.currency)} HT/mois
          </p>
        </div>

        <StatusPill tone={active ? "positive" : "neutral"}>
          {ENGAGEMENT_STATUS_LABELS[engagement.status]}
        </StatusPill>

        <span className="type-label text-text-primary tabular-nums">
          {formatTotals(totalsOf(billable))}
          <span className="type-caption text-text-secondary font-normal"> HT</span>
        </span>

        <ChevronDown
          aria-hidden
          strokeWidth={1.75}
          className="size-4.5 text-text-tertiary transition-transform duration-(--motion-duration) ease-standard group-open/devis:rotate-180"
        />
      </summary>

      <div className="border-t border-border bg-surface-sunken/40">
        <div className="divide-y divide-border">
          {lines.map((line) => (
            <EngagementMonthRow key={line.id} line={line} canDecide={canDecide} />
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
          <p className="type-caption text-text-secondary tabular-nums">
            Total facturable : {formatTotals(totalsOf(billable))} HT ·{" "}
            {formatTotals(ttcTotalsOf(billable))} TTC
            {engagement.notes ? ` — ${engagement.notes}` : ""}
          </p>
          {canDecide ? (
            <EngagementActions engagementId={engagement.id} active={active} />
          ) : null}
        </div>
      </div>
    </details>
  );
}

const MONTH_STAGE_TONES: Record<InstallmentStage, React.ComponentProps<typeof StatusPill>["tone"]> = {
  confirmed: "info",
  to_invoice: "warning",
  invoiced: "info",
  paid: "positive",
  archived: "neutral",
  skipped: "neutral",
};

function EngagementMonthRow({
  line,
  canDecide,
}: {
  line: InstallmentLine;
  canDecide: boolean;
}) {
  const stage = stageOf(line);
  const skipped = line.status === "skipped";

  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-2", MONTH_GRID)}>
      <p
        className={cn(
          "type-body min-w-0 basis-full truncate md:basis-auto",
          skipped ? "text-text-secondary line-through" : "text-text-primary",
        )}
      >
        {monthLabel(line.service_month)}
        {line.notes ? (
          <span className="type-caption text-text-secondary no-underline"> · {line.notes}</span>
        ) : null}
      </p>

      <StatusPill tone={MONTH_STAGE_TONES[stage]}>{STAGE_LABELS[stage]}</StatusPill>

      <span
        className={cn(
          "type-body text-left tabular-nums md:text-right",
          skipped ? "text-text-secondary line-through" : "text-text-primary",
        )}
      >
        {formatMoney(line.amount_cents, line.currency)}
      </span>
      <span className="type-caption text-text-secondary text-left tabular-nums md:text-right">
        {skipped ? "—" : formatMoney(ttcCentsOf(line.amount_cents, line.vat_rate), line.currency)}
      </span>

      {canDecide ? (
        <div className="flex items-center gap-1.5 md:justify-end">
          {skipped ? (
            <InstallmentAction installmentId={line.id} status="pending" variant="ghost">
              Rétablir
            </InstallmentAction>
          ) : line.status === "pending" ? (
            <EditInstallment
              installmentId={line.id}
              monthLabel={monthLabel(line.service_month)}
              amountCents={line.amount_cents}
              notes={line.notes}
            />
          ) : null}
        </div>
      ) : (
        <span />
      )}
    </div>
  );
}
