"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  attachMyAvatar,
  prepareMyAvatarUpload,
  removeMyAvatar,
  updateMyProfile,
  type ProfilResult,
} from "@/app/actions/profil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PendingLabel } from "@/components/ds/pending-label";

/**
 * L'écran de réglage de sa propre fiche.
 *
 * La photo part **du navigateur droit au bucket** — le serveur signe une URL
 * d'envoi, le navigateur y met le fichier, puis une action accroche le chemin.
 * Même mécanique que les visuels du Planning et les vidéos de l'Academy : un
 * fichier ne transite jamais par une action serveur, où le proxy le tronque.
 */
export function ProfilForm({
  email,
  firstName,
  lastName,
  avatarUrl,
}: {
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}) {
  const [state, action, pending] = useActionState<ProfilResult | null, FormData>(
    updateMyProfile,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();
  // L'aperçu local évite le clignotement : l'URL signée n'arrive qu'au
  // rafraîchissement suivant, et l'écran montrerait l'ancienne photo entretemps.
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.error);
  }, [state]);

  const shown = preview ?? avatarUrl;
  const initials = initialsOf(firstName, lastName, email);

  function upload(file: File) {
    startUpload(async () => {
      const prepared = await prepareMyAvatarUpload({
        name: file.name,
        type: file.type,
        size: file.size,
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

      const attached = await attachMyAvatar({ path: prepared.path });
      if (attached.ok) {
        setPreview(URL.createObjectURL(file));
        toast.success(attached.message);
      } else toast.error(attached.error);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shown}
            alt=""
            className="size-16 shrink-0 rounded-pill border border-border object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="type-h3 flex size-16 shrink-0 items-center justify-center rounded-pill border border-border bg-muted text-text-secondary"
          >
            {initials}
          </span>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) upload(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <PendingLabel pending={uploading} busy="Envoi…">Changer la photo</PendingLabel>
          </Button>
          {shown ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={uploading}
              onClick={() => {
                startUpload(async () => {
                  const result = await removeMyAvatar();
                  if (result.ok) {
                    setPreview(null);
                    toast.success(result.message);
                  } else toast.error(result.error);
                });
              }}
            >
              Retirer
            </Button>
          ) : null}
        </div>
      </div>

      <form ref={formRef} action={action} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="profil-prenom">Prénom</Label>
            <Input
              id="profil-prenom"
              name="firstName"
              defaultValue={firstName}
              autoComplete="given-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profil-nom">Nom</Label>
            <Input
              id="profil-nom"
              name="lastName"
              defaultValue={lastName}
              autoComplete="family-name"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="profil-email">Adresse email</Label>
          {/* L'adresse est l'identifiant de connexion : la changer ici
              couperait l'accès sans prévenir. Elle se lit, elle ne s'édite pas. */}
          <Input id="profil-email" value={email} readOnly disabled />
        </div>

        <Button type="submit" disabled={pending}>
          <PendingLabel pending={pending} busy="Enregistrement…">Enregistrer</PendingLabel>
        </Button>
      </form>
    </div>
  );
}

/** Deux lettres : les initiales du nom, à défaut celle de l'adresse. */
function initialsOf(firstName: string, lastName: string, email: string): string {
  const letters = [firstName, lastName]
    .map((part) => part.trim().charAt(0))
    .filter(Boolean)
    .join("");
  return (letters || email.charAt(0)).toUpperCase();
}
