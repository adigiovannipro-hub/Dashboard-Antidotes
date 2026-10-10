import { useSyncExternalStore } from "react";

import { INITIAL_STATE, STORAGE_KEY, parseStoredState, reduce, serializeState, type FunnelAction, type FunnelState } from "./state";

/**
 * L'état du tunnel vit dans `sessionStorage`, lu comme un store externe.
 *
 * C'est ce qui permet de survivre à un rechargement sans `setState` dans un
 * effet : le serveur rend toujours la première question (`getServerSnapshot`), le
 * navigateur relit l'état persisté juste après l'hydratation, et chaque
 * action réécrit la clé puis prévient les abonnés. Un stockage indisponible
 * (navigation privée stricte) retombe sur la mémoire du module.
 */

const listeners = new Set<() => void>();
let memoryRaw: string | null = null;
let cachedRaw: string | null | undefined;
let cachedState: FunnelState = INITIAL_STATE;

function readRaw(): string | null {
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored;
  } catch {
    // Stockage refusé : on lit la mémoire.
  }
  return memoryRaw;
}

function writeRaw(raw: string | null): void {
  memoryRaw = raw;
  try {
    if (raw === null) window.sessionStorage.removeItem(STORAGE_KEY);
    else window.sessionStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // Stockage refusé : la mémoire suffit le temps de la page.
  }
}

export function getSnapshot(): FunnelState {
  const raw = readRaw();
  if (raw === cachedRaw) return cachedState;
  cachedRaw = raw;
  cachedState = parseStoredState(raw) ?? INITIAL_STATE;
  return cachedState;
}

export function getServerSnapshot(): FunnelState {
  return INITIAL_STATE;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function dispatch(action: FunnelAction): FunnelState {
  const current = getSnapshot();
  const next = reduce(current, action);
  if (next === current) return current;
  const raw = next === INITIAL_STATE ? null : serializeState(next);
  writeRaw(raw);
  cachedRaw = raw;
  cachedState = next;
  for (const listener of listeners) listener();
  return next;
}

export function useFunnelState(): FunnelState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
