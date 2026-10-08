import { describe, expect, it } from "vitest";

import { QUESTIONS } from "@/lib/questionnaire";

import {
  INITIAL_STATE,
  TOTAL_QUESTIONS,
  WEEK_COUNT,
  groupSlotsByDay,
  optionIndexFromKey,
  parseStoredState,
  reduce,
  serializeState,
  timeZoneChoices,
  utcOffsetLabel,
  weekBounds,
  type FunnelState,
} from "./state";

const booking = {
  id: "b1",
  start: "2026-10-20T07:00:00.000Z",
  end: "2026-10-20T07:30:00.000Z",
  meetUrl: "https://meet.jit.si/antidotes-b1",
  cancelUrl: "/rdv/tok",
  icsUrl: "/api/reservation/tok/ics",
  googleUrl: "https://calendar.google.com/x",
};

describe("reduce", () => {
  it("avance de l'intro à l'adresse, puis aux questions une fois le lead créé", () => {
    const afterStart = reduce(INITIAL_STATE, { type: "start" });
    expect(afterStart.step).toBe("email");
    const afterLead = reduce(afterStart, { type: "lead_created", leadId: "l1", firstName: "Ana" });
    expect(afterLead).toMatchObject({ step: "question", questionIndex: 0, leadId: "l1", firstName: "Ana" });
  });

  it("la dernière réponse passe au calcul, et le verdict ouvre rendez-vous ou conseils", () => {
    let state: FunnelState = { ...INITIAL_STATE, step: "question", leadId: "l1", questionIndex: TOTAL_QUESTIONS - 1 };
    state = reduce(state, { type: "answer", questionId: QUESTIONS[TOTAL_QUESTIONS - 1].id, value: "x" });
    expect(state.step).toBe("computing");
    expect(reduce(state, { type: "computed", temperature: "chaud" }).step).toBe("ready");
    expect(reduce(state, { type: "computed", temperature: "froid" }).step).toBe("cold");
    expect(reduce(state, { type: "computed", temperature: null }).step).toBe("ready");
  });

  it("une réponse hors de l'étape question est ignorée", () => {
    const state: FunnelState = { ...INITIAL_STATE, step: "ready", leadId: "l1" };
    expect(reduce(state, { type: "answer", questionId: "goal", value: "x" })).toBe(state);
  });

  it("retour : question précédente, puis l'adresse ; depuis la réservation, l'écran de résultat", () => {
    const q2: FunnelState = { ...INITIAL_STATE, step: "question", leadId: "l1", questionIndex: 2 };
    expect(reduce(q2, { type: "back" }).questionIndex).toBe(1);
    const q0 = { ...q2, questionIndex: 0 };
    expect(reduce(q0, { type: "back" }).step).toBe("email");
    const booking: FunnelState = { ...INITIAL_STATE, step: "booking", leadId: "l1", temperature: "froid" };
    expect(reduce(booking, { type: "back" }).step).toBe("cold");
  });

  it("ne réserve que depuis un écran de résultat", () => {
    expect(reduce({ ...INITIAL_STATE, step: "ready" }, { type: "book" }).step).toBe("booking");
    expect(reduce({ ...INITIAL_STATE, step: "cold" }, { type: "book" }).step).toBe("booking");
    expect(reduce({ ...INITIAL_STATE, step: "email" }, { type: "book" }).step).toBe("email");
  });
});

