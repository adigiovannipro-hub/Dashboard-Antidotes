import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Counter, Panel, PanelBody, PanelRows } from "@/components/ds/surface";
import type { StatusTone } from "@/components/ds/status-pill";
import {
  INSTALLMENT_GRID,
  InstallmentRow,
  InstallmentsHeader,
  type InstallmentLine,
} from "@/components/billing/installment-row";
import { formatTotals } from "@/lib/billing/format";
import { totalsOf, ttcTotalsOf } from "@/lib/billing/schedule";
import type { InstallmentStage } from "@/lib/billing/types";

/**
 * Un groupe de statut, calqué sur le board Monday : un titre encré de la
 * couleur du groupe, les lignes, et la somme HT / TTC en pied. Les groupes
 * froids — payé, archivé — se replient sur leur somme, comme le groupe
 * « Payée » du board se repliait sur ses 109 clients.
 *
 * Repli en `<details>` natif : pas d'état client, pas d'hydratation — un
 * groupe replié reste dépliable même pendant que React se réveille.
 */

const TITLE_TONES: Record<StatusTone, string> = {
  positive: "text-accent-ink",
  warning: "text-warning-ink",
  danger: "text-danger-ink",
  info: "text-info-ink",
  neutral: "text-text-primary",
};

export function StageGroup({
  title,
  tone,
  description,
  stage,
  lines,
  canDecide,
  emptyText,
  collapsible = false,
  capped = false,
  footnote,
}: {
  title: string;
  tone: StatusTone;
  description?: string;
  stage: InstallmentStage;
  lines: InstallmentLine[];
  canDecide: boolean;
  /** Affiché à la place des lignes quand le groupe est vide. */
  emptyText: string;
  /** Replié sur son en-tête et ses sommes, dépliable d'un clic. */
  collapsible?: boolean;
  /** Plafonne la hauteur et fait défiler — pour l'archivé, façon todo. */
  capped?: boolean;
  /** Une phrase sous les lignes — « +N mensualités jusqu'en… ». */
  footnote?: string;
}) {
  const heading = (
    <div className="min-w-0">
      <h3 className={cn("type-h3 flex items-center gap-2", TITLE_TONES[tone])}>
        <span aria-hidden className="size-2 shrink-0 rounded-pill bg-current" />
        {title}
        <Counter value={lines.length} />
      </h3>
      {description ? (
        <p className="type-caption text-text-secondary mt-0.5">{description}</p>
      ) : null}
    </div>
  );

  const body =
    lines.length === 0 ? (
      <PanelBody>
        <p className="type-body text-text-secondary">{emptyText}</p>
      </PanelBody>
    ) : (
      <>
        <InstallmentsHeader />
        <div className={capped ? "max-h-56 overflow-y-auto" : undefined}>
          <PanelRows>
            {lines.map((line) => (
              <InstallmentRow
                key={line.id}
                line={line}
                stage={stage}
                canDecide={canDecide}
              />
            ))}
          </PanelRows>
        </div>
        <GroupFooter lines={lines} />
        {footnote ? (
          <p className="type-caption text-text-secondary border-t border-border px-5 py-2.5">
            {footnote}
          </p>
        ) : null}
      </>
    );

  if (!collapsible) {
    return (
      <Panel>
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          {heading}
        </div>
        {body}
      </Panel>
    );
  }

  return (
    <Panel>
      <details className="group/repli">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
          {heading}
          <div className="flex shrink-0 items-center gap-4">
            {lines.length > 0 ? (
              <p className="type-caption text-text-secondary hidden text-right sm:block">
                {formatTotals(totalsOf(lines))} HT ·{" "}
                {formatTotals(ttcTotalsOf(lines))} TTC
              </p>
            ) : null}
            <ChevronDown
              aria-hidden
              strokeWidth={1.75}
              className="size-4.5 text-text-tertiary transition-transform duration-(--motion-duration) ease-standard group-open/repli:rotate-180"
            />
          </div>
        </summary>
        <div className="border-t border-border">{body}</div>
      </details>
    </Panel>
  );
}

/** La ligne de somme du groupe, alignée sur les colonnes HT et TTC. */
function GroupFooter({ lines }: { lines: InstallmentLine[] }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-surface-sunken px-5 py-2.5",
        INSTALLMENT_GRID,
      )}
    >
      <span className="type-caption text-text-secondary">
        Somme · {lines.length} ligne{lines.length > 1 ? "s" : ""}
      </span>
      <span className="hidden md:block" />
      <span className="type-label text-text-primary text-left tabular-nums md:text-right">
        {formatTotals(totalsOf(lines))}
      </span>
      <span className="type-body text-text-secondary text-left tabular-nums md:text-right">
        {formatTotals(ttcTotalsOf(lines))}
      </span>
      <span className="hidden md:block" />
    </div>
  );
}
