"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import {
  archiveInstallment,
  type BillingActionResult,
} from "@/app/actions/billing";
import { Button } from "@/components/ui/button";

/**
 * Archiver une payée — ou la ressortir. L'automate archive seul au bout de
 * deux mois ; ce bouton sert à pousser plus tôt ou à revenir dessus.
 */
export function ArchiveAction({
  installmentId,
  archived,
  children,
  variant = "outline",
}: {
  installmentId: string;
  /** `true` : le bouton archive ; `false` : il ressort. */
  archived: boolean;
  children: React.ReactNode;
  variant?: "outline" | "ghost";
}) {
  const [state, formAction, pending] = useActionState<
    BillingActionResult | null,
    FormData
  >(archiveInstallment, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="inline-flex">
      <input type="hidden" name="installmentId" value={installmentId} />
      <input type="hidden" name="archived" value={archived ? "1" : "0"} />
      <Button type="submit" variant={variant} size="sm" disabled={pending}>
        {children}
      </Button>
    </form>
  );
}
