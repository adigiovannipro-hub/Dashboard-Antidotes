"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { createProspect, type AntidotesResult } from "@/app/actions/antidotes";
import { PendingLabel } from "@/components/ds/pending-label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PIPELINE_PARAM_KEYS, withPipelineParams } from "@/lib/antidotes/pipeline-params";

/**
 * La création manuelle : les champs essentiels, rien d'autre. Le prospect
 * naît « À qualifier », source `manual`, et son panneau s'ouvre aussitôt —
 * c'est là qu'on ajoute le décisionnaire qu'on vient de repérer.
 */
export function NewProspectDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="accent" size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Ajouter un prospect
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau prospect</DialogTitle>
          </DialogHeader>
          <NewProspectForm onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function NewProspectForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, formAction, pending] = useActionState<AntidotesResult | null, FormData>(
    createProspect,
    null,
  );
  const lastState = useRef<AntidotesResult | null>(null);

  useEffect(() => {
    if (!state || state === lastState.current) return;
    lastState.current = state;
    if (state.ok) {
      toast.success(state.message ?? "Prospect ajouté.");
      onDone();
      if (state.id) {
        router.replace(
          `${pathname}${withPipelineParams(searchParams, { [PIPELINE_PARAM_KEYS.prospect]: state.id })}`,
          { scroll: false },
        );
      }
    } else {
      toast.error(state.error);
    }
    // `onDone` referme le dialogue : le rejouer à chaque rendu le refermerait
    // pendant la saisie suivante.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <div className="grid gap-1 sm:col-span-2">
        <Label htmlFor="prospect-company">Société</Label>
        <Input
          id="prospect-company"
          name="companyName"
          required
          maxLength={200}
          autoFocus
          placeholder="Lunettes Bondet"
        />
      </div>
      <div className="grid gap-1 sm:col-span-2">
        <Label htmlFor="prospect-website">Site</Label>
        <Input
          id="prospect-website"
          name="website"
          inputMode="url"
          maxLength={300}
          placeholder="lunettes-bondet.fr"
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="prospect-city">Ville</Label>
        <Input id="prospect-city" name="city" maxLength={120} placeholder="Lyon" />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="prospect-country">Pays</Label>
        <Input
          id="prospect-country"
          name="country"
          defaultValue="FR"
          maxLength={2}
          className="uppercase"
          placeholder="FR"
        />
      </div>
      <div className="grid gap-1 sm:col-span-2">
        <Label htmlFor="prospect-sector">Secteur</Label>
        <Input
          id="prospect-sector"
          name="sector"
          maxLength={120}
          placeholder="Opticien indépendant"
        />
      </div>

      <div className="sm:col-span-2">
        <Button type="submit" variant="accent" disabled={pending}>
          <PendingLabel pending={pending} busy="Ajout…">
            Ajouter au pipeline
          </PendingLabel>
        </Button>
      </div>
    </form>
  );
}
