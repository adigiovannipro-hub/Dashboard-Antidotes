"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Plus, Trash2, X } from "lucide-react";

import { isImagePath } from "@/lib/planning/storage";
import type { ResolvedVisual } from "@/lib/planning/types";
import { cn } from "@/lib/utils";

/**
 * Le carrousel à cartes, partagé entre le panneau latéral et le plein écran.
 *
 * Pas de flou, pas de bandes : chaque visuel est une **carte** aux coins
 * arrondis, bordée de gris, posée telle quelle. Les diapos défilent en scroll
 * horizontal aimanté, et une carte ne prend pas toute la largeur — le bord de
 * la suivante dépasse, c'est l'invitation à glisser.
 */
export function useSnapCarousel(count: number, initialIndex = 0) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(Math.min(initialIndex, Math.max(count - 1, 0)));

  const scrollTo = useCallback((next: number, smooth = true) => {
    const track = trackRef.current;
    if (!track) return;
    const slide = track.children[next] as HTMLElement | undefined;
    if (!slide) return;
    track.scrollTo({
      left: slide.offsetLeft - (track.clientWidth - slide.clientWidth) / 2,
      behavior: smooth ? "smooth" : "instant",
    });
  }, []);

  // La diapo de départ, avant peinture — sans ça, l'écran ouvre sur la
  // première puis saute.
  useEffect(() => {
    scrollTo(index, false);
    // Volontairement au montage seul : ensuite, c'est le scroll qui pilote.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    let best = 0;
    let bestDistance = Infinity;
    [...track.children].forEach((child, i) => {
      const el = child as HTMLElement;
      const distance = Math.abs(el.offsetLeft + el.clientWidth / 2 - center);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    setIndex(best);
  }, []);

  const prev = useCallback(
    () => scrollTo(Math.max(index - 1, 0)),
    [index, scrollTo],
  );
  const next = useCallback(
    () => scrollTo(Math.min(index + 1, count - 1)),
    [index, count, scrollTo],
  );

  return { trackRef, index, scrollTo, onScroll, prev, next };
}

/** Image, vidéo ou pièce jointe — la carte du carrousel. */
export function VisualSlideMedia({
  visual,
  className,
  onClick,
}: {
  visual: ResolvedVisual;
  className?: string;
  onClick?: () => void;
}) {
  const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(visual.path);
  const isImage = isImagePath(visual.path) && !!visual.url;

  // La carte : coins arrondis, bord gris — le « type card » demandé. Pas de
  // dimension imposée : le média garde ses proportions et grandit jusqu'aux
  // plafonds passés en `className` — une 4:5 remplit la largeur du panneau,
  // une story remplit la hauteur, jamais de bande.
  const card = cn(
    "max-w-full rounded-xl border border-neutral-600/60 bg-neutral-950 object-contain",
    className,
  );

  if (isVideo && visual.url) {
    // Type reels : la vidéo se tient verticale, sans rien autour.
    return (
      <video src={visual.url} controls playsInline className={card}>
        <track kind="captions" />
      </video>
    );
  }

  if (isImage) {
    const img = (
      // eslint-disable-next-line @next/next/no-img-element -- URL signée
      <img src={visual.url} alt={visual.name} className={card} />
    );
    if (!onClick) return img;
    return (
      // `max-w-full`/`max-h-full` : le bouton s'efface — sans lui dans la
      // chaîne, l'image ne serait plus bornée par la diapo.
      <button
        type="button"
        onClick={onClick}
        title="Afficher en plein écran"
        aria-label={`Afficher ${visual.name} en plein écran`}
        className="flex max-h-full max-w-full cursor-zoom-in justify-center outline-none"
      >
        {img}
      </button>
    );
  }

  return (
    <a
      href={visual.url || undefined}
      target="_blank"
      rel="noreferrer"
      className={cn(
        card,
        "flex max-w-xs items-center justify-center p-6 text-center text-sm break-all text-neutral-200 underline-offset-2 hover:underline",
      )}
    >
      {visual.name}
    </a>
  );
}

export function CarouselArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  disabled?: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "prev" ? ArrowLeft : ArrowRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "prev" ? "Visuel précédent" : "Visuel suivant"}
      className={cn(
        // z-20 : au-dessus des cartes — des flèches sous le visuel ne se
        // cliquaient pas.
        "absolute top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/55 p-2.5 text-white transition-colors hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:opacity-0",
        direction === "prev" ? "left-3" : "right-3",
      )}
    >
      <Icon className="size-5" aria-hidden />
    </button>
  );
}

