"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type SyncReport = {
  workspace: string;
  channel: string;
  account: string;
  threads: number;
  error: string | null;
};

type SyncOutcome = {
  ok: boolean;
  reports?: SyncReport[];
  note?: string;
  error?: string;
} | null;

/**
 * Le bouton « Relever maintenant » de l'inbox — appelle Meta pour tous les
 * comptes affectés, sans attendre le passage horaire. Rendu au propriétaire
 * seulement, décidé côté serveur : pour un autre rôle la route n'existe pas.
 */
export function ModerationSyncButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const run = async () => {
    setPending(true);
    try {
      const response = await fetch("/api/moderation/sync", { method: "POST" });
      const outcome = (await response.json().catch(() => null)) as SyncOutcome;

      if (!outcome || (!response.ok && !outcome.error)) {
        toast.error("La synchronisation a échoué.");
        return;
      }
      if (outcome.note) {
        toast.info(outcome.note);
        return;
      }
      if (outcome.error) {
        toast.error(outcome.error);
        return;
      }

      const reports = outcome.reports ?? [];
      const failed = reports.filter((report) => report.error);
      const threads = reports.reduce((sum, report) => sum + report.threads, 0);

      if (failed.length > 0) {
        // La cause exacte, pas un « ça a raté » : c'est souvent une portée à
        // rebrancher, et le message dit le geste.
        toast.error(
          `${failed[0]?.account} : ${failed[0]?.error}${
            failed.length > 1
              ? ` (+${failed.length - 1} autre${failed.length > 2 ? "s" : ""})`
              : ""
          }`,
        );
      } else {
        toast.success(`Relevé terminé — ${threads} fil(s) à jour.`);
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={run} disabled={pending}>
      <RefreshCw
        className={pending ? "size-4 animate-spin" : "size-4"}
        strokeWidth={1.75}
        aria-hidden
      />
      {pending ? "Relevé en cours…" : "Relever maintenant"}
    </Button>
  );
}
