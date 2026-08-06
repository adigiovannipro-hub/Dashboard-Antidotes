import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { PublicationRowView } from "@/components/mon-travail/publication-row";
import { Panel, PanelHeader, PanelRows } from "@/components/ds/surface";
import { Button } from "@/components/ui/button";
import { shortDate } from "@/lib/mon-travail/dates";
import type { PublicationRow } from "@/lib/mon-travail/types";

/**
 * « À publier » : les lignes de publication du jour, tous clients confondus,
 * pour vérifier que ce qui devait partir est bien parti. Ce qui est déjà
 * marqué publié n'apparaît plus ici — il a rejoint « Archivé » en bas de page.
 *
 * Une journée vide ne se solde pas par une phrase et du blanc : le panneau
 * bascule sur les prochaines publications datées. La question qui suit
 * « rien aujourd'hui » est toujours « et ensuite ? ».
 */
export function PublicationsSection({
  rows,
  next,
}: {
  rows: PublicationRow[];
  /** Repli quand la journée est vide. */
  next: PublicationRow[];
}) {
  const empty = rows.length === 0;

  return (
    <Panel>
      <PanelHeader
        title={empty ? "Prochaines publications" : "À publier"}
        count={empty ? undefined : rows.length}
        description={
          empty
            ? "Rien à publier aujourd'hui — voici ce qui arrive."
            : "Aujourd'hui, tous clients confondus."
        }
        action={
          empty && next.length > 0 ? (
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

      {empty && next.length === 0 ? (
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <CalendarDays
            aria-hidden
            strokeWidth={1.75}
            className="size-5 shrink-0 text-text-tertiary"
          />
          <p className="text-body min-w-0 flex-1 text-text-secondary">
            Aucune publication programmée, ni aujourd&apos;hui ni ensuite.
          </p>
        </div>
      ) : (
        <PanelRows>
          {(empty ? next : rows).map((row) => (
            <PublicationRowView
              key={row.subject.id}
              row={row}
              dateBadge={
                empty && row.subject.scheduled_on
                  ? shortDate(row.subject.scheduled_on)
                  : undefined
              }
            />
          ))}
        </PanelRows>
      )}
    </Panel>
  );
}

/** Le planning de la première publication à venir. */
function nextPlanningHref(next: PublicationRow[]): string {
  const first = next[0]!;
  return `/espace/${first.workspace.slug}/planning/${first.board_slug}`;
}
