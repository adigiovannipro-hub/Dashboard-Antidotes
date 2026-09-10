import { PanelSkeleton, SectionHeaderSkeleton } from "@/components/ds/page-skeleton";

export default function InboundLoading() {
  return (
    <div className="space-y-6">
      <SectionHeaderSkeleton action />
      <PanelSkeleton rows={6} />
    </div>
  );
}
