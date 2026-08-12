import {
  ChartSkeleton,
  PanelSkeleton,
  SectionHeaderSkeleton,
  StatBandSkeleton,
} from "@/components/ds/page-skeleton";

/**
 * Silhouette d'un tableau de bord de reporting.
 *
 * Dix cartes de mesures en tête — deux bandes de quatre puis une de deux —,
 * les donuts Persona et la courbe d'abonnés côte à côte, le tableau des
 * ensembles de publicités en bas. La forme compte : c'est un écran de chiffres,
 * et un rectangle unique à sa place ferait sauter toute la page à l'arrivée.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <StatBandSkeleton />
      <StatBandSkeleton />

      <SectionHeaderSkeleton />
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>

      <SectionHeaderSkeleton />
      <PanelSkeleton rows={6} />
    </div>
  );
}
