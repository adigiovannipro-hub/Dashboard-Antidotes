"use client";

import { useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * L'état d'affichage de l'inbound vit dans l'URL — vue, filtres, tri, ligne
 * ouverte — mais **sans repasser par le serveur**.
 *
 * C'est la réponse au reproche « le panneau met très longtemps à s'ouvrir » :
 * un `router.push` reconstruisait la page entière pour retrouver des données
 * qu'elle portait déjà. `window.history.pushState` change l'adresse, Next
 * resynchronise `useSearchParams`, et le rendu suit dans la foulée. L'écran
 * reste partageable par copie du lien et le retour arrière ramène exactement
 * ce qu'on regardait, ce qu'un simple `useState` aurait perdu.
 */
export function useInboundUrl() {
  const pathname = usePathname();
  const params = useSearchParams();
  const search = params.toString();

  const hrefFor = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(search);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [pathname, search],
  );

  const go = useCallback(
    (patch: Record<string, string | null>, mode: "push" | "replace" = "push") => {
      const url = hrefFor(patch);
      if (mode === "replace") window.history.replaceState(null, "", url);
      else window.history.pushState(null, "", url);
    },
    [hrefFor],
  );

  return { params, hrefFor, go };
}
