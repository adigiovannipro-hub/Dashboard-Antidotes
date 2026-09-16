"use client";

import { useEffect, useSyncExternalStore } from "react";
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
 * par GitHub, et la boîte est à jour au moment où l'écran s'affiche. C'est ce
 * chemin, et lui seul, qui remplace le relevé horaire d'avant — le fond de
 * tâche n'a plus qu'une passe de réparation par nuit. Le relevé **complet**
 * est cette passe, et ce bouton-ci ne sert qu'à ne pas attendre la nuit.
 *
 * Le serveur tranche seul : il connaît les deux fenêtres de fraîcheur et sait
 * si une exécution tourne déjà, ce qu'un onglet ne peut pas savoir des autres.
 *
 * L'état vit **hors des composants**, comme le badge de Finance, et pour une
 * raison qui a coûté un relevé fantôme : le bouton n'est monté que dans un
 * dialogue fermé par défaut et dans deux états vides. Un effet d'ouverture
 * posé sur lui ne tournait donc jamais sur l'écran normal — la boîte ne se
 * relevait qu'en ouvrant « État du relevé ». C'est `useModerationSync`, posé
 * sur la pastille toujours visible, qui demande le relevé du jour ; le bouton
 * et la pastille lisent le même état, et le rafraîchissement n'est demandé
 * qu'une fois quelle que soit la quantité d'instances montées.
 */

// --- Course partagée ---------------------------------------------------------

type Store = {
  snapshot: SyncSnapshot | null;
  /** La portée en cours, pour ne faire tourner qu'un seul des deux boutons. */
  pending: SyncScope | null;
};

let store: Store = { snapshot: null, pending: null };
const listeners = new Set<() => void>();
/** Une commande en vol : deux clics, ou le clic pendant l'appel d'ouverture. */
let commanding: Promise<void> | null = null;
let poller: ReturnType<typeof setInterval> | null = null;
let ticks = 0;
/**
 * Un seul rafraîchissement par relevé terminé, même avec la pastille et le
 * bouton montés en même temps : tous parlent au même routeur, le premier
 * inscrit suffit. Un ensemble et non une case unique — le bouton, démonté à
 * la fermeture du dialogue, ne doit pas emporter celui de la pastille.
 */
const refreshers = new Set<() => void>();

/** Cinq minutes de sondage : au-delà, l'exécution a échoué ou n'a pas démarré. */
const MAX_TICKS = 50;
const TICK_MS = 6_000;

function publish(next: Partial<Store>): void {
  store = { ...store, ...next };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readStore(): Store {
  return store;
}

function stopPolling(): void {
  if (poller) clearInterval(poller);
  poller = null;
  ticks = 0;
}

/** Un relevé vient d'écrire en base : la page a quelque chose de neuf à relire. */
function finish(): void {
  stopPolling();
  publish({ pending: null });
  for (const refresh of refreshers) {
    refresh();
    break;
  }
}

/** Le sondage d'une exécution GitHub — le relevé complet, jamais celui du jour. */
function startPolling(): void {
  if (poller) return;
  ticks = 0;
  poller = setInterval(async () => {
    ticks += 1;
    if (ticks > MAX_TICKS) {
      stopPolling();
      publish({ pending: null });
      return;
    }

    const response = await fetch("/api/moderation/sync", { cache: "no-store" }).catch(
      () => null,
    );
    if (!response?.ok) return;
    const next = (await response.json().catch(() => null)) as SyncSnapshot | null;
    if (!next) return;

    publish({ snapshot: next });
    // Le passage de « en cours » à « terminé » est le seul moment où la page
    // a quelque chose de neuf à relire.
    if (!next.running) finish();
  }, TICK_MS);
}

type Command = {
  decision?: string;
  message?: string;
  snapshot?: SyncSnapshot;
};

/**
 * Demande un relevé. `force` vient du bouton, jamais de l'ouverture : c'est
 * le serveur qui juge la fraîcheur, et le toast ne parle que d'un geste.
 */
function command(scope: SyncScope, force: boolean): Promise<void> {
  if (commanding) return commanding;
  publish({ pending: scope });

  commanding = fetch("/api/moderation/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ force, portee: scope }),
  })
    .then(async (response) => {
      const payload = (await response.json().catch(() => null)) as Command | null;
      if (payload?.snapshot) publish({ snapshot: payload.snapshot });

      if (force && payload?.message) {
        if (payload.decision === "dispatch" || payload.decision === "direct") {
          toast.success(payload.message);
        } else if (payload.decision === "skip" && payload.snapshot?.unavailable) {
          toast.error(payload.message);
        } else toast.info(payload.message);
      }

      if (payload?.snapshot?.running) {
        startPolling();
        return;
      }
      // Le relevé direct a déjà écrit : la page relit tout de suite.
      if (payload?.decision === "direct") finish();
      else publish({ pending: null });
    })
    .catch(() => {
      if (force) toast.error("Le relevé n'a pas pu être lancé.");
      publish({ pending: null });
    })
    .finally(() => {
      commanding = null;
    });

  return commanding;
}

