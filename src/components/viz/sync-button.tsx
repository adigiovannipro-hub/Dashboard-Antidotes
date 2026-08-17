"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type SyncReport = { account: string; rows: number; error: string | null };

/**
 * Le bouton « Synchroniser » du Reporting — appelle Meta maintenant, sans
 * attendre le passage quotidien.
 *
 * Rendu au propriétaire seulement, décidé côté serveur : un client n'a ni le
 * bouton, ni la route (404). L'appel peut durer de longues secondes — Meta
 * pagine — d'où l'icône qui tourne et le bouton verrouillé pendant ce temps.
 */
export function SyncButton({ workspaceSlug }: { workspaceSlug: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const run = async () => {
    setPending(true);
    try {
      const response = await fetch("/api/reporting/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace: workspaceSlug }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        reports?: SyncReport[];
        note?: string;
        error?: string;
      } | null;

      if (!response.ok || !payload) {
        toast.error(payload?.error ?? "La synchronisation a échoué.");
        return;
      }

      if (payload.note) {
        toast.info(payload.note);
        return;
      }

      const failed = (payload.reports ?? []).filter((report) => report.error);
      const rows = (payload.reports ?? []).reduce(
        (sum, report) => sum + report.rows,
        0,
      );

      if (failed.length > 0) {
        // La cause exacte, pas un « ça a raté » : c'est souvent un jeton à
        // rebrancher, et le message le dit.
        toast.error(
          `${failed[0]?.account} : ${failed[0]?.error}${failed.length > 1 ? ` (+${failed.length - 1} autre${failed.length > 2 ? "s" : ""})` : ""}`,
        );
      } else {
        toast.success(`Synchronisé — ${rows} lignes mises à jour.`);
      }

      router.refresh();
    } catch {
      toast.error("La synchronisation a échoué. Réessayer.");
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
      {pending ? "Synchronisation…" : "Synchroniser"}
    </Button>
  );
}