/**
 * La visionneuse plein écran : les mêmes cartes, sur un aplat sombre uni.
 */
export function VisualLightbox({
  visuals,
  initialIndex = 0,
  subjectName,
  uploading,
  onClose,
  onUpload,
  onRemove,
}: {
  visuals: ResolvedVisual[];
  initialIndex?: number;
  subjectName: string;
  uploading: boolean;
  onClose: () => void;
  onUpload: (files: File[]) => void;
  onRemove: (path: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { trackRef, index, scrollTo, onScroll, prev, next } = useSnapCarousel(
    visuals.length,
    initialIndex,
  );
  const current = visuals[Math.min(index, Math.max(visuals.length - 1, 0))];

  // Plein écran oblige : la page derrière ne défile plus, et le clavier
  // navigue — flèches pour changer de carte, Échap pour sortir.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") prev();
      if (event.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, prev, next]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Visuels de ${subjectName || "la publication"}`}
      data-lightbox
      className="animate-in fade-in fixed inset-0 z-50 flex flex-col bg-neutral-950 duration-200"
    >
      {/* --- Barre du haut : contexte à gauche, actions à droite --- */}
      <div className="relative z-10 flex items-center gap-3 px-4 py-3 text-white">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">
          {subjectName || "Publication"}
          {visuals.length > 0 ? (
            <span className="ml-2 text-xs text-white/60 tabular-nums">
              {index + 1} / {visuals.length}
            </span>
          ) : null}
        </p>

        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          accept="image/*,video/mp4,video/quicktime,application/pdf"
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            if (files.length > 0) onUpload(files);
            event.target.value = "";
          }}
        />
        <LightboxAction
          label={uploading ? "Envoi…" : "Ajouter des visuels"}
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Plus className="size-4" aria-hidden />
        </LightboxAction>
        {current ? (
          <LightboxAction
            label={`Retirer ${current.name}`}
            onClick={() => {
              onRemove(current.path);
              if (visuals.length <= 1) onClose();
              else scrollTo(0, false);
            }}
          >
            <Trash2 className="size-4" aria-hidden />
          </LightboxAction>
        ) : null}
        <LightboxAction label="Fermer" onClick={onClose}>
          <X className="size-4" aria-hidden />
        </LightboxAction>
      </div>

      {/* --- Les cartes — la suivante dépasse, le clic à côté referme --- */}
      <div className="relative min-h-0 flex-1">
        {visuals.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-neutral-400">
            Aucun visuel
          </p>
        ) : (
          <div
            ref={trackRef}
            onScroll={onScroll}
            onClick={(event) => {
              if (event.target === event.currentTarget) onClose();
            }}
            className="flex h-full snap-x snap-mandatory items-center gap-4 overflow-x-auto px-[7vw] py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {visuals.map((visual) => (
              <div
                key={visual.path}
                className="flex h-full max-w-[86vw] shrink-0 snap-center items-center justify-center"
              >
                <VisualSlideMedia visual={visual} className="max-h-full" />
              </div>
            ))}
          </div>
        )}

        {visuals.length > 1 ? (
          <>
            <CarouselArrow direction="prev" disabled={index === 0} onClick={prev} />
            <CarouselArrow
              direction="next"
              disabled={index === visuals.length - 1}
              onClick={next}
            />
          </>
        ) : null}
      </div>

      {/* --- Les vignettes, pour sauter directement à un visuel --- */}
      {visuals.length > 1 ? (
        <div className="relative z-10 flex justify-center gap-2 overflow-x-auto px-4 py-3">
          {visuals.map((visual, i) => (
            <button
              key={visual.path}
              type="button"
              onClick={() => scrollTo(i)}
              aria-label={`Visuel ${i + 1}`}
              aria-current={i === index}
              className={cn(
                "size-12 shrink-0 overflow-hidden rounded-md transition-opacity",
                i === index ? "opacity-100 ring-2 ring-white" : "opacity-50 hover:opacity-80",
              )}
            >
              {isImagePath(visual.path) && visual.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL signée
                <img src={visual.url} alt="" className="size-full object-cover" loading="lazy" />
              ) : (
                <span className="flex size-full items-center justify-center bg-neutral-800 p-1 text-center text-[8px] break-all text-neutral-300">
                  {visual.name.slice(0, 14)}
                </span>
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LightboxAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}
