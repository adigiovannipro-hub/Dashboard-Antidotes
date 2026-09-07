import {
  PanelSkeleton,
  SectionHeaderSkeleton,
  StatBandSkeleton,
} from "@/components/ds/page-skeleton";

/** Silhouette du sourcing : titre, mesures, puis la liste des campagnes. */
export default function SourcingLoading() {
  return (
    <div className="space-y-6">
      <SectionHeaderSkeleton action />
      <StatBandSkeleton />
      <PanelSkeleton rows={3} />
    </div>
  );
}
