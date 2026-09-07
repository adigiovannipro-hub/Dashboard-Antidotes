"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { createSequence, type SequencesResult } from "@/app/actions/antidotes-sequences";
import { PendingLabel } from "@/components/ds/pending-label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Une séquence naît d'un nom : elle arrive avec ses trois étapes par défaut
 * — J+0, J+4, J+9 — et s'ouvre sur ses réglages, où tout se réécrit.
 */
export function NewSequenceDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="accent" size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Nouvelle séquence
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle séquence</DialogTitle>
          </DialogHeader>
          <NewSequenceForm onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function NewSequenceForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<SequencesResult | null, FormData>(
    createSequence,
    null,
  );
  const lastState = useRef<SequencesResult | null>(null);

  useEffect(() => {
    if (!state || state === lastState.current) return;
    lastState.current = state;
    if (state.ok) {
      toast.success(state.message ?? "Séquence créée.");
      onDone();
      if (state.id) router.push(`/antidotes/outbound/sequences/${state.id}`);
    } else {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="grid gap-3">
      <div className="grid gap-1">
        <Label htmlFor="sequence-name">Nom</Label>
        <Input id="sequence-name" name="name" required maxLength={120} autoFocus placeholder="Opticiens — miroir Bondet" />
      </div>
      <div>
        <Button type="submit" variant="accent" disabled={pending}>
          <PendingLabel pending={pending} busy="Création…">
            Créer la séquence
          </PendingLabel>
        </Button>
      </div>
    </form>
  );
}
