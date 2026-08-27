"use client";

import { useActionState, useEffect } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";

import {
  deleteInstallment,
  setInstallmentStatus,
  type BillingActionResult,
} from "@/app/actions/billing";
import { Button } from "@/components/ui/button";
import type { BillingInstallmentStatus } from "@/lib/billing/types";

/**
 * Un bouton qui fait passer une échéance à un statut donné.
 *
 * Un formulaire par bouton : l'action reçoit l'identifiant et le statut en
 * champs cachés, `useActionState` porte l'attente, le toast rend le verdict.
 */
export function InstallmentAction({
  installmentId,
  status,
  children,
  variant = "outline",
  icon,
}: {
  installmentId: string;
  status: BillingInstallmentStatus;
  children: React.ReactNode;
  variant?: "outline" | "ghost";
  /** Une coche devant le libellé — l'encaissement se confirme, il ne se
      corrige pas : autant que le geste le dise. */
  icon?: "check";
}) {
  const [state, formAction, pending] = useActionState<
    BillingActionResult | null,
    FormData
  >(setInstallmentStatus, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="inline-flex">
      <input type="hidden" name="installmentId" value={installmentId} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant={variant} size="sm" disabled={pending}>
        {icon === "check" ? (
          <Check aria-hidden strokeWidth={1.75} data-icon="inline-start" />
        ) : null}
        {children}
      </Button>
    </form>
  );
}

/**
 * Supprimer une mensualité — le seul geste destructif d'une ligne, donc le
 * seul qui demande confirmation. Même pattern que la suppression d'un devis.
 */
export function DeleteInstallmentButton({ installmentId }: { installmentId: string }) {
  const [state, formAction, pending] = useActionState<
    BillingActionResult | null,
    FormData
  >(deleteInstallment, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.error);
  }, [state]);

  return (
    <form
      action={formAction}
      className="inline-flex"
      onSubmit={(event) => {
        if (!window.confirm("Supprimer cette mensualité ? Elle disparaît du devis et des groupes.")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="installmentId" value={installmentId} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        Supprimer
      </Button>
    </form>
  );
}
