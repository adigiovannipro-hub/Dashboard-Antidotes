"use client";

import { useEffect, useRef } from "react";

/**
 * Une vidéo de cas client : muette, en boucle, sans contrôle, qui ne joue
 * que lorsqu'elle est à l'écran — six secondes de 540p, pas une seconde
 * décodée hors champ. L'affiche sert d'image tant que le fichier n'est pas
 * chargé, et reste l'image en mouvement réduit.
 */
export function CaseVideo({ src, poster, alt }: { src: string; poster: string; alt: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            video.play().catch(() => {
              /* Lecture refusée (données économisées, règle du navigateur) : l'affiche reste. */
            });
          } else {
            video.pause();
          }
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      aria-label={alt}
      className="h-full w-full object-cover"
    />
  );
}
