import { PanelSkeleton, SectionHeaderSkeleton } from "@/components/ds/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/** Silhouette d'une campagne : le titre et son bouton, puis les panneaux de réglages. */
export default function CampaignLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-28 rounded-md" />
      <SectionHeaderSkeleton action />
      <PanelSkeleton rows={2} />
      <PanelSkeleton rows={4} />
      <PanelSkeleton rows={4} />
    </div>
  );
}
