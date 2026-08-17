"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type SyncReport = {
  account: string;
  rows: number;
  error: string | null;
  warning?: string | null;
};

type SyncOutcome = {
  ok: boolean;
  reports?: SyncReport[];
  note?: string;
  error?: string;
} | null;

/**
 * La synchronisation en vol, par espace, **hors de tout composant**.
 *
 * Changer d'onglet réseau remonte la page et démonterait un état local : la
 * promesse vivrait, mais plus rien ne l'écouterait. Rangée ici, elle survit
 * aux navigations internes — le bouton se remonte, retrouve la course en
 * cours et se raccroche à son résultat. Le serveur, lui, n'a jamais cessé de
 * travailler.
 */
const inFlight = new Map<string, Promise<SyncOutcome>>();
const listeners = new Set<() => void>();

function notifyListeners(): void {
  for (const listener of listeners) listener();
}

/** Prévient chaque bouton monté qu'une course démarre ou s'achève. */
export function subscribeSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function startSync(workspaceSlug: string, du?: string): Promise<SyncOutcome> {
  const existing = inFlight.get(workspaceSlug);
  if (existing) return existing;

  const run = fetch("/api/reporting/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace: workspaceSlug, du }),
  })
    .then(async (response) => {
      const payload = (await response.json().catch(() => null)) as SyncOutcome;
      if (!response.ok) {
        return payload ?? { ok: false, error: "La synchronisation a échoué." };
      }
      return payload;
    })
    .catch((): SyncOutcome => ({ ok: false, error: "La synchronisation a échoué." }))
    .finally(() => {
      inFlight.delete(workspaceSlug);
      notifyListeners();
    });

  inFlight.set(workspaceSlug, run);
  notifyListeners();
  return run;
}

export function isSyncRunning(workspaceSlug: string): boolean {
  return inFlight.has(workspaceSlug);
}

export function describeOutcome(outcome: SyncOutcome): void {
  if (!outcome) {
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
  const warned = reports.filter((report) => report.warning);
  const rows = reports.reduce((sum, report) => sum + report.rows, 0);

  if (failed.length > 0) {
    // La cause exacte, pas un « ça a raté » : c'est souvent un jeton ou une
    // portée à rebrancher, et le message le dit.
    toast.error(
      `${failed[0]?.account} : ${failed[0]?.error}${failed.length > 1 ? ` (+${failed.length - 1} autre${failed.length > 2 ? "s" : ""})` : ""}`,
    );
  } else if (warned.length > 0) {
    // Une partie est passée : le dire, sans le vert du succès complet.
    toast.warning(`${warned[0]?.account} : ${warned[0]?.warning}`);
  } else {
    toast.success(`Synchronisé — ${rows} lignes mises à jour.`);
  }
}

/**
 * Le bouton « Synchroniser » du Reporting — appelle Meta maintenant, sans
 * attendre le passage quotidien. Rendu au propriétaire seulement, décidé côté
 * serveur : un client n'a ni le bouton, ni la route (404).
 */
export function SyncButton({
  workspaceSlug,
  du,
}: {
  workspaceSlug: string;
  /** Borne basse de la plage affichée — la collecte la couvrira. */
  du?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(() => isSyncRunning(workspaceSlug));

  // Le témoin suit la course, où qu'elle ait démarré — le bouton, le
  // sélecteur de plage, ou un onglet quitté entre-temps. Le verdict (toast,
  // rafraîchissement) appartient à qui a lancé ; ici, seul le spinner.
  useEffect(() => {
    const sync = () => setPending(isSyncRunning(workspaceSlug));
    sync();
    return subscribeSync(sync);
  }, [workspaceSlug]);

  const run = async () => {
    const outcome = await startSync(workspaceSlug, du);
    describeOutcome(outcome);
    router.refresh();
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
