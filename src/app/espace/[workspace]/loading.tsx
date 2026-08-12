import {
  PanelSkeleton,
  SectionHeaderSkeleton,
  StatBandSkeleton,
} from "@/components/ds/page-skeleton";

/**
 * Silhouette de repli d'un espace client.
 *
 * Elle sert la porte d'entrée — celle qui redirige vers la première page — et
 * toute section qui n'aurait pas sa propre silhouette. Les trois sections
 * réelles ont la leur, calée sur ce qu'elles affichent.
 *
 * Rendue **dans** le layout de l'espace : le rail, la barre de page et les
 * onglets sont déjà là et ne bougent pas. Seul le contenu se recompose, ce qui
 * est précisément ce qu'on veut voir en passant du Planning au Contexte.
 */
export default function WorkspaceLoading() {
  return (
    <div className="space-y-6">
      <StatBandSkeleton />
      <SectionHeaderSkeleton />
      <PanelSkeleton rows={5} />
    </div>
  );
}
