/**
 * Verrou optimiste sur une conversation.
 *
 * Plusieurs personnes travaillent la même inbox, y compris le client lui-même
 * s'il a un rôle opérateur. Le premier qui ouvre une conversation la réserve ;
 * les autres la voient en lecture seule avec « en cours de traitement par X » et
 * peuvent reprendre la main explicitement.
 *
 * Le verrou expire automatiquement après inactivité : sans cela, un onglet
 * fermé bloquerait une conversation indéfiniment.
 */

export const DEFAULT_LOCK_TTL_MS = 5 * 60 * 1000;

export type LockState = {
  locked_by: string | null;
  locked_at: string | null;
  lock_expires_at: string | null;
};

export type LockView =
  | { kind: "unlocked" }
  | { kind: "held_by_me"; expiresAt: Date }
  | { kind: "held_by_other"; holderId: string; expiresAt: Date }
  /** Verrou périmé : n'importe qui peut le reprendre sans conflit. */
  | { kind: "stale"; previousHolderId: string };

export function readLock(
  state: LockState,
  viewerId: string,
  now: Date = new Date(),
): LockView {
  if (!state.locked_by || !state.lock_expires_at) return { kind: "unlocked" };

  const expiresAt = new Date(state.lock_expires_at);
  if (expiresAt.getTime() <= now.getTime()) {
    return { kind: "stale", previousHolderId: state.locked_by };
  }

  if (state.locked_by === viewerId) return { kind: "held_by_me", expiresAt };
  return { kind: "held_by_other", holderId: state.locked_by, expiresAt };
}

/** Un opérateur peut-il modifier la conversation en l'état ? */
export function canEdit(
  state: LockState,
  viewerId: string,
  now: Date = new Date(),
): boolean {
  const view = readLock(state, viewerId, now);
  return view.kind !== "held_by_other";
}

export type AcquireOutcome =
  | { granted: true; next: LockState; tookOver: boolean }
  | { granted: false; holderId: string; expiresAt: Date };

/**
 * Tente d'acquérir le verrou.
 *
 * `force` correspond au clic « reprendre la main » : il est toujours accordé,
 * parce qu'un opérateur qui voit son collègue parti déjeuner doit pouvoir
 * avancer. Ce n'est pas un verrou de sécurité, c'est un verrou de courtoisie —
 * il évite les collisions accidentelles, pas les décisions délibérées.
 */
export function acquireLock(options: {
  state: LockState;
  viewerId: string;
  force?: boolean;
  ttlMs?: number;
  now?: Date;
}): AcquireOutcome {
  const { state, viewerId, force = false } = options;
  const ttlMs = options.ttlMs ?? DEFAULT_LOCK_TTL_MS;
  const now = options.now ?? new Date();
  const view = readLock(state, viewerId, now);

  if (view.kind === "held_by_other" && !force) {
    return { granted: false, holderId: view.holderId, expiresAt: view.expiresAt };
  }

  return {
    granted: true,
    tookOver: view.kind === "held_by_other",
    next: {
      locked_by: viewerId,
      locked_at: now.toISOString(),
      lock_expires_at: new Date(now.getTime() + ttlMs).toISOString(),
    },
  };
}

/** Prolonge le verrou pendant que l'opérateur travaille (frappe, scroll). */
export function refreshLock(options: {
  state: LockState;
  viewerId: string;
  ttlMs?: number;
  now?: Date;
}): LockState | null {
  const { state, viewerId } = options;
  const now = options.now ?? new Date();
  if (readLock(state, viewerId, now).kind !== "held_by_me") return null;

  return {
    ...state,
    lock_expires_at: new Date(
      now.getTime() + (options.ttlMs ?? DEFAULT_LOCK_TTL_MS),
    ).toISOString(),
  };
}

export function releaseLock(): LockState {
  return { locked_by: null, locked_at: null, lock_expires_at: null };
}
