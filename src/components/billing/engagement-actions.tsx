"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import {
  deleteEngagement,
  endEngagement,
  reopenEngagement,
  type BillingActionResult,
} from "@/app/actions/billing";
import { Button } from "@/components/ui/button";

/**
 * Clore, rouvrir ou supprimer un devis. Des gestes que rien ne presse : ils
 * vivent dans le détail déplié du devis, pas sur sa ligne. Un devis soldé se
 * clôt tout seul ; « Rouvrir le devis » est le chemin inverse, à la main.
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
  const [reopenState, reopenAction, reopenPending] = useActionState<
    BillingActionResult | null,
    FormData
  >(reopenEngagement, null);

  useEffect(() => {
    const state = endState ?? deleteState ?? reopenState;
    if (!state) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.error);
  }, [endState, deleteState, reopenState]);

  return (
    <div className="flex gap-2">
      {active ? (
        <form action={endAction}>
          <input type="hidden" name="engagementId" value={engagementId} />
          <Button type="submit" variant="outline" size="sm" disabled={endPending}>
            Terminer le devis
          </Button>
        </form>
      ) : (
        <form action={reopenAction}>
          <input type="hidden" name="engagementId" value={engagementId} />
          <Button type="submit" variant="outline" size="sm" disabled={reopenPending}>
            Rouvrir le devis
          </Button>
        </form>
      )}
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
