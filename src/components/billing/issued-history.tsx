import { PanelBody, PanelRows } from "@/components/ds/surface";
import { StatusPill } from "@/components/ds/status-pill";
import { InstallmentAction } from "@/components/billing/installment-action";
import type { EngagementNames } from "@/components/billing/names";
import { formatMoney } from "@/lib/finance/money";
import {
  INSTALLMENT_STATUS_LABELS,
  type BillingInstallment,
} from "@/lib/billing/types";

/**
 * Les factures émises récemment, du plus récent au plus ancien. Une émise
 * attend son règlement — le bouton « Payée » clôt la ligne à l'encaissement.
 */
export function IssuedHistory({
  installments,
  names,
  canDecide,
}: {
  installments: BillingInstallment[];
  names: EngagementNames;
  canDecide: boolean;
}) {
  if (installments.length === 0) {
    return (
      <PanelBody>
        <p className="type-body text-text-secondary">
          Aucune facture émise pour l&apos;instant.
        </p>
      </PanelBody>
    );
  }

  return (
    <PanelRows>
      {installments.map((installment) => {
        const name = names[installment.engagement_id];
        return (
          <div
            key={installment.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3"
          >
            {/* Le nom prend sa propre ligne au téléphone : coincé dans le rang
                flex, il se faisait tronquer jusqu'à « Bon… ». */}
            <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
              <p className="type-label text-text-primary truncate">
                {name?.client ?? "—"}
                <span className="text-text-secondary font-normal">
                  {" "}
                  · {name?.label ?? ""}
                </span>
              </p>
              <p className="type-caption text-text-secondary">
                Prestation de {monthLabel(installment.service_month)}
                {installment.issued_at
                  ? ` — émise le ${dayLabel(installment.issued_at)}`
                  : ""}
              </p>
            </div>

            <StatusPill tone={installment.status === "paid" ? "positive" : "warning"}>
              {INSTALLMENT_STATUS_LABELS[installment.status]}
            </StatusPill>

            <span className="type-label text-text-primary tabular-nums">
              {formatMoney(installment.amount_cents, installment.currency)}
            </span>

            {canDecide && installment.status === "issued" ? (
              <InstallmentAction installmentId={installment.id} status="paid">
                Payée
              </InstallmentAction>
            ) : null}
          </div>
        );
      })}
    </PanelRows>
  );
}

const MONTH = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const DAY = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Paris",
});

function monthLabel(isoMonth: string): string {
  const date = new Date(`${isoMonth}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? isoMonth : MONTH.format(date);
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : DAY.format(date);
}
