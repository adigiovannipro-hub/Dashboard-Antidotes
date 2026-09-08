import { PanelSkeleton, SectionHeaderSkeleton } from "@/components/ds/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function StudioPostLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-24 rounded-md" />
      <SectionHeaderSkeleton action />
      <PanelSkeleton rows={6} />
    </div>
  );
}
