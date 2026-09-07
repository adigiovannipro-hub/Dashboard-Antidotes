import { PanelSkeleton, SectionHeaderSkeleton, StatBandSkeleton } from "@/components/ds/page-skeleton";

/** Silhouette des séquences : titre, mesures, puis la liste. */
export default function SequencesLoading() {
  return (
    <div className="space-y-6">
      <SectionHeaderSkeleton action />
      <StatBandSkeleton />
      <PanelSkeleton rows={3} />
    </div>
  );
}
