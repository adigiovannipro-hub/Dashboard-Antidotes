"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, History, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FRESH_WINDOW_MINUTES, type SyncSnapshot } from "@/lib/finance/sync-state";
import type { SyncScope } from "@/lib/moderation/sync-scope";

/**
 * Le relevé de l'Inbox : l'ouverture de l'écran fait le jour, le bouton force.
 *
 * Ce qui a changé, et c'est tout le sujet : le relevé avait **une** forme —
 * soixante jours de conversations, les commentaires de toutes les publications,
 * les photos de profil redemandées une par une. Ouvrir l'inbox déclenchait donc
 * le rattrapage entier du compte, pour au mieux trois commentaires nouveaux.
 *
 * Il en a deux maintenant. Le relevé **du jour** est assez court pour tenir
 * dans la fonction qui sert cette page : il s'exécute d'un coup, sans passer
 * par GitHub, et la boîte est à jour au moment où l'écran s'affiche. Le relevé
 * **complet** reste ce qu'il était et part sur un runner — il tourne seul
 * chaque nuit, et ce bouton-ci ne sert qu'à ne pas attendre la nuit.
 *
 * Le serveur tranche seul : il connaît les deux fenêtres de fraîcheur et sait
 * si une exécution tourne déjà, ce qu'un onglet ne peut pas savoir des autres.
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
  /** La portée en cours, pour ne faire tourner qu'un seul des deux boutons. */
  const [pending, setPending] = useState<SyncScope | null>(null);
  /** Une commande en vol : deux clics, ou le clic pendant l'appel d'ouverture. */
  const commanding = useRef(false);

  const poll = useCallback(() => {
    let ticks = 0;
    const timer = setInterval(async () => {
      ticks += 1;
      if (ticks > MAX_TICKS) {
        clearInterval(timer);
        setPending(null);
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
        setPending(null);
        router.refresh();
      }
    }, TICK_MS);
  }, [router]);

  const command = useCallback(
    async (scope: SyncScope, force: boolean) => {
      if (commanding.current) return;
      commanding.current = true;
      setPending(scope);

      try {
        const response = await fetch("/api/moderation/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force, portee: scope }),
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
        setPending(null);
        // Le relevé direct a déjà écrit : la page relit tout de suite.
        if (payload?.decision === "direct") router.refresh();
      } catch {
        if (force) toast.error("Le relevé n'a pas pu être lancé.");
        setPending(null);
      } finally {
        commanding.current = false;
      }
    },
    [poll, router],
  );

  /* Le déclenchement à l'ouverture, espacé de la même fenêtre que celle du
     serveur : sans ce garde, revenir sur l'inbox enverrait une commande à
     chaque navigation. Le serveur les refuserait — il est la seule autorité —
     mais ce serait un appel pour rien à chaque écran.

     La clé porte la portée : le compteur du relevé du jour ne doit rien dire
     du relevé complet, qui a sa propre horloge côté serveur. */
  useEffect(() => {
    const key = "antidotes_moderation_ask_jour";
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
    void Promise.resolve().then(() => command("jour", false));
  }, [command]);

  const unavailable = snapshot?.unavailable ?? null;
  const running = pending !== null || (snapshot?.running ?? false);

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

      <Button
        size="sm"
        variant="ghost"
        onClick={() => void command("complet", true)}
        disabled={running}
        title="Relevé complet — soixante jours"
      >
        <History
          className={pending === "complet" ? "size-4 animate-spin" : "size-4"}
          strokeWidth={1.75}
          aria-hidden
        />
        Tout relever
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={() => void command("jour", true)}
        disabled={running}
      >
        <RefreshCw
          className={pending === "jour" ? "size-4 animate-spin" : "size-4"}
          strokeWidth={1.75}
          aria-hidden
        />
        {running ? "Relevé en cours…" : "Relever maintenant"}
      </Button>
    </div>
  );
}
