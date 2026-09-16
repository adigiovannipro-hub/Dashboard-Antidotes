import { describe, expect, it } from "vitest";

import { demoEnrollmentNotice, isDemoEnrollment, isGmailThreadId, withoutDemoEnrollments } from "./demo-guard";
import type { EnrollmentBundle, PassageStore } from "./passage";

const bundle = (id: string, thread_id: string | null): EnrollmentBundle =>
  ({ enrollment: { id, thread_id } }) as unknown as EnrollmentBundle;

const unused = async (): Promise<never> => {
  throw new Error("lecture hors sujet");
};

const fakeStore = (rows: { threads: EnrollmentBundle[]; due: EnrollmentBundle[]; awaiting: EnrollmentBundle[] }): PassageStore => ({
  listThreadsToCheck: async () => rows.threads,
  listDue: async () => rows.due,
  listAwaitingPersonalization: async () => rows.awaiting,
  countSentSince: unused,
  countBounceWindow: unused,
  hasInteractionForMessage: unused,
  saveEnrollment: unused,
  saveContact: unused,
  advanceProspect: unused,
  addInteraction: unused,
});

describe("isGmailThreadId", () => {
  it("reconnaît un identifiant Gmail : hexadécimal, seize caractères d'ordinaire", () => {
    expect(isGmailThreadId("18c2f3a4b5d6e7f8")).toBe(true);
    expect(isGmailThreadId("19934AB0C1D2E3F4")).toBe(true);
  });

  it("refuse le fil inventé du jeu de démonstration, le vide et l'absent", () => {
    expect(isGmailThreadId("demo-thread-maison-optique-chambery")).toBe(false);
    expect(isGmailThreadId("thread-1")).toBe(false);
    expect(isGmailThreadId("")).toBe(false);
    expect(isGmailThreadId(null)).toBe(false);
    expect(isGmailThreadId(undefined)).toBe(false);
  });
});

describe("isDemoEnrollment", () => {
  it("ne juge que ce qui porte un fil : sans fil, rien ne distingue une démo d'une vraie", () => {
    expect(isDemoEnrollment({ thread_id: null })).toBe(false);
    expect(isDemoEnrollment({ thread_id: "18c2f3a4b5d6e7f8" })).toBe(false);
    expect(isDemoEnrollment({ thread_id: "demo-thread-opticien-saint-etienne" })).toBe(true);
  });
});

describe("demoEnrollmentNotice", () => {
  it("s'accorde en nombre et nomme le geste qui retire le jeu", () => {
    expect(demoEnrollmentNotice(1)).toBe(
      "1 inscription de démonstration, ignorée — pnpm seed:antidotes --reset pour la retirer",
    );
    expect(demoEnrollmentNotice(3)).toBe(
      "3 inscriptions de démonstration, ignorées — pnpm seed:antidotes --reset pour les retirer",
    );
  });
});

describe("withoutDemoEnrollments", () => {
  it("écarte les démos des fils à relire et des envois dus, et les signale", async () => {
    const seen: string[] = [];
    const store = withoutDemoEnrollments(
      fakeStore({
        threads: [bundle("vraie", "18c2f3a4b5d6e7f8"), bundle("démo-fil", "demo-thread-a")],
        due: [bundle("démo-fil", "demo-thread-a"), bundle("première-étape", null)],
        awaiting: [],
      }),
      (skipped) => seen.push(skipped.enrollment.id),
    );

    const threads = await store.listThreadsToCheck({ since: "2026-08-01", limit: 10 });
    const due = await store.listDue({ now: "2026-09-16T09:00:00Z", limit: 10 });

    expect(threads.map((row) => row.enrollment.id)).toEqual(["vraie"]);
    expect(due.map((row) => row.enrollment.id)).toEqual(["première-étape"]);
    // Une même inscription écartée deux fois : c'est l'appelant qui dédoublonne.
    expect(seen).toEqual(["démo-fil", "démo-fil"]);
  });

  it("laisse les autres lectures intactes : préparer une observation ne touche pas Gmail", async () => {
    const store = withoutDemoEnrollments(
      fakeStore({ threads: [], due: [], awaiting: [bundle("démo-fil", "demo-thread-a")] }),
      () => {
        throw new Error("ne doit pas être appelé");
      },
    );
    const awaiting = await store.listAwaitingPersonalization({ limit: 10 });
    expect(awaiting.map((row) => row.enrollment.id)).toEqual(["démo-fil"]);
  });
});
