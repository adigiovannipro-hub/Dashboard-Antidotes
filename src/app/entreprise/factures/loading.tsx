import {
  ChartSkeleton,
  PanelSkeleton,
  SectionHeaderSkeleton,
  StatBandSkeleton,
} from "@/components/ds/page-skeleton";

/**
 * Silhouette des Échéances.
 *
 * Quatre mesures, la courbe prévisionnelle compacte, puis les groupes par
 * statut — à facturer, facturée, payée, devis confirmé. Chaque groupe est
 * plafonné à six lignes visibles sur la page réelle : la silhouette s'y tient,
 * sinon elle promet une hauteur que le contenu ne prendra pas.
 */
export default function EcheancesLoading() {
  return (
    <div className="space-y-6">
      <StatBandSkeleton />
      <ChartSkeleton />

      <SectionHeaderSkeleton action />
      <div className="space-y-5">
        <PanelSkeleton rows={4} />
        <PanelSkeleton rows={6} />
        <PanelSkeleton rows={3} />
      </div>
    </div>
  );
}
