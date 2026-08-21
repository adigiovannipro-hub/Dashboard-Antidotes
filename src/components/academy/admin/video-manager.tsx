"use client";

import { useRef, useState, useTransition } from "react";
import { Link2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { setLessonVideoUrl } from "@/app/actions/academy";
import { StatusPill } from "@/components/ds/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadVideoFromBrowser } from "@/lib/academy/upload-client";
import { VIDEO_PROVIDER_LABELS, type AcademyVideoProvider } from "@/lib/academy/types";
import { cn } from "@/lib/utils";

/**
 * La vidéo d'une leçon, côté back-office.
 *
 * Deux chemins et pas un de plus : coller une URL YouTube/Vimeo/Mux, ou
 * déposer un fichier qui part **du navigateur droit au bucket** avec sa barre
 * de progression — jamais par une action serveur, le proxy tronque les corps.
 */
export function VideoManager({
  lessonId,
  provider,
  videoUrl,
  storagePath,
}: {
  lessonId: string;
  provider: AcademyVideoProvider;
  videoUrl: string | null;
  storagePath: string | null;
}) {
  const [url, setUrl] = useState(videoUrl ?? "");
  const [pending, startTransition] = useTransition();
  const [uploadRatio, setUploadRatio] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploading = uploadRatio !== null;

  const sendFile = (file: File) => {
    setUploadRatio(0);
    void uploadVideoFromBrowser(lessonId, file, setUploadRatio).then((result) => {
      setUploadRatio(null);
      if (result.ok) toast.success(result.message ?? "Vidéo en ligne.");
      else toast.error(result.error);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={provider === "none" ? "neutral" : "positive"}>
          {VIDEO_PROVIDER_LABELS[provider]}
        </StatusPill>
        {provider === "supabase" && storagePath ? (
          <span className="type-caption truncate text-text-secondary">{storagePath}</span>
        ) : null}
        {provider !== "none" ? (
          <Button
            variant="ghost"
            size="xs"
            disabled={pending || uploading}
            onClick={() => {
              startTransition(async () => {
                const result = await setLessonVideoUrl({ lessonId, url: "" });
                if (result.ok) {
                  setUrl("");
                  toast.success(result.message ?? "Vidéo retirée.");
                } else toast.error(result.error);
              });
            }}
          >
            <Trash2 data-icon="inline-start" aria-hidden strokeWidth={1.75} />
            Retirer
          </Button>
        ) : null}
      </div>

      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            const result = await setLessonVideoUrl({ lessonId, url: url.trim() });
            if (result.ok) toast.success(result.message ?? "Vidéo branchée.");
            else toast.error(result.error);
          });
        }}
      >
        <Input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="Coller une URL YouTube, Vimeo ou Mux"
          aria-label="URL de la vidéo"
          className="h-8 flex-1 text-sm"
          disabled={uploading}
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={pending || uploading || !url.trim()}
        >
          <Link2 data-icon="inline-start" aria-hidden strokeWidth={1.75} />
          Brancher
        </Button>
      </form>

      <div
        role="button"
        tabIndex={0}
        aria-label="Déposer un fichier vidéo, ou cliquer pour le choisir"
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          const file = event.dataTransfer.files[0];
          if (file) sendFile(file);
        }}
        className={cn(
          "flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-5 text-center transition-[border-color,background-color] duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
          dragOver
            ? "border-accent-ink bg-accent-subtle"
            : "border-border-strong bg-surface-sunken hover:border-accent-ink/50",
        )}
      >
        {uploading ? (
          <div className="w-full max-w-72">
            <p className="type-caption mb-2 text-text-secondary tabular-nums">
              Envoi en cours — {Math.round((uploadRatio ?? 0) * 100)} %
            </p>
            <div
              role="progressbar"
              aria-valuenow={Math.round((uploadRatio ?? 0) * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progression de l'envoi"
              className="h-1.5 w-full overflow-hidden rounded-pill bg-surface"
            >
              <div
                className="h-full rounded-pill bg-accent"
                style={{ width: `${Math.round((uploadRatio ?? 0) * 100)}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <Upload aria-hidden strokeWidth={1.75} className="size-4.5 text-text-tertiary" />
            <p className="type-caption text-text-secondary">
              Glisser une vidéo ici (MP4, MOV ou WebM, 50 Mo max) ou cliquer pour choisir.
            </p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          className="sr-only"
          aria-hidden
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) sendFile(file);
          }}
        />
      </div>
    </div>
  );
}