describe("parseStoredState", () => {
  it("relit ce qu'il a sérialisé", () => {
    const state: FunnelState = {
      ...INITIAL_STATE,
      step: "confirmed",
      leadId: "l1",
      firstName: "Ana",
      temperature: "tiede",
      answers: { goal: "ventes", budget: "3k_8k" },
      booking,
      bookingTimeZone: "Europe/Paris",
    };
    expect(parseStoredState(serializeState(state))).toEqual(state);
  });

  it("rejette l'illisible et l'inconnu", () => {
    expect(parseStoredState(null)).toBeNull();
    expect(parseStoredState("{")).toBeNull();
    expect(parseStoredState(JSON.stringify({ step: "ailleurs" }))).toBeNull();
  });

  it("repart de zéro sans lead, et revient à la dernière question depuis le calcul", () => {
    expect(parseStoredState(JSON.stringify({ step: "question", questionIndex: 4 }))).toEqual(INITIAL_STATE);
    const computing = parseStoredState(JSON.stringify({ step: "computing", leadId: "l1" }));
    expect(computing).toMatchObject({ step: "question", questionIndex: TOTAL_QUESTIONS - 1 });
  });

  it("un résultat sans température ou une confirmation sans réservation reviennent en arrière", () => {
    expect(parseStoredState(JSON.stringify({ step: "ready", leadId: "l1" }))).toMatchObject({ step: "question" });
    expect(parseStoredState(JSON.stringify({ step: "confirmed", leadId: "l1", temperature: "froid" }))).toMatchObject({ step: "cold" });
  });

  it("écarte les réponses à des questions inconnues", () => {
    const parsed = parseStoredState(JSON.stringify({ step: "question", leadId: "l1", answers: { goal: "x", autre: "y", budget: [1] } }));
    expect(parsed?.answers).toEqual({ goal: "x" });
  });
});

describe("optionIndexFromKey", () => {
  it("chiffres et lettres, bornés au nombre d'options", () => {
    expect(optionIndexFromKey("1", 4)).toBe(0);
    expect(optionIndexFromKey("d", 4)).toBe(3);
    expect(optionIndexFromKey("E", 4)).toBeNull();
    expect(optionIndexFromKey("Enter", 4)).toBeNull();
    expect(optionIndexFromKey("0", 4)).toBeNull();
  });
});

describe("groupSlotsByDay", () => {
  it("groupe par jour civil du visiteur, pas en UTC", () => {
    const slots = [
      { start: "2026-10-20T23:30:00.000Z", end: "2026-10-21T00:00:00.000Z" },
      { start: "2026-10-20T07:00:00.000Z", end: "2026-10-20T07:30:00.000Z" },
    ];
    const paris = groupSlotsByDay(slots, "Europe/Paris");
    expect(paris.map((g) => g.day)).toEqual(["2026-10-20", "2026-10-21"]);
    const utc = groupSlotsByDay(slots, "UTC");
    expect(utc.map((g) => g.day)).toEqual(["2026-10-20"]);
    expect(utc[0].slots[0].start).toBe("2026-10-20T07:00:00.000Z");
  });
});

describe("weekBounds", () => {
  it("la dernière semaine est rognée à l'horizon", () => {
    const now = new Date("2026-10-08T00:00:00.000Z");
    const first = weekBounds(now, 0);
    expect(first.to.getTime() - first.from.getTime()).toBe(7 * 86_400_000);
    const last = weekBounds(now, WEEK_COUNT - 1);
    expect(last.to.getTime()).toBeLessThanOrEqual(now.getTime() + 30 * 86_400_000);
    expect(weekBounds(now, 99).from.getTime()).toBe(last.from.getTime());
  });
});

describe("fuseaux", () => {
  it("décalage lisible, heure d'été comprise", () => {
    expect(utcOffsetLabel("Asia/Makassar", new Date("2026-10-20T00:00:00Z"))).toBe("UTC+8");
    expect(utcOffsetLabel("Europe/Paris", new Date("2026-07-01T00:00:00Z"))).toBe("UTC+2");
    expect(utcOffsetLabel("Europe/Paris", new Date("2026-12-01T00:00:00Z"))).toBe("UTC+1");
    expect(utcOffsetLabel("Asia/Kolkata", new Date("2026-12-01T00:00:00Z"))).toBe("UTC+5:30");
    expect(utcOffsetLabel("UTC", new Date())).toBe("UTC");
  });

  it("le fuseau détecté vient en tête, sans doublon", () => {
    const choices = timeZoneChoices("Europe/Paris");
    expect(choices[0]).toBe("Europe/Paris");
    expect(choices.filter((z) => z === "Europe/Paris")).toHaveLength(1);
    expect(timeZoneChoices("Asia/Jakarta")[0]).toBe("Asia/Jakarta");
  });
});
