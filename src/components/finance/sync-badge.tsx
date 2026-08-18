"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  FRESH_WINDOW_MINUTES,
  formatSyncAge,
  isStale,
  minutesSince,
  type SyncSnapshot,
} from "@/lib/finance/sync-state";
import { cn } from "@/lib/utils";

/**
 * L'âge des données Airwallex, et de quoi les rafraîchir — en tête de Finance
 * et d'Échéances.
 *
 * Il a remplacé une bande qui affichait un horodatage suivi de « mise à jour
 * chaque heure ». La promesse était fausse : le passage programmé est un cron
 * GitHub, et GitHub en laisse tomber près d'un sur deux — un matin de semaine,
 * l'écran de 11 h montrait des chiffres de 5 h sous une étiquette qui
 * annonçait le contraire. Deux corrections, donc : l'âge se dit en clair et
 * passe en encre d'avertissement quand il traîne, et **le chargement de la
 * page relance la synchronisation** au lieu d'attendre un passage qui n'aura
 * peut-être pas lieu.
 *
 * Le bouton reste, pour le cas où l'on vient de saisir une facture chez
 * Airwallex et où l'on veut la voir sans attendre les dix minutes de la
 * fenêtre de fraîcheur.
 */

// --- Course partagée ---------------------------------------------------------

/**
 * L'état vit **hors des composants** : passer de Finance à Échéances démonte
 * le badge, et la synchronisation en cours ne doit ni repartir de zéro, ni
 * repartir tout court. Même raison que le bouton du Reporting, à ceci près
 * qu'ici la course dure une à deux minutes — le temps qu'une machine GitHub
 * installe ses dépendances et appelle Airwallex.
 */
type Store = {
  snapshot: SyncSnapshot | null;
  /** Une commande est en vol, ou une exécution tourne. */
  busy: boolean;
};

let store: Store = { snapshot: null, busy: false };
const listeners = new Set<() => void>();
/** Prévenus quand une exécution s'achève : c'est le signal du rafraîchissement. */
const completions = new Set<() => void>();
let poller: ReturnType<typeof setInterval> | null = null;
let ticks = 0;
let commanding: Promise<void> | null = null;

/** Cinq minutes de sondage : au-delà, l'exécution a échoué ou n'a jamais démarré. */
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

function finish(): void {
  stopPolling();
  publish({ busy: false });
  for (const listener of completions) listener();
}

function startPolling(): void {
  if (poller) return;
  ticks = 0;
  poller = setInterval(async () => {
    ticks += 1;
    if (ticks > MAX_TICKS) {
      finish();
      return;
    }

    const response = await fetch("/api/finance/sync", { cache: "no-store" }).catch(
      () => null,
    );
    if (!response?.ok) return;

    const snapshot = (await response.json().catch(() => null)) as SyncSnapshot | null;
    if (!snapshot) return;

    publish({ snapshot });
    // Le passage de « en cours » à « terminé » est le seul moment où la page
    // a quelque chose de neuf à relire.
    if (!snapshot.running) finish();
  }, TICK_MS);
}

/**
 * Demande une synchronisation. Le serveur tranche : il connaît la fenêtre de
 * fraîcheur et sait si une exécution tourne déjà — le navigateur, lui, ne
 * saurait pas qu'un autre onglet vient d'en lancer une.
 *
 * `force` vient du bouton, jamais du chargement de page.
 */
function command(force: boolean): Promise<void> {
  if (commanding) return commanding;

  publish({ busy: true });

  commanding = fetch("/api/finance/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ force }),
  })
    .then(async (response) => {
      const payload = (await response.json().catch(() => null)) as {
        decision?: string;
        message?: string;
        snapshot?: SyncSnapshot;
      } | null;

      if (payload?.snapshot) publish({ snapshot: payload.snapshot });

      if (force && payload?.message) {
        if (payload.decision === "dispatch") toast.success(payload.message);
        else if (payload.decision === "skip" && payload.snapshot?.unavailable) {
          toast.error(payload.message);
        } else toast.info(payload.message);
      }

      if (payload?.snapshot?.running) startPolling();
      else publish({ busy: false });
    })
    .catch(() => {
      if (force) toast.error("La synchronisation n'a pas pu être lancée.");
      publish({ busy: false });
    })
    .finally(() => {
      commanding = null;
    });

  return commanding;
}

/**
 * Le déclenchement au chargement d'une page, espacé de la même fenêtre que
 * celle du serveur.
 *
 * Sans ce garde, l'aller-retour Finance ↔ Échéances enverrait une commande à
 * chaque navigation. Le serveur les refuserait — la fenêtre de fraîcheur est
 * la seule autorité, un autre onglet pouvant très bien venir d'en lancer une —
 * mais ce serait un appel pour rien à chaque écran. Une horloge et non un
 * drapeau : au bout de dix minutes, revenir sur Finance doit bel et bien
 * relancer la collecte, c'est tout l'intérêt.
 */
let askedAt = 0;

function askIfDue(): void {
  const elapsed = Date.now() - askedAt;
  if (askedAt !== 0 && elapsed < FRESH_WINDOW_MINUTES * 60_000) return;
  askedAt = Date.now();
  void command(false);
}

// --- Horloge -----------------------------------------------------------------

