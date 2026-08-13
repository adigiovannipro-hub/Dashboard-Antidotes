import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Les silhouettes de chargement, dans le vocabulaire des pages.
 *
 * ── Pourquoi ça compte plus qu'un joli détail ───────────────────────────────
 *
 * Toutes les pages sont rendues par le serveur : entre le clic sur un onglet
 * et l'arrivée de l'écran, le navigateur affiche **la page précédente**, sans
 * rien dire. Un `loading.tsx` posé sur un segment change deux choses à la
 * fois :
 *
 *   1. Next diffuse la coquille immédiatement et le contenu ensuite, au lieu
 *      d'attendre que la dernière requête de la page soit revenue pour
 *      commencer à écrire quoi que ce soit.
 *   2. Le préchargement des liens devient utile : `<Link>` va chercher la
 *      frontière de chargement à l'avance, donc **le squelette s'affiche sans
 *      aucun aller-retour** au moment du clic. Sans `loading.tsx`, une route
 *      dynamique n'a rien à précharger, et le clic reste muet aussi longtemps
 *      que dure la requête.
 *
 * D'où la règle : une silhouette **de la bonne forme**, pas un rectangle. Elle
 * doit occuper la place que le contenu prendra, sinon on remplace une attente
 * silencieuse par un saut de mise en page à l'arrivée.
 *
 * Ces composants ne s'emploient que dans un `loading.tsx`, donc toujours à
 * l'intérieur d'un layout qui a déjà rendu le rail et la barre de page : le
 * cadre ne clignote jamais, seul le contenu se recompose.
 */

/** La bande de mesures : quatre cartes, deux colonnes au téléphone. */
export function StatBandSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
      {Array.from({ length: cards }, (_, index) => (
        <div
          key={index}
          className="rounded-lg border border-border bg-surface p-5 shadow-card"
        >
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="size-9 rounded-md" />
          </div>
          <Skeleton className="mt-3 h-7 w-24" />
          <Skeleton className="mt-3 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

/**
 * Un panneau et ses rangées. `rows` cale la hauteur sur ce que la page affiche
 * d'habitude — une silhouette trop courte fait remonter le reste à l'arrivée.
 */
export function PanelSkeleton({
  rows = 4,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-surface shadow-card",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-3 px-5 py-3">
            <Skeleton className="size-5 shrink-0 rounded-pill" />
            <Skeleton className="h-3.5 min-w-0 flex-1" />
            <Skeleton className="hidden h-3.5 w-24 shrink-0 md:block" />
            <Skeleton className="h-5 w-20 shrink-0 rounded-pill" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Le titre d'une section, entre deux panneaux. */
export function SectionHeaderSkeleton({ action }: { action?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-3 w-56" />
      </div>
      {action ? <Skeleton className="h-8 w-28 shrink-0 rounded-md" /> : null}
    </div>
  );
}

/** Une zone de graphique : l'aire, puis la légende. */
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface p-5 shadow-card",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-7 w-40 rounded-pill" />
      </div>
      <Skeleton className="mt-5 h-56 rounded-md" />
    </div>
  );
}

/** Une grille de cartes — espaces clients, tableaux de bord. */
export function CardGridSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: cards }, (_, index) => (
        <div
          key={index}
          className="rounded-lg border border-border bg-surface p-5 shadow-card"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="size-8 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
          <Skeleton className="mt-4 h-1 w-full rounded-pill" />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
          <Skeleton className="mt-4 h-8 w-full rounded-md" />
        </div>
      ))}
    </div>
  );
}

/**
 * Le tableau dense du Planning : en-tête de colonnes puis rangées.
 *
 * Volontairement sans bordures verticales — la silhouette dit « un tableau
 * arrive », elle ne rejoue pas la grille colonne par colonne, qui dépend des
 * colonnes personnalisées de chaque client.
 */
export function BoardSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
      <div className="flex items-center gap-3 border-b border-border bg-surface-sunken px-4 py-2.5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="ml-auto h-3 w-16" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-3 px-4 py-2">
            <Skeleton className="size-4 shrink-0 rounded-sm" />
            <Skeleton className="h-3.5 min-w-0 flex-1" />
            <Skeleton className="h-6 w-24 shrink-0 rounded-sm" />
            <Skeleton className="hidden h-6 w-20 shrink-0 rounded-sm md:block" />
            <Skeleton className="hidden h-3.5 w-16 shrink-0 md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
