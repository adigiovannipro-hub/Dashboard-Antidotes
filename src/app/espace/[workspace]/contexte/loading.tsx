import {
  PanelSkeleton,
  SectionHeaderSkeleton,
  StatBandSkeleton,
} from "@/components/ds/page-skeleton";

/**
 * Silhouette du Contexte client.
 *
 * Trois familles sous leur titre — la marque, le contenu, la parole — puis les
 * documents et l'historique. La bande de mesures est en tête, comme sur la
 * page réelle : c'est elle qui porte le volume dû chaque mois.
 */
export default function ContexteLoading() {
  return (
    <div className="space-y-6">
      <StatBandSkeleton />

      <SectionHeaderSkeleton />
      <div className="grid gap-5 lg:grid-cols-12">
        <PanelSkeleton rows={4} className="lg:col-span-7" />
        <div className="space-y-5 lg:col-span-5">
          <PanelSkeleton rows={2} />
          <PanelSkeleton rows={2} />
        </div>
      </div>

      <SectionHeaderSkeleton />
      <div className="grid gap-5 md:grid-cols-2">
        <PanelSkeleton rows={3} />
        <PanelSkeleton rows={3} />
      </div>

      <SectionHeaderSkeleton action />
      <PanelSkeleton rows={4} />
    </div>
  );
}
