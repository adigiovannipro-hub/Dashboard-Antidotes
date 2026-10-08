"use client";

import { useEffect } from "react";

/**
 * Pose `is-visible` sur chaque `.reveal` qui entre dans l'écran — une fois.
 * Sans JavaScript, `.no-js` sur <html> laisse tout visible d'emblée.
 */
export function RevealObserver() {
  useEffect(() => {
    document.documentElement.classList.remove("no-js");
    const nodes = document.querySelectorAll<HTMLElement>(".reveal");
    if (!("IntersectionObserver" in window)) {
      nodes.forEach((n) => n.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);
  return null;
}
