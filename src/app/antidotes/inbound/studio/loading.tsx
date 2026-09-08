import { PanelSkeleton, SectionHeaderSkeleton, StatBandSkeleton } from "@/components/ds/page-skeleton";

export default function StudioLoading() {
  return (
    <div className="space-y-6">
      <SectionHeaderSkeleton />
      <StatBandSkeleton />
      <PanelSkeleton rows={3} />
      <PanelSkeleton rows={4} />
    </div>
  );
}
