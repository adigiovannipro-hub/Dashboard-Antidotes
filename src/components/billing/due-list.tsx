import { PanelBody, PanelRows } from "@/components/ds/surface";
import { StatusPill } from "@/components/ds/status-pill";
import { InstallmentAction } from "@/components/billing/installment-action";
import type { EngagementNames } from "@/components/billing/names";
import { isLate } from "@/lib/billing/schedule";
import { LATE_LABEL } from "@/lib/billing/types";
import { formatMoney } from "@/lib/finance/money";
import type { BillingInstallment } from "@/lib/billing/types";

/**
 * Les factures dont le jour est arrivé. C'est la zone d'action de l'écran :
 * chaque ligne dit qui, quoi, combien, depuis quand — et se coche une fois la
 * facture réellement envoyée.
 */
export function DueList({
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
          Rien à émettre aujourd&apos;hui. La prochaine échéance apparaîtra ici
          le jour venu.
        </p>
      </PanelBody>
    );
  }

  return (
    <PanelRows>
      {installments.map((installment) => {
        const name = names[installment.engagement_id];
        const late = isLate(installment);

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
                Prestation de {monthLabel(installment.service_month)} — à
                émettre depuis le {dayLabel(installment.issue_on)}
              </p>
            </div>

            {late ? <StatusPill tone="danger">{LATE_LABEL}</StatusPill> : null}

            <span className="type-label text-text-primary tabular-nums">
              {formatMoney(installment.amount_cents, installment.currency)}
            </span>

            {canDecide ? (
              <div className="flex gap-2">
                <InstallmentAction installmentId={installment.id} status="issued">
                  Émise
                </InstallmentAction>
                <InstallmentAction
                  installmentId={installment.id}
                  status="skipped"
                  variant="ghost"
                >
                  Passer
                </InstallmentAction>
              </div>
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
  timeZone: "UTC",
});

function monthLabel(isoMonth: string): string {
  const date = new Date(`${isoMonth}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? isoMonth : MONTH.format(date);
}

function dayLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? iso : DAY.format(date);
}
