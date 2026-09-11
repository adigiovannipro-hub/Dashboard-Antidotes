"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FRESH_WINDOW_MINUTES, type SyncSnapshot } from "@/lib/finance/sync-state";

/**
 * Le relevé de la Modération : l'ouverture de l'inbox le déclenche, le bouton
 * le force.
 *
 * Pourquoi l'ouverture : la Modération n'avait plus de déclencheur fiable. Son
 * passage programmé est une étape d'un cron GitHub — dont près d'une exécution
 * horaire sur deux n'a jamais lieu — et le seul déclencheur fréquent qui
 * restait, l'ouverture de Finance, envoie une portée qui **saute** la
 * Modération. D'où une boîte qui datait de la veille sans que rien ne le dise.
 *
 * Le serveur tranche seul : il connaît la fenêtre de fraîcheur et sait si une
 * exécution tourne déjà, ce qu'un onglet ne peut pas savoir des autres.
 */

/** Cinq minutes de sondage : au-delà, l'exécution a échoué ou n'a pas démarré. */
const MAX_TICKS = 50;
const TICK_MS = 6_000;

type Command = {
  decision?: string;
  message?: string;
  snapshot?: SyncSnapshot;
};

export function ModerationSyncButton() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<SyncSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  /** Une commande en vol : deux clics, ou le clic pendant l'appel d'ouverture. */
  const commanding = useRef(false);

  const poll = useCallback(() => {
    let ticks = 0;
    const timer = setInterval(async () => {
      ticks += 1;
      if (ticks > MAX_TICKS) {
        clearInterval(timer);
        setBusy(false);
        return;
      }

      const response = await fetch("/api/moderation/sync", { cache: "no-store" }).catch(
        () => null,
      );
      if (!response?.ok) return;
      const next = (await response.json().catch(() => null)) as SyncSnapshot | null;
      if (!next) return;

      setSnapshot(next);
      // Le passage de « en cours » à « terminé » est le seul moment où la page
      // a quelque chose de neuf à relire.
      if (!next.running) {
        clearInterval(timer);
        setBusy(false);
        router.refresh();
      }
    }, TICK_MS);
  }, [router]);

  const command = useCallback(
    async (force: boolean) => {
      if (commanding.current) return;
      commanding.current = true;
      setBusy(true);

      try {
        const response = await fetch("/api/moderation/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force }),
        });
        const payload = (await response.json().catch(() => null)) as Command | null;
        if (payload?.snapshot) setSnapshot(payload.snapshot);

        if (force && payload?.message) {
          if (payload.decision === "dispatch" || payload.decision === "direct") {
            toast.success(payload.message);
          } else if (payload.decision === "skip" && payload.snapshot?.unavailable) {
            toast.error(payload.message);
          } else toast.info(payload.message);
        }

        if (payload?.snapshot?.running) {
          poll();
          return;
        }
        setBusy(false);
        // Le relevé direct a déjà écrit : la page relit tout de suite.
        if (payload?.decision === "direct") router.refresh();
      } catch {
        if (force) toast.error("Le relevé n'a pas pu être lancé.");
        setBusy(false);
      } finally {
        commanding.current = false;
      }
    },
    [poll, router],
  );

  /* Le déclenchement à l'ouverture, espacé de la même fenêtre que celle du
     serveur : sans ce garde, revenir sur l'inbox enverrait une commande à
     chaque navigation. Le serveur les refuserait — il est la seule autorité —
     mais ce serait un appel pour rien à chaque écran. */
  useEffect(() => {
    const key = "antidotes_moderation_ask";
    let last = 0;
    try {
      last = Number(window.sessionStorage.getItem(key) ?? 0);
    } catch {
      // Navigation privée, stockage bloqué : on demande, le serveur tranchera.
    }
    if (Date.now() - last < FRESH_WINDOW_MINUTES * 60_000) return;
    try {
      window.sessionStorage.setItem(key, String(Date.now()));
    } catch {
      // Idem : l'absence de mémoire ne doit pas empêcher le relevé.
    }
    /* Après le rendu, jamais pendant : `command` pose un état, et le faire
       dans le corps d'un effet enchaîne deux rendus pour rien. */
    void Promise.resolve().then(() => command(false));
  }, [command]);

  const unavailable = snapshot?.unavailable ?? null;
  const running = busy || (snapshot?.running ?? false);

  return (
    <div className="flex items-center gap-2">
      {unavailable ? (
        // La cause exacte vit dans l'infobulle : les messages de GitHub sont
        // longs, et l'en-tête de l'inbox n'a pas la place.
        <span
          className="type-caption hidden items-center gap-1 text-warning-ink lg:inline-flex"
          title={unavailable}
        >
          <CircleAlert className="size-3.5" strokeWidth={1.75} aria-hidden />
          Relevé automatique indisponible
        </span>
      ) : null}

      <Button size="sm" variant="outline" onClick={() => void command(true)} disabled={running}>
        <RefreshCw
          className={running ? "size-4 animate-spin" : "size-4"}
          strokeWidth={1.75}
          aria-hidden
        />
        {running ? "Relevé en cours…" : "Relever maintenant"}
      </Button>
    </div>
  );
}
