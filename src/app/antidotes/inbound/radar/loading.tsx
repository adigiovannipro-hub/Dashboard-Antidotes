import { PanelSkeleton, SectionHeaderSkeleton, StatBandSkeleton } from "@/components/ds/page-skeleton";

export default function RadarLoading() {
  return (
    <div className="space-y-6">
      <SectionHeaderSkeleton action />
      <StatBandSkeleton />
      <PanelSkeleton rows={4} />
      <PanelSkeleton rows={3} />
    </div>
  );
}
