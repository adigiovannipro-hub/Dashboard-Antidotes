import { Skeleton } from "@/components/ui/skeleton";

/**
 * Silhouette de l'inbox croisée : les onglets de canaux et leurs filtres,
 * puis les deux volets — liste, fil — dans un panneau unique.
 */
export default function ModerationLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 w-[26rem] max-w-full rounded-pill" />
        <Skeleton className="ml-auto h-9 w-40 rounded-md" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-6 w-24 rounded-pill" />
        ))}
      </div>

      <div className="grid gap-0 overflow-hidden rounded-lg border border-border bg-surface shadow-card md:grid-cols-[24rem_minmax(0,1fr)]">
        {/* Liste des conversations */}
        <div className="divide-y divide-border border-border md:border-r">
          {Array.from({ length: 7 }, (_, index) => (
            <div key={index} className="space-y-2 p-4">
              <div className="flex items-center gap-2">
                <Skeleton className="size-6 shrink-0 rounded-pill" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="ml-auto h-3 w-10" />
              </div>
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>

        {/* Fil de la conversation ouverte */}
        <div className="hidden space-y-4 p-5 md:block">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-20 w-4/5 rounded-md" />
          <Skeleton className="ml-auto h-16 w-3/5 rounded-md" />
          <Skeleton className="h-20 w-4/5 rounded-md" />
          <Skeleton className="h-24 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}
