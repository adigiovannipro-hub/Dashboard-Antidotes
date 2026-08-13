"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLinkStatus } from "next/link";

import { cn } from "@/lib/utils";

/**
 * Le fil de progression de la navigation.
 *
 * Le défaut qu'il corrige : entre le clic sur un onglet et l'arrivée de la
 * page, **rien ne bouge**. Les pages sont rendues côté serveur, donc le
 * navigateur garde l'écran précédent le temps de l'aller-retour — de la
 * dizaine de millisecondes à la seconde selon la page. Pendant ce temps, la
 * seule lecture possible est « mon clic n'a pas été pris ». On reclique.
 *
 * Deux réponses, et il faut les deux :
 *   — locale, sur le lien cliqué lui-même (`LinkPending`, voir plus bas) ;
 *   — globale, ce fil de deux pixels en haut de l'écran, qui dit « ça
 *     travaille » sans qu'on ait à retrouver des yeux le lien qu'on a cliqué.
 *
 * ── Pourquoi un compteur partagé ────────────────────────────────────────────
 *
 * `useLinkStatus` de Next ne répond que **dans** le `<Link>` qui navigue : il
 * n'existe pas d'état de navigation global. On le reconstruit donc à la main —
 * chaque lien de navigation porte un `<LinkPending />` invisible qui s'inscrit
 * dans un compteur de module, et le fil s'y abonne par `useSyncExternalStore`.
 * Un compteur et non un booléen : deux liens peuvent être en attente en même
 * temps (un clic, puis un second avant la réponse), et le premier qui se
 * termine ne doit pas éteindre le fil du second.
 */

/* --- Le compteur partagé --------------------------------------------------- */

let pendingCount = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => pendingCount;
/** Le serveur ne navigue pas : zéro, et aucun écart d'hydratation. */
const getServerSnapshot = () => 0;

/**
 * Balise à poser **à l'intérieur** d'un `<Link>` de navigation.
 *
 * Ne rend rien : elle ne sert qu'à faire remonter l'attente de son lien. Elle
 * doit être un enfant du `Link`, sinon `useLinkStatus` reste muet — c'est le
 * contrat de l'API, et un appel posé à côté ne lève pas, il ne dit jamais rien.
 */
export function LinkPending() {
  const { pending } = useLinkStatus();

  useEffect(() => {
    if (!pending) return;
    pendingCount += 1;
    emit();
    return () => {
      pendingCount -= 1;
      emit();
    };
  }, [pending]);

  return null;
}

/**
 * Vrai tant qu'une navigation lancée depuis ce lien n'a pas abouti.
 *
 * Même contrat que `LinkPending` : à appeler depuis un composant enfant du
 * `<Link>`. Sert aux indicateurs locaux — l'onglet qui se met en attente.
 */
export function useNavigationPending(): boolean {
  return useLinkStatus().pending;
}

/* --- Le fil ---------------------------------------------------------------- */

/**
 * Sous ce seuil, on n'affiche rien.
 *
 * Une page déjà préchargée revient en quelques dizaines de millisecondes : un
 * fil qui apparaîtrait et disparaîtrait aussitôt serait perçu comme un
 * clignotement, c'est-à-dire comme un défaut. Le fil est là pour l'attente,
 * pas pour l'instantané.
 */
const SHOW_DELAY_MS = 120;

/** Durée de la fin de course : le fil rejoint le bord, puis s'efface. */
const SETTLE_MS = 260;

type Phase = "idle" | "loading" | "done";

/**
 * Le fil lui-même, monté une seule fois dans le cadre applicatif.
 *
 * `aria-hidden` et aucun `role="progressbar"` : la valeur n'a aucun sens —
 * elle est décorative, calée sur une courbe et non sur un avancement réel. Un
 * lecteur d'écran annonce déjà le changement de page ; lui lire « 47 % » d'une
 * progression inventée serait pire que le silence.
 */
export function RouteProgress() {
  const pending =
    useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) > 0;

  const [phase, setPhase] = useState<Phase>("idle");
  // La phase est lue dans un `setTimeout`, donc hors du rendu : un état seul
  // y serait périmé d'un tour.
  const phaseRef = useRef<Phase>("idle");

  const goTo = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    if (pending) {
      const timer = setTimeout(() => goTo("loading"), SHOW_DELAY_MS);
      return () => clearTimeout(timer);
    }

    // Navigation plus rapide que le seuil : le fil n'est jamais apparu, il n'a
    // pas à jouer une fin de course.
    if (phaseRef.current !== "loading") {
      goTo("idle");
      return;
    }

    goTo("done");
    const timer = setTimeout(() => goTo("idle"), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [pending, goTo]);

  if (phase === "idle") return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5"
    >
      <span
        className={cn(
          "block h-full w-full origin-left bg-brand",
          phase === "loading" ? "route-progress-run" : "route-progress-done",
        )}
      />
    </div>
  );
}
