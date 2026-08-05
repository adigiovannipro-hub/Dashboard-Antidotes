"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { syncNow } from "@/app/actions/finance";
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
  const [pending, startTransition] = useTransition();

  function handleSync() {
    startTransition(async () => {
      const result = await syncNow();
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={pending}
        >
          <RefreshCw className={pending ? "animate-spin" : undefined} aria-hidden />
          Synchroniser maintenant
        </Button>
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
