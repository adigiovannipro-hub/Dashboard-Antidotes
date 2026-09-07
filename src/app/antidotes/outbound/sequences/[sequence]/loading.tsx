import { PanelSkeleton, SectionHeaderSkeleton } from "@/components/ds/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/** Silhouette d'une séquence : retour, titre, puis les panneaux. */
export default function SequenceLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-28 rounded-md" />
      <SectionHeaderSkeleton action />
      <PanelSkeleton rows={3} />
      <PanelSkeleton rows={2} />
      <PanelSkeleton rows={4} />
    </div>
  );
}
