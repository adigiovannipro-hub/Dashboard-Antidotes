"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import {
  deleteEngagement,
  endEngagement,
  type BillingActionResult,
} from "@/app/actions/billing";
import { Button } from "@/components/ui/button";

/**
 * Clore ou supprimer un devis. Deux gestes que rien ne presse : ils vivent
 * dans le détail déplié du devis, pas sur sa ligne.
 */
export function EngagementActions({
  engagementId,
  active,
}: {
  engagementId: string;
  active: boolean;
}) {
  const [endState, endAction, endPending] = useActionState<
    BillingActionResult | null,
    FormData
  >(endEngagement, null);
  const [deleteState, deleteAction, deletePending] = useActionState<
    BillingActionResult | null,
    FormData
  >(deleteEngagement, null);

  useEffect(() => {
    const state = endState ?? deleteState;
    if (!state) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.error);
  }, [endState, deleteState]);

  return (
    <div className="flex gap-2">
      {active ? (
        <form action={endAction}>
          <input type="hidden" name="engagementId" value={engagementId} />
          <Button type="submit" variant="outline" size="sm" disabled={endPending}>
            Terminer le devis
          </Button>
        </form>
      ) : null}
      <form
        action={deleteAction}
        onSubmit={(event) => {
          // La suppression emporte aussi l'historique facturé : elle mérite
          // une confirmation, contrairement à la clôture.
          if (
            !window.confirm(
              "Supprimer ce devis et toutes ses échéances, facturées comprises ?",
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="engagementId" value={engagementId} />
        <Button type="submit" variant="ghost" size="sm" disabled={deletePending}>
          Supprimer
        </Button>
      </form>
    </div>
  );
}
