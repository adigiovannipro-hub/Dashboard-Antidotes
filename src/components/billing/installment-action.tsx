"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import {
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
}: {
  installmentId: string;
  status: BillingInstallmentStatus;
  children: React.ReactNode;
  variant?: "outline" | "ghost";
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
        {children}
      </Button>
    </form>
  );
}
