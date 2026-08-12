import { Skeleton } from "@/components/ui/skeleton";

/**
 * Silhouette de la Modération : bande de mesures, puis l'inbox à trois
 * colonnes dans un panneau unique — filtres, conversations, fil.
 *
 * Elle couvre aussi la FAQ du même client, qui n'a pas la sienne : les deux
 * écrans partagent la bande de mesures et le grand panneau.
 */
export default function ModerationLoading() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="rounded-lg border border-border bg-surface p-5 shadow-card"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-7 w-16" />
            <Skeleton className="mt-3 h-3 w-24" />
          </div>
        ))}
      </div>

      <div className="grid gap-0 overflow-hidden rounded-lg border border-border bg-surface shadow-card lg:grid-cols-[15rem_20rem_minmax(0,1fr)]">
        {/* Filtres */}
        <div className="space-y-3 border-border p-4 lg:border-r">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-6 w-full rounded-md" />
          ))}
        </div>

        {/* Liste des conversations */}
        <div className="divide-y divide-border border-border lg:border-r">
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
        <div className="hidden space-y-4 p-5 lg:block">
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
