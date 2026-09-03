import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Counter, Panel, PanelBody, PanelRows } from "@/components/ds/surface";
import { StatusPill } from "@/components/ds/status-pill";
import { AddInstallmentDialog } from "@/components/billing/add-installment-dialog";
import { DeliveryDialog } from "@/components/billing/delivery-dialog";
import { EngagementActions } from "@/components/billing/engagement-actions";
import {
  DeleteInstallmentButton,
  InstallmentAction,
} from "@/components/billing/installment-action";
import { InstallmentCells } from "@/components/billing/installment-cells";
import {
  ROW_LABELS,
  STAGE_TONES,
  type InstallmentLine,
} from "@/components/billing/installment-row";
import { formatTotals, monthLabel, periodLabel } from "@/lib/billing/format";
import {
  isLate,
  isPaymentOverdue,
  lastMonthOf,
  stageOf,
  ttcTotalsOf,
} from "@/lib/billing/schedule";
import {
  ENGAGEMENT_STATUS_LABELS,
  LATE_LABEL,
  type BillingEngagement,
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
/** Six devis visibles, le reste défile — même plafond que les groupes. */
const SIX_ROWS = "max-h-96";

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
      <details className="disclosure group/devis-liste" open>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0">
            <h3 className="type-h3 flex items-center gap-2">
              Devis signés
              <Counter value={engagements.length} />
            </h3>
            <p className="type-caption text-text-secondary mt-0.5">
              Une ligne par devis, ses mensualités en dépliant. La saisie se fait
              une fois, le reste avance tout seul.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            {action}
            <ChevronDown
              aria-hidden
              strokeWidth={1.75}
              className="size-4.5 text-text-tertiary transition-transform duration-(--motion-duration) ease-standard group-open/devis-liste:rotate-180"
            />
          </div>
        </summary>

        <div className="border-t border-border">
          {engagements.length === 0 ? (
            <PanelBody>
              <p className="type-body text-text-secondary">
                Aucun devis. « Ajouter un devis » génère ses mensualités d&apos;un
                coup — elles avancent ensuite toutes seules.
              </p>
            </PanelBody>
          ) : (
            /* Un devis déplié pousse ses mensualités **dans** la zone qui
               défile : le panneau garde sa hauteur quoi qu'on ouvre. */
            <div className={cn(SIX_ROWS, "overflow-y-auto")}>
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
            </div>
          )}
        </div>
      </details>
    </Panel>
  );
}

/* Sans colonne HT — même décision que les groupes du board : à 0 % de TVA,
   deux colonnes affichaient le même chiffre. */
const MONTH_GRID =
  "md:grid md:grid-cols-[8.5rem_8.5rem_7rem_minmax(0,1fr)_auto] md:items-center md:gap-x-4";

/* La colonne d'état ouvre la ligne, à la même largeur que dans les groupes du
   board : l'œil descend une seule colonne d'étiquettes du haut de la page
   jusqu'ici, au lieu de la chercher tantôt à gauche tantôt à droite. */
const ENGAGEMENT_GRID =
  "md:grid md:grid-cols-[8.5rem_minmax(0,1fr)_auto_auto] md:items-center md:gap-x-4";

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
    <details className="disclosure group/devis">
      <summary
        className={cn(
          "flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 [&::-webkit-details-marker]:hidden",
          ENGAGEMENT_GRID,
        )}
      >
        <StatusPill tone={active ? "positive" : "neutral"} className="w-fit">
          {ENGAGEMENT_STATUS_LABELS[engagement.status]}
        </StatusPill>

        <div className="min-w-0 basis-full md:basis-auto">
          <p className="type-label text-text-primary truncate">
            {engagement.client_name}
            <span className="text-text-secondary font-normal"> · {engagement.label}</span>
          </p>
          <p className="type-caption text-text-secondary">
            {period} · {engagement.months_count} mois ·{" "}
            {formatMoney(engagement.monthly_amount_cents, engagement.currency)}/mois
          </p>
        </div>

        <span className="type-label text-text-primary tabular-nums md:text-right">
          {formatTotals(ttcTotalsOf(billable))}
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
            Total facturable : {formatTotals(ttcTotalsOf(billable))}
            {engagement.notes ? ` — ${engagement.notes}` : ""}
          </p>
          {canDecide ? (
            <div className="flex flex-wrap items-center gap-2">
              <AddInstallmentDialog
                engagementId={engagement.id}
                clientName={engagement.client_name}
              />
              <DeliveryDialog engagement={engagement} />
              <EngagementActions engagementId={engagement.id} active={active} />
            </div>
          ) : null}
        </div>
      </div>
    </details>
  );
}

function EngagementMonthRow({
  line,
  canDecide,
}: {
  line: InstallmentLine;
  canDecide: boolean;
}) {
  const stage = stageOf(line);
  const skipped = line.status === "skipped";
  /* La même ligne se lit à l'identique dans le board et ici : ton, libellé et
     retard viennent du même endroit, sinon la mensualité d'août serait
     « Envoyée » en haut de page et « Facturée » dans son devis. */
  const enRetard = (stage === "to_invoice" && isLate(line)) || isPaymentOverdue(line);

  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-2", MONTH_GRID)}>
      <StatusPill tone={enRetard ? "danger" : STAGE_TONES[stage]} className="w-fit">
        {enRetard ? LATE_LABEL : ROW_LABELS[stage]}
      </StatusPill>

      {skipped ? (
        <>
          <span className="type-caption text-text-secondary line-through">
            {periodLabel(line.service_month)}
          </span>
          <span className="type-body text-text-secondary text-left line-through tabular-nums md:text-right">
            {formatMoney(line.amount_cents, line.currency)}
          </span>
        </>
      ) : (
        <InstallmentCells
          installmentId={line.id}
          serviceMonth={line.service_month}
          amountCents={line.amount_cents}
          vatRate={line.vat_rate}
          currency={line.currency}
          notes={line.notes}
          canEdit={canDecide}
        />
      )}

      <span className="type-caption text-text-secondary truncate">{line.notes ?? ""}</span>

      {canDecide ? (
        <div className="flex items-center gap-1.5 md:justify-end">
          {skipped ? (
            <InstallmentAction installmentId={line.id} status="pending" variant="ghost">
              Rétablir
            </InstallmentAction>
          ) : null}
          {/* Toute ligne du détail se supprime — la modification se répercute
              aux groupes du haut à l'instant : c'est la même table, l'écran
              entier la relit au rendu suivant. */}
          <DeleteInstallmentButton installmentId={line.id} />
        </div>
      ) : (
        <span />
      )}
    </div>
  );
}
