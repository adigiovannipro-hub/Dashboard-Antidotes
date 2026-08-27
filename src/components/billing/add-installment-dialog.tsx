"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { addInstallment, type BillingActionResult } from "@/app/actions/billing";
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
import { PendingLabel } from "@/components/ds/pending-label";

/**
 * Une mensualité de plus sur un devis en cours — prolongation, rallonge.
 *
 * Deux champs suffisent : le mois et le montant, la TVA et la devise sont
 * celles du devis. La ligne naît « Devis confirmé » et rejoint les groupes,
 * le prévisionnel et les cartes au rendu suivant : une seule table, tout
 * l'écran la lit.
 */
export function AddInstallmentDialog({
  engagementId,
  clientName,
}: {
  engagementId: string;
  clientName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden strokeWidth={1.75} data-icon="inline-start" />
        Ajouter une mensualité
      </Button>

      {open ? (
        <AddInstallmentForm
          engagementId={engagementId}
          clientName={clientName}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
    </>
  );
}

function AddInstallmentForm({
  engagementId,
  clientName,
  open,
  onOpenChange,
}: {
  engagementId: string;
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState<
    BillingActionResult | null,
    FormData
  >(addInstallment, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message);
      onOpenChange(false);
    } else {
      toast.error(state.error);
    }
  }, [state, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nouvelle mensualité</DialogTitle>
            <DialogDescription>
              Sur le devis de {clientName} — elle démarre « Devis confirmé » et
              avance ensuite toute seule, comme les autres.
            </DialogDescription>
          </DialogHeader>

          <form action={formAction} className="space-y-4">
            <input type="hidden" name="engagementId" value={engagementId} />
            <div className="grid gap-1.5">
              <Label htmlFor={`mois-${engagementId}`}>Mois de prestation</Label>
              <Input
                id={`mois-${engagementId}`}
                name="serviceMonth"
                type="month"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`montant-${engagementId}`}>Montant (€)</Label>
              <Input
                id={`montant-${engagementId}`}
                name="amount"
                inputMode="decimal"
                placeholder="1 200"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={pending}
              >
                Annuler
              </Button>
              <Button type="submit" variant="accent" size="sm" disabled={pending}>
                <PendingLabel pending={pending} busy="Ajout…">
                  Ajouter
                </PendingLabel>
              </Button>
            </div>
          </form>
        </DialogContent>
    </Dialog>
  );
}
