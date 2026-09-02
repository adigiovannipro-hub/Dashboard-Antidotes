"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";

import { attachAsset, prepareAssetUpload } from "@/app/actions/academy";
import { PendingLabel } from "@/components/ds/pending-label";
import { Button } from "@/components/ui/button";

/**
 * La miniature d'introduction d'une formation ou d'un module.
 *
 * Les octets vont **du navigateur droit au bucket** : le serveur signe une URL
 * d'envoi, le navigateur y met le fichier, puis une action accroche le chemin.
 * C'est la mécanique de toutes les images du dépôt, et elle existe pour une
 * raison écrite dans les pièges connus — le proxy tronque à 10 Mo le corps
 * d'une action serveur, sans erreur lisible.
 *
 * Pas de barre de progression, contrairement aux vidéos : 5 Mo au maximum
 * partent en une fraction de seconde, et un `fetch` suffit là où la vidéo
 * réclamait `XMLHttpRequest` pour ses événements de progression.
 */
export function CoverUploader({
  kind,
  id,
  coverUrl,
  label,
}: {
  kind: "course" | "module";
  id: string;
  coverUrl: string | null;
  /** Ce que décrit l'image, pour l'étiquette du bouton et l'aria. */
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  // L'aperçu local : l'URL signée n'arrive qu'au rendu suivant, et l'écran
  // montrerait l'ancienne image entretemps.
  const [preview, setPreview] = useState<string | null>(null);
  const shown = preview ?? coverUrl;

  function send(file: File) {
    start(async () => {
      const prepared = await prepareAssetUpload({
        kind,
        id,
        file: { name: file.name, type: file.type, size: file.size },
      });
      if (!prepared.ok) {
        toast.error(prepared.error);
        return;
      }

      const response = await fetch(prepared.url, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!response.ok) {
        toast.error(`Le bucket a refusé l'envoi (${response.status}).`);
        return;
      }

      const attached = await attachAsset({ kind, id, path: prepared.path });
      if (attached.ok) {
        setPreview(URL.createObjectURL(file));
        toast.success(attached.message ?? "Miniature en ligne.");
      } else toast.error(attached.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shown}
          alt=""
          className="h-16 w-28 shrink-0 rounded-md border border-border object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="flex h-16 w-28 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted text-text-secondary"
        >
          <ImagePlus strokeWidth={1.75} className="size-5" />
        </span>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) send(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          aria-label={`Changer la miniature — ${label}`}
          onClick={() => inputRef.current?.click()}
        >
          <PendingLabel pending={pending} busy="Envoi…">
            {shown ? "Changer la miniature" : "Ajouter une miniature"}
          </PendingLabel>
        </Button>
        {shown ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => {
              start(async () => {
                const result = await attachAsset({ kind, id, path: null });
                if (result.ok) {
                  setPreview(null);
                  toast.success(result.message ?? "Miniature retirée.");
                } else toast.error(result.error);
              });
            }}
          >
            Retirer
          </Button>
        ) : null}
        <span className="type-caption text-text-secondary">PNG, JPG ou WebP · 5 Mo</span>
      </div>
    </div>
  );
}
