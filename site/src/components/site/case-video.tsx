"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Une vidéo de cas client : muette, en boucle, sans contrôle, qui ne joue
 * que lorsqu'elle est à l'écran — six secondes de 540p, pas une seconde
 * décodée hors champ. L'affiche sert d'image tant que le fichier n'est pas
 * chargé, et reste l'image en mouvement réduit.
 *
 * La balise `<video>` n'est montée qu'à l'approche de l'écran : son attribut
 * `poster` se télécharge au chargement de la page, et le rail en compte
 * dix-sept — sans ce garde, toutes les affiches partaient avant le premier
 * rendu. D'ici là, une image en différé.
 */
export function CaseVideo({ src, poster, alt }: { src: string; poster: string; alt: string }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const node = wrapper.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
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
  }, [near]);

  return (
    <div ref={wrapper} className="h-full w-full">
      {near ? (
        <video ref={ref} src={src} poster={poster} muted loop playsInline preload="none" aria-label={alt} className="h-full w-full object-cover" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- affiche webp déjà réduite à 720 px, chargée en différé
        <img src={poster} alt={alt} loading="lazy" decoding="async" fetchPriority="low" className="h-full w-full object-cover" />
      )}
    </div>
  );
}
