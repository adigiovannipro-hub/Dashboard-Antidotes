"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListPlus } from "lucide-react";
import { toast } from "sonner";

import { enrollInSequence } from "@/app/actions/antidotes-sequences";
import { NativeSelect } from "@/components/antidotes/controls";
import { PendingLabel } from "@/components/ds/pending-label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { SequenceOption } from "@/lib/antidotes/sequences/queries";

/**
 * « Inscrire à une séquence » — depuis la sélection du tableau ou le panneau
 * d'un prospect. La séquence se choisit, l'action inscrit le contact
 * principal de chaque prospect et dit ce qu'elle a écarté, par raison.
 */
export function EnrollDialog({
  prospectIds,
  sequences,
  size = "sm",
  variant = "outline",
  onDone,
}: {
  prospectIds: string[];
  sequences: SequenceOption[];
  size?: "sm" | "default";
  variant?: "outline" | "default" | "ghost";
  onDone?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sequenceId, setSequenceId] = useState(sequences.find((s) => s.is_active)?.id ?? sequences[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const count = prospectIds.length;

  function submit() {
    if (!sequenceId) return;
    startTransition(async () => {
      const result = await enrollInSequence({ sequenceId, prospectIds });
      if (result.ok) {
        toast.success(result.message ?? "Inscrit.");
        setOpen(false);
        onDone?.();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <Button type="button" size={size} variant={variant} onClick={() => setOpen(true)} disabled={count === 0}>
        <ListPlus aria-hidden />
        Inscrire à une séquence
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Inscrire {count} prospect{count > 1 ? "s" : ""}
            </DialogTitle>
          </DialogHeader>
          {sequences.length === 0 ? (
            <p className="type-body text-text-secondary">
              Aucune séquence. Créez-en une depuis l&apos;onglet Séquences.
            </p>
          ) : (
            <div className="grid gap-3">
              <div className="grid gap-1">
                <Label htmlFor="enroll-sequence">Séquence</Label>
                <NativeSelect
                  id="enroll-sequence"
                  value={sequenceId}
                  onChange={(event) => setSequenceId(event.target.value)}
                >
                  {sequences.map((sequence) => (
                    <option key={sequence.id} value={sequence.id}>
                      {sequence.name}
                      {sequence.is_active ? "" : " (inactive)"}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <p className="type-caption text-text-secondary">
                Le contact principal de chaque société est inscrit. Adresse valide → emails ; adresse risquée → piste LinkedIn ; non vérifiée → écartée.
              </p>
              <div>
                <Button type="button" variant="accent" onClick={submit} disabled={pending || !sequenceId}>
                  <PendingLabel pending={pending} busy="Inscription…">
                    Inscrire
                  </PendingLabel>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
