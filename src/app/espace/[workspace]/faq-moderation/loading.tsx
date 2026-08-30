import { PanelSkeleton } from "@/components/ds/page-skeleton";

/** Squelette de la FAQ Modération côté client : un panneau, des rangées. */
export default function FaqModerationLoading() {
  return <PanelSkeleton rows={6} />;
}
