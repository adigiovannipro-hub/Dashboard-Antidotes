"use client";

import { useActionState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { syncNow, type FinanceActionResult } from "@/app/actions/finance";
import { Button } from "@/components/ui/button";
import type { FinanceSyncRun } from "@/lib/finance/types";

/**
 * L'horodatage du dernier passage et le bouton « Synchroniser maintenant ».
 *
 * L'heure affichée est celle du **dernier passage tenté**, réussi ou non — un
 * passage en échec dont on n'affiche que le prédécesseur réussi ferait passer
 * des chiffres d'avant-hier pour ceux d'hier.
 */
export function SyncBanner({
  lastRun,
  canDecide,
}: {
  lastRun: FinanceSyncRun | null;
  canDecide: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    FinanceActionResult | null,
    FormData
  >(syncNow, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.error);
  }, [state]);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <p className="text-muted-foreground text-xs">
        {lastRun ? (
          <>
            Dernière synchronisation&nbsp;:{" "}
            <time dateTime={lastRun.started_at} className="tabular-nums">
              {formatInstant(lastRun.started_at)}
            </time>
            {lastRun.status === "error" ? (
              <span style={{ color: "var(--brand-red)" }}> — en échec</span>
            ) : null}
          </>
        ) : (
          "Aucune synchronisation encore passée."
        )}
      </p>
      {canDecide ? (
        <form action={formAction}>
          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            <RefreshCw
              className={pending ? "animate-spin" : undefined}
              aria-hidden
            />
            Synchroniser maintenant
          </Button>
        </form>
      ) : null}
    </div>
  );
}

const INSTANT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function formatInstant(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return INSTANT.format(date);
}
