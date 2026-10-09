import type { ReactNode } from "react";

import { fontClassName } from "@/lib/fonts";
import type { Locale } from "@/i18n/locale";

/**
 * Le document : une racine par langue (`(fr)` et `en` ont chacune leur
 * layout) pour que `<html lang>` soit juste. La classe `no-js` tombe dès
 * que le script d'apparition tourne ; sans lui, tout est visible. Le fond
 * par défaut est la Craie du Verre clair ; les sections sombres portent
 * leur propre univers.
 */
export function Root({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <html lang={locale} className={`${fontClassName} no-js`}>
      <body className="bg-bg text-text">{children}</body>
    </html>
  );
}
