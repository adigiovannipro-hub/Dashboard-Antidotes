import { describe, expect, it } from "vitest";

import {
  acquireLock,
  canEdit,
  readLock,
  refreshLock,
  releaseLock,
  type LockState,
} from "./locks";

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";

const T0 = new Date("2026-07-30T10:00:00Z");
const UNLOCKED: LockState = {
  locked_by: null,
  locked_at: null,
  lock_expires_at: null,
};

function heldBy(user: string, expiresAt: Date): LockState {
  return {
    locked_by: user,
    locked_at: T0.toISOString(),
    lock_expires_at: expiresAt.toISOString(),
  };
}

describe("verrou de conversation", () => {
  it("le premier qui ouvre réserve", () => {
    const outcome = acquireLock({ state: UNLOCKED, viewerId: ALICE, now: T0 });
    expect(outcome.granted).toBe(true);
    if (!outcome.granted) return;
    expect(outcome.tookOver).toBe(false);
    expect(outcome.next.locked_by).toBe(ALICE);
  });

  it("le second voit « en cours de traitement » et ne peut pas modifier", () => {
    const state = heldBy(ALICE, new Date(T0.getTime() + 5 * 60_000));

    const view = readLock(state, BOB, T0);
    expect(view.kind).toBe("held_by_other");
    if (view.kind === "held_by_other") expect(view.holderId).toBe(ALICE);

    expect(canEdit(state, BOB, T0)).toBe(false);
    expect(canEdit(state, ALICE, T0)).toBe(true);

    const outcome = acquireLock({ state, viewerId: BOB, now: T0 });
    expect(outcome.granted).toBe(false);
  });

  it("permet de reprendre la main explicitement", () => {
    const state = heldBy(ALICE, new Date(T0.getTime() + 5 * 60_000));
    const outcome = acquireLock({ state, viewerId: BOB, force: true, now: T0 });

    expect(outcome.granted).toBe(true);
    if (!outcome.granted) return;
    // La reprise est signalée pour que l'interface puisse en informer Alice.
    expect(outcome.tookOver).toBe(true);
    expect(outcome.next.locked_by).toBe(BOB);
  });

  it("libère le verrou après inactivité", () => {
    // Sans expiration, un onglet fermé bloquerait la conversation pour toujours.
    const expired = heldBy(ALICE, new Date(T0.getTime() - 1_000));

    expect(readLock(expired, BOB, T0).kind).toBe("stale");
    expect(canEdit(expired, BOB, T0)).toBe(true);

    const outcome = acquireLock({ state: expired, viewerId: BOB, now: T0 });
    expect(outcome.granted).toBe(true);
    // Reprendre un verrou périmé n'est pas une reprise de main : personne ne
    // travaillait dessus, il n'y a personne à prévenir.
    if (outcome.granted) expect(outcome.tookOver).toBe(false);
  });

  it("prolonge le verrou pendant que son détenteur travaille", () => {
    const state = heldBy(ALICE, new Date(T0.getTime() + 60_000));
    const later = new Date(T0.getTime() + 30_000);

    const refreshed = refreshLock({ state, viewerId: ALICE, now: later });
    expect(refreshed).not.toBeNull();
    expect(new Date(refreshed!.lock_expires_at!).getTime()).toBeGreaterThan(
      new Date(state.lock_expires_at!).getTime(),
    );
  });

  it("refuse de prolonger le verrou de quelqu'un d'autre", () => {
    const state = heldBy(ALICE, new Date(T0.getTime() + 60_000));
    expect(refreshLock({ state, viewerId: BOB, now: T0 })).toBeNull();
  });

  it("libère complètement", () => {
    expect(releaseLock()).toEqual(UNLOCKED);
    expect(readLock(releaseLock(), ALICE, T0).kind).toBe("unlocked");
  });
});
