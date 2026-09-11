"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * La boîte qui demande avant de supprimer.
 *
 * Elle existe parce qu'un mois entier de planning est parti d'un clic, sans
 * que rien ne l'annonce. Toute suppression qui emporte plus que la ligne
 * qu'on regarde passe désormais par ici. `window.confirm` aurait fait le même
 * travail, mais il ne parle pas la langue de la maison et ne sait pas dire ce
 * que la suppression emporte — c'est précisément l'information qui manquait.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Ce que la suppression emporte, et ce qui se restaure. */
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
}) {
  const [pending, setPending] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <p className="type-body text-text-secondary">{description}</p>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              try {
                await onConfirm();
                onOpenChange(false);
              } finally {
                setPending(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
