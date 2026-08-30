"use client";

import { FileDown } from "lucide-react";

/**
 * « PDF » : l'impression du navigateur, feuille de style print à l'appui.
 *
 * Volontairement pas de rendu serveur (puppeteer, react-pdf) : hors free
 * tier, et le moteur d'impression du navigateur suffit à un rapport propre —
 * `@media print` masque la navigation et met les cartes à plat.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      title="Enregistrer ce rapport en PDF"
      className="print-cacher border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:ring-brand inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <FileDown className="size-4" strokeWidth={1.75} aria-hidden />
      PDF
    </button>
  );
}
