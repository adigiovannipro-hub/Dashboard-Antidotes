/**
 * Quand relancer la synchronisation Airwallex, et comment dire son âge.
 *
 * Module **pur** : aucun accès à Supabase, à GitHub ni à l'horloge — la date
 * du moment est toujours passée en paramètre. C'est ce qui permet de le
 * tester, et c'est aussi ce qui permet au navigateur de l'importer : le badge
 * de l'en-tête compose ses libellés avec les mêmes fonctions que la route.
 *
 * Pourquoi une décision et pas un simple bouton : la synchronisation ne part
 * pas de l'hébergeur — Airwallex refuse ses adresses IP — mais d'une machine
 * GitHub, déclenchée par l'application. Une exécution coûte une minute et
 * demie de quota Actions, et le fond de tâche n'est plus horaire — deux
 * passages par jour, le reste part des écrans. Ouvrir Finance puis Factures
 * puis revenir ne doit donc pas en lancer trois : la fenêtre de fraîcheur
 * ci-dessous est ce qui sépare « la page s'actualise toute seule » de
 * « chaque F5 brûle du quota ».
 */

/** En deçà, les données sont considérées fraîches : on ne relance rien. */
export const FRESH_WINDOW_MINUTES = 10;

/**
 * Au-delà, l'âge s'affiche en encre d'avertissement.
 *
 * Le fond de tâche passe deux fois par jour (`0 15` et `40 16` UTC), et GitHub
 * lance ses schedules quatre à sept heures en retard sur ce dépôt : les deux
 * passages atterrissent dans la même soirée UTC, puis rien pendant vingt à
 * vingt-trois heures. Le seuil est donc à vingt-six heures — une journée
 * entière sans le moindre passage, ce qui n'arrive que si le fond de tâche ne
 * tourne plus, et c'est alors que l'écran doit le dire. Entre deux passages,
 * c'est l'ouverture de la page qui rafraîchit, pas le seuil.
 */
export const STALE_AFTER_MINUTES = 26 * 60;

/** Ce que l'application décide de faire au chargement d'une page Finance. */
export type SyncDecision =
  | { action: "dispatch" }
  | { action: "wait"; reason: "en-cours" }
  | { action: "skip"; reason: "fraiche" | "indisponible" };

/**
 * L'état de la chaîne, tel que la route le rend et que le badge le lit.
 *
 * Deux horloges distinctes, et c'est voulu : `lastRunAt` vient du journal
 * `finance_sync_runs` — ce que les données ont réellement reçu — tandis que
 * `lastAttemptAt` vient de GitHub — quand une exécution a été lancée. Entre
 * les deux, il y a la minute d'installation des dépendances : confondre les
 * deux ferait relancer une exécution qui vient tout juste de partir.
 */
export type SyncSnapshot = {
  /** Dernier passage journalisé en base, réussi ou non. */
  lastRunAt: string | null;
  lastRunStatus: "running" | "success" | "error" | null;
  /** Dernière exécution GitHub lancée, quel qu'en soit le sort. */
  lastAttemptAt: string | null;
  /** Une exécution est en file ou en cours. */
  running: boolean;
  /** Ce qui empêche de déclencher, en clair. `null` quand tout est en place. */
  unavailable: string | null;
};

export function decideSync(input: {
  now: Date;
  snapshot: SyncSnapshot;
  /** Le bouton : passe outre la fenêtre de fraîcheur, jamais une course en cours. */
  forced: boolean;
}): SyncDecision {
  if (input.snapshot.unavailable) return { action: "skip", reason: "indisponible" };
  if (input.snapshot.running) return { action: "wait", reason: "en-cours" };
  if (input.forced) return { action: "dispatch" };

  const age = minutesSince(input.snapshot.lastAttemptAt, input.now);
  if (age !== null && age < FRESH_WINDOW_MINUTES) {
    return { action: "skip", reason: "fraiche" };
  }
  return { action: "dispatch" };
}

/**
 * Minutes écoulées depuis un instant ISO. `null` si l'instant est absent ou
 * illisible — jamais un zéro, qui se lirait « à l'instant » et mentirait.
 */
export function minutesSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((now.getTime() - then) / 60_000));
}

/**
 * L'âge en français. `null` — aucune synchronisation connue — se dit, il ne
 * se devine pas.
 */
export function formatSyncAge(minutes: number | null): string {
  if (minutes === null) return "jamais synchronisé";
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;

  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}

/** Au-delà du seuil, l'âge est une information et non un détail. */
export function isStale(minutes: number | null): boolean {
  return minutes === null || minutes >= STALE_AFTER_MINUTES;
}
