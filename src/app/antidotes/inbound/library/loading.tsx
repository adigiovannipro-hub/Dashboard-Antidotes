import { PanelSkeleton, SectionHeaderSkeleton, StatBandSkeleton } from "@/components/ds/page-skeleton";

export default function LibraryLoading() {
  return (
    <div className="space-y-6">
      <SectionHeaderSkeleton action />
      <StatBandSkeleton />
      <PanelSkeleton rows={4} />
    </div>
  );
}