/**
 * Le déclenchement à l'ouverture, espacé de la même fenêtre que celle du
 * serveur : sans ce garde, revenir sur l'inbox enverrait une commande à
 * chaque navigation. Le serveur les refuserait — il est la seule autorité —
 * mais ce serait un appel pour rien à chaque écran.
 *
 * `sessionStorage` plutôt qu'une variable de module : un F5 vide le module,
 * pas la session, et un F5 dans les dix minutes n'a pas à relever. La clé
 * porte la portée : le compteur du relevé du jour ne doit rien dire du relevé
 * complet, qui a sa propre horloge côté serveur.
 */
const ASK_KEY = "antidotes_moderation_ask_jour";
let askedAt = 0;

function askIfDue(): void {
  let last = askedAt;
  try {
    last = Math.max(last, Number(window.sessionStorage.getItem(ASK_KEY) ?? 0));
  } catch {
    // Navigation privée, stockage bloqué : la variable de module suffit.
  }
  if (last !== 0 && Date.now() - last < FRESH_WINDOW_MINUTES * 60_000) return;
  askedAt = Date.now();
  try {
    window.sessionStorage.setItem(ASK_KEY, String(askedAt));
  } catch {
    // Idem : l'absence de mémoire ne doit pas empêcher le relevé.
  }
  void command("jour", false);
}

// --- Hook --------------------------------------------------------------------

/**
 * L'état du relevé, et le relevé du jour à l'ouverture quand on a le droit
 * de le demander. À poser sur un composant **toujours monté** de l'écran —
 * la pastille d'état — pour que l'ouverture relève bel et bien.
 */
export function useModerationSync({ canTrigger }: { canTrigger: boolean }): {
  snapshot: SyncSnapshot | null;
  pending: SyncScope | null;
  running: boolean;
} {
  const router = useRouter();
  const state = useSyncExternalStore(subscribe, readStore, readStore);

  useEffect(() => {
    if (!canTrigger) return;
    askIfDue();
  }, [canTrigger]);

  // Une exécution qui s'achève a laissé des lignes en base : la page doit les
  // relire. `router.refresh()` re-rend le serveur sans repartir de zéro.
  useEffect(() => {
    const refresh = () => router.refresh();
    refreshers.add(refresh);
    return () => {
      refreshers.delete(refresh);
    };
  }, [router]);

  return {
    snapshot: state.snapshot,
    pending: state.pending,
    running: state.pending !== null || (state.snapshot?.running ?? false),
  };
}

// --- Boutons -----------------------------------------------------------------

export function ModerationSyncButton() {
  /* Le bouton demande aussi le relevé à son montage : dans les deux états
     vides, il est le seul composant du relevé à l'écran. La fenêtre de
     `askIfDue` fait que la pastille et lui n'en demandent qu'un. */
  const { snapshot, pending, running } = useModerationSync({ canTrigger: true });
  const unavailable = snapshot?.unavailable ?? null;

  return (
    <div className="flex items-center gap-2">
      {unavailable ? (
        // Seul le relevé complet passe par GitHub : c'est lui, et lui seul,
        // que l'absence de jeton empêche. La cause exacte vit dans
        // l'infobulle — les messages de GitHub sont longs, et l'en-tête de
        // l'inbox n'a pas la place.
        <span
          className="type-caption hidden items-center gap-1 text-warning-ink lg:inline-flex"
          title={unavailable}
        >
          <CircleAlert className="size-3.5" strokeWidth={1.75} aria-hidden />
          Relevé complet indisponible
        </span>
      ) : null}

      <Button
        size="sm"
        variant="ghost"
        onClick={() => void command("complet", true)}
        disabled={running}
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
