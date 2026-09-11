import Link from "next/link";
import { AlertTriangle, CalendarDays } from "lucide-react";

import {
  PublicationHeader,
  PublicationRowView,
} from "@/components/mon-travail/publication-row";
import { RescheduleLateButton } from "@/components/mon-travail/reschedule-late";
import { Panel, PanelHeader } from "@/components/ds/surface";
import { StatusPill } from "@/components/ds/status-pill";
import { Button } from "@/components/ui/button";
import { READY_STATUSES, type PlanningStatus } from "@/lib/planning/types";
import type { PublicationRow } from "@/lib/mon-travail/types";

/**
 * « À publier » : les lignes de publication du jour, tous clients confondus,
 * pour vérifier que ce qui devait partir est bien parti. Ce qui est déjà
 * marqué publié n'apparaît plus ici.
 *
 * L'ordre est celui du travail — date, puis réseau — et non celui des
 * clients : on ouvre Instagram une fois. La colonne « Client » dit de qui
 * vient chaque ligne et mène à son board.
 *
 * Une journée vide ne se solde pas par une phrase et du blanc : le panneau
 * bascule sur les prochaines publications datées. La question qui suit
 * « rien aujourd'hui » est toujours « et ensuite ? ».
 */
export function PublicationsSection({
  rows,
  next,
  late,
}: {
  rows: PublicationRow[];
  /** Repli quand la journée est vide. */
  next: PublicationRow[];
  /** Publications antérieures à aujourd'hui, comptées par la page. */
  late: number;
}) {
  const empty = rows.length === 0;

  // Validées ou programmées, mais datées d'avant aujourd'hui : l'automate ne
  // les prendra plus, c'est un geste humain qui les relance.
  const today = new Date().toISOString().slice(0, 10);
  const stuckValidated = rows.filter(
    (row) =>
      (READY_STATUSES as PlanningStatus[]).includes(
        row.subject.status as PlanningStatus,
      ) &&
      row.subject.scheduled_on !== null &&
      row.subject.scheduled_on < today,
  );

  return (
    <Panel>
      <PanelHeader
        title={empty ? "Prochaines publications" : "À publier"}
        count={empty ? undefined : rows.length}
        description={
          empty && next.length > 0 ? "Rien à publier aujourd'hui." : undefined
        }
        action={
          late > 0 ? (
            <StatusPill tone="danger">
              {late} en retard
            </StatusPill>
          ) : empty && next.length > 0 ? (
            <Button
              render={<Link href={nextPlanningHref(next)} />}
              variant="outline"
              size="sm"
            >
              Voir le planning
            </Button>
          ) : null
        }
      />

      {stuckValidated.length > 0 ? (
        /* Le piège silencieux : une publication validée dont la date est
           passée ne part plus toute seule — l'automatisation ne rattrape
           jamais la veille. Sans cet encart, six posts Bondet sont restés
           bloqués trois semaines sans que rien ne le dise. */
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-warning-subtle px-5 py-3">
          <AlertTriangle
            aria-hidden
            strokeWidth={1.75}
            className="size-4.5 shrink-0 text-warning-ink"
          />
          <p className="type-caption min-w-0 flex-1 font-medium text-warning-ink">
            {stuckValidated.length > 1
              ? `${stuckValidated.length} publications validées ont dépassé leur date : elles ne partiront plus toutes seules.`
              : "Une publication validée a dépassé sa date : elle ne partira plus toute seule."}
          </p>
          <RescheduleLateButton rows={stuckValidated} />
        </div>
      ) : null}

      {empty && next.length === 0 ? (
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <CalendarDays
            aria-hidden
            strokeWidth={1.75}
            className="size-5 shrink-0 text-text-tertiary"
          />
          <p className="type-body min-w-0 flex-1 text-text-secondary">
            Aucune publication programmée, ni aujourd&apos;hui ni ensuite.
          </p>
        </div>
      ) : (
        /* Aux largeurs du board, les douze colonnes dépassent la largeur
           disponible : le tableau défile dans son panneau plutôt que de
           comprimer chaque cellule jusqu'à l'illisible. */
        <div className="overflow-x-auto">
          <PublicationHeader />
          {/* Un conteneur nu, et surtout pas `PanelRows` : son `divide-y`
              doublerait le filet que chaque ligne porte déjà. Reste à retirer
              celui de la dernière, qui traînerait au ras du panneau. */}
          <div className="[&>*:last-child]:border-b-0">
            {(empty ? next : rows).map((row) => (
              <PublicationRowView key={row.subject.id} row={row} />
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

/** Le planning de la première publication à venir. */
function nextPlanningHref(next: PublicationRow[]): string {
  const first = next[0]!;
  return `/espace/${first.workspace.slug}/planning/${first.board_slug}`;
}
