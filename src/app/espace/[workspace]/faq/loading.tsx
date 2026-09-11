import { BoardSkeleton } from "@/components/ds/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Silhouette de la FAQ : la barre de recherche, puis le tableau. Même ordre de
 * lecture que l'écran réel, pour qu'il ne saute pas au remplacement.
 */
export default function FaqLoading() {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-64 rounded-md" />
        <Skeleton className="h-3.5 w-12" />
      </div>
      <BoardSkeleton rows={10} />
    </div>
  );
}
