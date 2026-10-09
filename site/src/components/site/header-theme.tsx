"use client";

import { useEffect } from "react";

/**
 * L'en-tête est collant et en verre : il change d'univers avec la section
 * qui passe dessous. Une section sombre porte `data-univers="sombre"` ; quand
 * l'une d'elles couvre la bande des 64 premiers pixels, l'en-tête prend
 * `.theme-dark` (lettres Craie, point Signal), sinon il redevient clair.
 * Le serveur le rend sombre d'emblée : la page s'ouvre sur le hero.
 */
export function HeaderTheme({ targetId }: { targetId: string }) {
  useEffect(() => {
    const header = document.getElementById(targetId);
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-univers="sombre"]'));
    if (!header || !("IntersectionObserver" in window)) return;
    let observer: IntersectionObserver | null = null;
    const watch = () => {
      observer?.disconnect();
      const under = new Set<Element>();
      // La bande observée : les 64 px du haut de l'écran, là où vit l'en-tête.
      // `rootMargin` n'accepte que des px ou des %, d'où le calcul à la main.
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) under.add(entry.target);
            else under.delete(entry.target);
          }
          header.classList.toggle("theme-dark", under.size > 0);
        },
        { rootMargin: `0px 0px -${Math.max(0, window.innerHeight - 64)}px 0px`, threshold: 0 },
      );
      sections.forEach((section) => observer?.observe(section));
    };
    watch();
    window.addEventListener("resize", watch, { passive: true });
    return () => {
      window.removeEventListener("resize", watch);
      observer?.disconnect();
    };
  }, [targetId]);
  return null;
}
