"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import {
  updateInstallment,
  type BillingActionResult,
} from "@/app/actions/billing";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inputAmountValue } from "@/lib/billing/format";

/**
 * Ajuster une mensualité — le « des fois c'est plus, des fois c'est moins ».
 *
 * Un crayon discret, un dialogue court : montant HT et note. La retouche est
 * ligne à ligne, les autres mois du devis ne bougent pas.
 */
export function EditInstallment({
  installmentId,
  monthLabel,
  amountCents,
  notes,
}: {
  installmentId: string;
  monthLabel: string;
  amountCents: number;
  notes: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Ajuster la mensualité de ${monthLabel}`}
        onClick={() => setOpen(true)}
      >
        <Pencil aria-hidden strokeWidth={1.75} className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mensualité de {monthLabel}</DialogTitle>
            <DialogDescription>
              Le montant retouché ne change que ce mois — les autres lignes du
              devis restent telles quelles.
            </DialogDescription>
          </DialogHeader>

          <EditForm
            installmentId={installmentId}
            amountCents={amountCents}
            notes={notes}
            onDone={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditForm({
  installmentId,
  amountCents,
  notes,
  onDone,
}: {
  installmentId: string;
  amountCents: number;
  notes: string | null;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    BillingActionResult | null,
    FormData
  >(updateInstallment, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message);
      onDone();
    } else {
      toast.error(state.error);
    }
    // `onDone` referme le dialogue : le rejouer à chaque rendu le refermerait
    // pendant la saisie suivante.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="installmentId" value={installmentId} />
      <div className="grid gap-1">
        <Label htmlFor={`edit-amount-${installmentId}`}>Montant (€ HT)</Label>
        <Input
          id={`edit-amount-${installmentId}`}
          name="amount"
          inputMode="decimal"
          required
          defaultValue={inputAmountValue(amountCents)}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`edit-notes-${installmentId}`}>Note</Label>
        <Input
          id={`edit-notes-${installmentId}`}
          name="notes"
          placeholder="Mois offert, rallonge…"
          defaultValue={notes ?? ""}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}
