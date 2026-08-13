import { BoardSkeleton } from "@/components/ds/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Silhouette du Planning Éditorial.
 *
 * C'est la page la plus lourde de l'application — mois, réseaux, publications,
 * colonnes personnalisées, visuels signés — donc celle dont l'attente se
 * remarque le plus. La silhouette rejoue l'ordre de lecture réel : les onglets
 * de tableau soulignés, la barre d'outils, puis le tableau.
 *
 * Elle couvre aussi `[board]`, qui n'a pas la sienne : les deux affichent le
 * même écran, seul le tableau ouvert change.
 */
export default function PlanningLoading() {
  return (
    <div className="space-y-4">
      {/* Onglets de tableau : soulignés, jamais en pastilles — deux rangées de
          pastilles identiques mentiraient sur la hiérarchie. */}
      <div className="flex items-center gap-6 border-b border-border pb-2.5">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-3.5 w-16" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-8 w-56 rounded-md" />
        <Skeleton className="ml-auto h-8 w-28 rounded-md" />
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>

      <BoardSkeleton rows={10} />
    </div>
  );
}
