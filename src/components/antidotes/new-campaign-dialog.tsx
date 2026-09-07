"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { createCampaign, type SourcingResult } from "@/app/actions/antidotes-sourcing";
import { NativeSelect } from "@/components/antidotes/controls";
import { PendingLabel } from "@/components/ds/pending-label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CAMPAIGN_ENGINE_LABELS, type CampaignEngine } from "@/lib/antidotes/types";

/**
 * Une campagne naît de trois choix — son nom, son moteur, le client dont
 * elle cherche les concurrents — puis s'ouvre sur ses réglages. Le moteur se
 * choisit ici et ne change plus : il fixe la forme des paramètres.
 */
export function NewCampaignDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="accent" size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Nouvelle campagne
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle campagne</DialogTitle>
          </DialogHeader>
          <NewCampaignForm onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function NewCampaignForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<SourcingResult | null, FormData>(
    createCampaign,
    null,
  );
  const lastState = useRef<SourcingResult | null>(null);

  useEffect(() => {
    if (!state || state === lastState.current) return;
    lastState.current = state;
    if (state.ok) {
      toast.success(state.message ?? "Campagne créée.");
      onDone();
      if (state.id) router.push(`/antidotes/outbound/sourcing/${state.id}`);
    } else {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="grid gap-3">
      <div className="grid gap-1">
        <Label htmlFor="campaign-name">Nom</Label>
        <Input id="campaign-name" name="name" required maxLength={120} autoFocus placeholder="Opticiens Lyon" />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="campaign-engine">Type de cible</Label>
        <NativeSelect id="campaign-engine" name="engine" defaultValue="maps">
          {(Object.keys(CAMPAIGN_ENGINE_LABELS) as CampaignEngine[]).map((engine) => (
            <option key={engine} value={engine}>
              {CAMPAIGN_ENGINE_LABELS[engine]}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="campaign-reference">Client de référence</Label>
        <Input id="campaign-reference" name="referenceClient" maxLength={120} placeholder="Bondet" />
      </div>
      <div>
        <Button type="submit" variant="accent" disabled={pending}>
          <PendingLabel pending={pending} busy="Création…">
            Créer la campagne
          </PendingLabel>
        </Button>
      </div>
    </form>
  );
}
