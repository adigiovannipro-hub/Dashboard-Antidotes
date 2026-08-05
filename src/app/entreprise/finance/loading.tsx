import { Skeleton } from "@/components/ui/skeleton";

/**
 * Squelette de l'écran Finance — la silhouette des quatre blocs, pour que le
 * chargement ne fasse pas sauter la mise en page à l'arrivée des données.
 */
export default function FinanceLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-56" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>

      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-96 rounded-xl" />
    </main>
  );
}
