import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Counter, Panel, PanelBody, PanelRows } from "@/components/ds/surface";
import {
  INSTALLMENT_GRID,
  InstallmentRow,
  InstallmentsHeader,
  InvoiceRow,
  type BoardRow,
} from "@/components/billing/installment-row";
import { formatTotals } from "@/lib/billing/format";
import {
  addTotals,
  totalsOf,
  ttcTotalsOf,
  type CurrencyTotals,
} from "@/lib/billing/schedule";
import type { InstallmentStage } from "@/lib/billing/types";

/**
 * Un groupe de statut de l'écran Échéances — le fond du board Monday qu'il
 * remplace (le flux par statut, les sommes par groupe), dans la forme du
 * dashboard : un panneau Antidotes ordinaire, titre sobre, la couleur vit
 * dans les pastilles de statut des lignes comme partout ailleurs.
 *
 * **Tous les groupes se replient**, et tous plafonnent à six lignes : une
 * page dont chaque groupe s'étire à sa guise oblige à faire défiler des
 * mètres pour atteindre le suivant. Les chauds s'ouvrent d'eux-mêmes, les
 * froids attendent qu'on les demande, et la somme reste lisible dans les
 * deux cas — repliée, elle est le seul chiffre qu'on vient chercher.
 *
 * Repli en `<details>` natif : pas d'état client, pas d'hydratation — un
 * groupe replié reste dépliable même pendant que React se réveille.
 */

/**
 * Six lignes, et le liseré de la septième.
 *
 * Mesuré au navigateur plutôt que déduit : une ligne d'échéance fait 60 à
 * 63 px selon qu'elle porte une pastille de retard, soit 370 px pour six.
 * Les quatorze pixels restants laissent dépasser le haut de la suivante,
 * seule chose qui dise qu'il y en a une. Au téléphone, où la même ligne
 * occupe 130 px, ce plafond en montre trois — et c'est tant mieux : six
 * lignes y feraient 780 px, une page à elles seules.
 */
const SIX_ROWS = "max-h-96";

export function StageGroup({
  title,
  description,
  stage,
  rows,
  canDecide,
  emptyText,
  defaultOpen = false,
  footnote,
}: {
  title: string;
  description?: string;
  stage: InstallmentStage;
  rows: BoardRow[];
  canDecide: boolean;
  /** Affiché à la place des lignes quand le groupe est vide. */
  emptyText: string;
  /** Déplié au chargement — pour ce qui appelle une action aujourd'hui. */
  defaultOpen?: boolean;
  /** Une phrase sous les lignes — « +N mensualités jusqu'en… ». */
  footnote?: string;
}) {
  const sums = groupSums(rows);

  const heading = (
    <div className="min-w-0">
      <h3 className="type-h3 flex items-center gap-2">
        {title}
        <Counter value={rows.length} />
      </h3>
      {description ? (
        <p className="type-caption text-text-secondary mt-0.5">{description}</p>
      ) : null}
    </div>
  );

  const body =
    rows.length === 0 ? (
      <PanelBody>
        <p className="type-body text-text-secondary">{emptyText}</p>
      </PanelBody>
    ) : (
      <>
        <InstallmentsHeader />
        {/* Les lignes défilent, l'en-tête de colonnes et la somme restent :
            ce sont les deux repères qu'on ne veut jamais perdre de vue. */}
        <div className={cn(SIX_ROWS, "overflow-y-auto")}>
          <PanelRows>
            {rows.map((row) =>
              row.kind === "installment" ? (
                <InstallmentRow
                  key={row.line.id}
                  line={row.line}
                  stage={stage}
                  canDecide={canDecide}
                />
              ) : (
                <InvoiceRow key={row.invoice.id} invoice={row.invoice} stage={stage} />
              ),
            )}
          </PanelRows>
        </div>
        <GroupFooter count={rows.length} sums={sums} />
        {footnote ? (
          <p className="type-caption text-text-secondary border-t border-border px-5 py-2.5">
            {footnote}
          </p>
        ) : null}
      </>
    );

  return (
    <Panel>
      <details className="disclosure group/repli" open={defaultOpen}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
          {heading}
          <div className="flex shrink-0 items-center gap-4">
            {rows.length > 0 ? (
              <p className="type-caption text-text-secondary hidden text-right sm:block">
                {formatTotals(sums.ht)} HT · {formatTotals(sums.ttc)} TTC
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

/**
 * Les sommes d'un groupe mixte. Une facture hors devis porte un montant
 * unique — le total Airwallex — compté tel quel des deux côtés.
 */
function groupSums(rows: BoardRow[]): { ht: CurrencyTotals; ttc: CurrencyTotals } {
  const installments = rows
    .filter((row) => row.kind === "installment")
    .map((row) => row.line);
  const invoiceTotals = totalsOf(
    rows.filter((row) => row.kind === "invoice").map((row) => row.invoice),
  );

  return {
    ht: addTotals(totalsOf(installments), invoiceTotals),
    ttc: addTotals(ttcTotalsOf(installments), invoiceTotals),
  };
}

/** La ligne de somme du groupe, alignée sur les colonnes HT et TTC. */
function GroupFooter({
  count,
  sums,
}: {
  count: number;
  sums: { ht: CurrencyTotals; ttc: CurrencyTotals };
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-surface-sunken px-5 py-2.5",
        INSTALLMENT_GRID,
      )}
    >
      <span className="type-caption text-text-secondary">
        Somme · {count} ligne{count > 1 ? "s" : ""}
      </span>
      <span className="hidden md:block" />
      <span className="type-label text-text-primary text-left tabular-nums md:text-right">
        {formatTotals(sums.ht)}
      </span>
      <span className="type-body text-text-secondary text-left tabular-nums md:text-right">
        {formatTotals(sums.ttc)}
      </span>
      <span className="hidden md:block" />
    </div>
  );
}
