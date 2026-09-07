import { SectionHeaderSkeleton, StatBandSkeleton } from "@/components/ds/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Silhouette du pipeline : le titre, la bande de mesures, la barre de
 * filtres, puis les colonnes — la forme du kanban, qui est la vue par défaut.
 */
export default function PipelineLoading() {
  return (
    <div className="space-y-6">
      <SectionHeaderSkeleton action />
      <StatBandSkeleton />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-8 w-28 rounded-md" />
        ))}
      </div>
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="w-64 shrink-0 space-y-2 rounded-lg border border-border bg-surface-sunken p-2"
          >
            <Skeleton className="mx-1 mt-1 h-4 w-24" />
            <Skeleton className="h-20 rounded-md" />
            <Skeleton className="h-20 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
