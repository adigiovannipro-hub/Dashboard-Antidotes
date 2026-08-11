import Link from "next/link";
import { CalendarDays } from "lucide-react";

import {
  PublicationHeader,
  PublicationRowView,
} from "@/components/mon-travail/publication-row";
import { Panel, PanelHeader, PanelRows } from "@/components/ds/surface";
import { StatusPill } from "@/components/ds/status-pill";
import { Button } from "@/components/ui/button";
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
  late,
}: {
  rows: PublicationRow[];
  /** Repli quand la journée est vide. */
  next: PublicationRow[];
  /** Publications antérieures à aujourd'hui, comptées par la page. */
  late: number;
}) {
  const empty = rows.length === 0;

  return (
    <Panel>
      <PanelHeader
        title={empty ? "Prochaines publications" : "À publier"}
        count={empty ? undefined : rows.length}
        description={
          empty
            ? "Rien à publier — voici ce qui arrive, par réseau."
            : late > 0
              ? "Tout ce qui n'est pas parti : les retards d'abord, en rouge, puis la suite datée."
              : "Tout ce qui n'est pas parti, du plus proche au plus lointain."
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
        /* Onze colonnes ne tiennent pas toujours dans la largeur disponible :
           le tableau défile dans son panneau plutôt que de comprimer chaque
           cellule jusqu'à l'illisible. */
        <div className="overflow-x-auto">
          <PublicationHeader />
          <PanelRows>
            {(empty ? next : rows).map((row) => (
              <PublicationRowView key={row.subject.id} row={row} />
            ))}
          </PanelRows>
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
