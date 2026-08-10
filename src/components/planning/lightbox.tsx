"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Plus, Trash2, X } from "lucide-react";

import { isImagePath } from "@/lib/planning/storage";
import type { ResolvedVisual } from "@/lib/planning/types";
import { cn } from "@/lib/utils";

/**
 * La visionneuse plein écran des visuels.
 *
 * Une créa se regarde en entier, sur tout l'écran — pas recadrée en carré ni
 * vignettée dans une boîte. Et pas de bandes mortes autour d'un format
 * vertical : le fond est **le visuel lui-même**, étiré et flouté, comme sur
 * Instagram. L'image nette flotte dessus, sans bordure ni cadre.
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
  const [index, setIndex] = useState(initialIndex);
  const inputRef = useRef<HTMLInputElement>(null);

  const safeIndex = Math.min(index, Math.max(visuals.length - 1, 0));
  const current = visuals[safeIndex];

  const prev = () => setIndex((i) => (i - 1 + visuals.length) % visuals.length);
  const next = () => setIndex((i) => (i + 1) % visuals.length);

  // Plein écran oblige : la page derrière ne défile plus, et le clavier
  // navigue — flèches pour passer d'un visuel à l'autre, Échap pour sortir.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const count = visuals.length;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (count > 1 && event.key === "ArrowLeft") {
        setIndex((i) => (i - 1 + count) % count);
      }
      if (count > 1 && event.key === "ArrowRight") {
        setIndex((i) => (i + 1) % count);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [visuals.length, onClose]);

  const isImage = current ? isImagePath(current.path) && !!current.url : false;
  const isVideo = current ? /\.(mp4|mov|webm)(\?|$)/i.test(current.path) : false;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Visuels de ${subjectName || "la publication"}`}
      className="animate-in fade-in fixed inset-0 z-50 flex flex-col bg-neutral-950 duration-200"
    >
      {/* Le fond : le visuel courant, couvrant, flouté — jamais de bande. */}
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL signée
        <img
          src={current!.url}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full scale-110 object-cover opacity-40 blur-3xl"
        />
      ) : null}

      {/* --- Barre du haut : contexte à gauche, actions à droite --- */}
      <div className="relative z-10 flex items-center gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 py-3 text-white">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">
          {subjectName || "Publication"}
          {visuals.length > 0 ? (
            <span className="ml-2 text-xs text-white/60 tabular-nums">
              {safeIndex + 1} / {visuals.length}
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
              else setIndex(0);
            }}
          >
            <Trash2 className="size-4" aria-hidden />
          </LightboxAction>
        ) : null}
        <LightboxAction label="Fermer" onClick={onClose}>
          <X className="size-4" aria-hidden />
        </LightboxAction>
      </div>

      {/* --- Le visuel, en grand — le clic à côté referme --- */}
      <div
        className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-4"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        {current ? (
          isVideo && current.url ? (
            <video
              src={current.url}
              controls
              autoPlay
              playsInline
              className="max-h-full max-w-full"
            >
              <track kind="captions" />
            </video>
          ) : isImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL signée
            <img
              src={current.url}
              alt={current.name}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <a
              href={current.url || undefined}
              target="_blank"
              rel="noreferrer"
              className="max-w-md p-6 text-center text-sm break-all text-neutral-200 underline-offset-2 hover:underline"
            >
              {current.name}
            </a>
          )
        ) : (
          <p className="text-sm text-neutral-400">Aucun visuel</p>
        )}

        {visuals.length > 1 ? (
          <>
            <LightboxArrow direction="prev" onClick={prev} />
            <LightboxArrow direction="next" onClick={next} />
          </>
        ) : null}
      </div>

      {/* --- Les vignettes, pour sauter directement à un visuel --- */}
      {visuals.length > 1 ? (
        <div className="relative z-10 flex justify-center gap-2 overflow-x-auto bg-gradient-to-t from-black/70 to-transparent px-4 py-3">
          {visuals.map((visual, i) => (
            <button
              key={visual.path}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Visuel ${i + 1}`}
              aria-current={i === safeIndex}
              className={cn(
                "size-12 shrink-0 overflow-hidden rounded-md transition-opacity",
                i === safeIndex ? "opacity-100 ring-2 ring-white" : "opacity-50 hover:opacity-80",
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

function LightboxArrow({
  direction,
  onClick,
}: {
  direction: "prev" | "next";
  onClick: () => void;
}) {
  const Icon = direction === "prev" ? ArrowLeft : ArrowRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "prev" ? "Visuel précédent" : "Visuel suivant"}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2.5 text-white transition-colors hover:bg-black/75 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
        direction === "prev" ? "left-4" : "right-4",
      )}
    >
      <Icon className="size-5" aria-hidden />
    </button>
  );
}