/** Un palier de trente secondes : « il y a 6 h » n'a pas besoin de la seconde. */
const CLOCK_MS = 30_000;

function subscribeClock(listener: () => void): () => void {
  const id = setInterval(listener, CLOCK_MS);
  return () => clearInterval(id);
}

function readClock(): number {
  return Math.floor(Date.now() / CLOCK_MS);
}

/** Au serveur, pas d'horloge du tout — l'instant absolu s'affiche à la place. */
function readServerClock(): null {
  return null;
}

// --- Badge -------------------------------------------------------------------

export function SyncBadge({
  lastRunAt,
  lastRunStatus,
  canTrigger,
}: {
  /** Dernier passage connu au rendu serveur, avant que le badge n'interroge. */
  lastRunAt: string | null;
  lastRunStatus: "running" | "success" | "error" | null;
  /** Le propriétaire seul commande la collecte. */
  canTrigger: boolean;
}) {
  const router = useRouter();
  const state = useSyncExternalStore(subscribe, readStore, readStore);

  /* L'horloge du badge, et non l'heure exacte : `null` au rendu serveur, un
     palier de trente secondes ensuite. L'âge relatif ne peut pas être rendu au
     serveur — il différerait de celui du navigateur et casserait l'hydratation
     — d'où l'instant absolu en première image. Le palier est ce qui rend
     `getSnapshot` stable entre deux battements. */
  const tick = useSyncExternalStore(subscribeClock, readClock, readServerClock);
  const nowMs = tick === null ? null : tick * CLOCK_MS;

  useEffect(() => {
    if (!canTrigger) return;
    askIfDue();
  }, [canTrigger]);

  // Une exécution qui s'achève a laissé des lignes en base : la page doit les
  // relire. `router.refresh()` re-rend le serveur sans repartir de zéro.
  useEffect(() => {
    const listener = () => router.refresh();
    completions.add(listener);
    return () => {
      completions.delete(listener);
    };
  }, [router]);

  const snapshot = state.snapshot;
  const instant = snapshot?.lastRunAt ?? lastRunAt;
  const status = snapshot?.lastRunStatus ?? lastRunStatus;
  const running = state.busy || (snapshot?.running ?? false);
  const unavailable = snapshot?.unavailable ?? null;

  const age = nowMs === null ? null : minutesSince(instant, new Date(nowMs));
  const stale = !running && instant !== null && isStale(age) && nowMs !== null;

  return (
    <div className="flex items-center gap-3">
      {/* La cause exacte d'une indisponibilité vit dans l'infobulle et non dans
          la ligne : une phrase de quatre-vingts caractères posée dans l'en-tête
          repoussait la description de la page sur trois lignes, et les messages
          de GitHub peuvent être plus longs encore. L'écran garde l'âge — la
          seule information dont on a besoin à chaque visite — et signale d'un
          mot que la relance ne répond pas. */}
      <p
        className={cn(
          "type-caption flex items-center gap-1.5",
          stale || unavailable ? "text-warning-ink" : "text-text-secondary",
        )}
        title={unavailable ?? undefined}
        aria-live="polite"
      >
        {unavailable ? (
          <CircleAlert strokeWidth={1.75} className="size-4 shrink-0" aria-hidden />
        ) : (
          <RefreshCw
            strokeWidth={1.75}
            className={cn(
              "size-4 shrink-0",
              running ? "animate-spin text-text-secondary" : "text-text-tertiary",
            )}
            aria-hidden
          />
        )}
        {describe({ unavailable, running, instant, status, age, nowMs })}
      </p>

      {/* Un seul témoin de course à l'écran : c'est la ligne d'état qui tourne
          et qui parle, le bouton se contente de se désarmer. Deux spinners
          côte à côte et le mot « synchronisation » écrit deux fois
          n'apprenaient rien de plus. */}
      {canTrigger && !unavailable ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => void command(true)}
          disabled={running}
        >
          <RefreshCw strokeWidth={1.75} aria-hidden />
          Synchroniser
        </Button>
      ) : null}
    </div>
  );
}

function describe({
  unavailable,
  running,
  instant,
  status,
  age,
  nowMs,
}: {
  unavailable: string | null;
  running: boolean;
  instant: string | null;
  status: "running" | "success" | "error" | null;
  age: number | null;
  nowMs: number | null;
}): React.ReactNode {
  if (running) return "Synchronisation en cours…";
  if (!instant) {
    return unavailable
      ? "Relance indisponible"
      : "Aucune synchronisation encore passée.";
  }

  const absolute = formatInstant(instant);

  // Pas d'espace littéral entre les deux : le conteneur est un `flex` à
  // `gap-1.5`, l'espace s'ajouterait au sien et creuserait un blanc double.
  return (
    <>
      Synchronisé
      <time dateTime={instant} title={absolute} className="tabular-nums">
        {/* Avant le montage, l'instant absolu — le relatif dépend de l'heure
            du navigateur et ne peut pas être rendu au serveur. */}
        {nowMs === null ? absolute : formatSyncAge(age)}
      </time>
      {status === "error" ? <span className="text-danger-ink">— en échec</span> : null}
      {unavailable ? <span>· relance indisponible</span> : null}
    </>
  );
}

const INSTANT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

function formatInstant(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return INSTANT.format(date);
}
