"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Upload, Video } from "lucide-react";

import { recordProgress } from "@/app/actions/academy";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AcademyProgressStatus, AcademyVideoProvider } from "@/lib/academy/types";
import { embedUrl, parseVideoUrl } from "@/lib/academy/video";
import { cn } from "@/lib/utils";

/**
 * Le lecteur d'une leçon.
 *
 * Trois régimes selon `video_provider` :
 *   • `supabase` — balise `<video>` native sur une URL signée demandée au
 *     montage (six heures de validité), reprise à la position sauvegardée,
 *     battement de progression toutes les quinze secondes ;
 *   • `youtube` / `vimeo` / `mux` — iframe 16:9. Un embed ne raconte pas où
 *     en est la lecture : on pose la leçon « en cours » à l'ouverture, le
 *     passage en « terminée » reste le geste manuel ;
 *   • `none` — emplacement propre, avec le chemin vers le back-office pour
 *     l'admin. La leçon se suit très bien au script en attendant sa vidéo.
 */

const TICK_SECONDS = 15;

export function AcademyVideoPlayer({
  lessonId,
  provider,
  videoUrl,
  resumeSeconds,
  durationMin,
  initialStatus,
  isAdmin,
  adminHref,
}: {
  lessonId: string;
  provider: AcademyVideoProvider;
  videoUrl: string | null;
  resumeSeconds: number;
  durationMin: number | null;
  initialStatus: AcademyProgressStatus;
  isAdmin: boolean;
  adminHref: string;
}) {
  // Un embed ne signale rien : la trace « en cours » se pose à l'ouverture,
  // une seule fois, et jamais par-dessus une leçon déjà terminée.
  const openedRef = useRef(false);
  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    if (provider === "none" || provider === "supabase") return;
    if (initialStatus !== "not_started") return;
    void recordProgress({ lessonId, seconds: 0, durationSeconds: null });
  }, [provider, initialStatus, lessonId]);

  if (provider === "none") {
    return (
      <Placeholder isAdmin={isAdmin} adminHref={adminHref} reason="Vidéo à venir" />
    );
  }

  if (provider === "supabase") {
    return (
      <NativePlayer
        lessonId={lessonId}
        resumeSeconds={resumeSeconds}
        durationMin={durationMin}
      />
    );
  }

  const parsed = videoUrl ? parseVideoUrl(videoUrl) : null;
  if (!parsed) {
    return (
      <Placeholder
        isAdmin={isAdmin}
        adminHref={adminHref}
        reason="L'URL de cette vidéo n'est pas reconnue"
      />
    );
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-surface-sunken">
      <iframe
        src={embedUrl(parsed)}
        title="Vidéo de la leçon"
        className="size-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  );
}

function NativePlayer({
  lessonId,
  resumeSeconds,
  durationMin,
}: {
  lessonId: string;
  resumeSeconds: number;
  durationMin: number | null;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const lastSentRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/academy/video/${lessonId}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { url?: string };
        if (!cancelled && body.url) setSrc(body.url);
        else if (!cancelled) setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  const save = useCallback(
    (element: HTMLVideoElement) => {
      const seconds = Math.floor(element.currentTime);
      const durationSeconds = Number.isFinite(element.duration)
        ? Math.floor(element.duration)
        : durationMin
          ? durationMin * 60
          : null;
      lastSentRef.current = seconds;
      void recordProgress({ lessonId, seconds, durationSeconds });
    },
    [lessonId, durationMin],
  );

  if (failed) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-border bg-surface-sunken">
        <p className="type-body text-text-secondary">
          La vidéo est indisponible pour le moment.
        </p>
      </div>
    );
  }

  if (!src) {
    return <Skeleton className="aspect-video w-full rounded-lg" />;
  }

  return (
    <video
      src={src}
      controls
      preload="metadata"
      className="aspect-video w-full rounded-lg border border-border bg-black"
      onLoadedMetadata={(event) => {
        const element = event.currentTarget;
        // Reprise à la position sauvegardée — sauf tout près de la fin, où
        // reprendre sur le générique se lirait comme un lecteur cassé.
        if (
          resumeSeconds > 5 &&
          Number.isFinite(element.duration) &&
          resumeSeconds < element.duration - 5
        ) {
          element.currentTime = resumeSeconds;
        }
      }}
      onTimeUpdate={(event) => {
        const element = event.currentTarget;
        if (element.paused) return;
        if (Math.floor(element.currentTime) - lastSentRef.current >= TICK_SECONDS) {
          save(element);
        }
      }}
      onPause={(event) => save(event.currentTarget)}
      onEnded={(event) => save(event.currentTarget)}
    />
  );
}

function Placeholder({
  isAdmin,
  adminHref,
  reason,
}: {
  isAdmin: boolean;
  adminHref: string;
  reason: string;
}) {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border-strong bg-surface-sunken">
      <Video aria-hidden strokeWidth={1.75} className="size-5 text-text-tertiary" />
      <p className="type-body text-text-secondary">{reason} — le script se lit dès maintenant.</p>
      {isAdmin ? (
        <Link
          href={adminHref}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <Upload data-icon="inline-start" aria-hidden strokeWidth={1.75} />
          Uploader une vidéo
        </Link>
      ) : null}
    </div>
  );
}
