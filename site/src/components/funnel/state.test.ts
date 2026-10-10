import { describe, expect, it } from "vitest";

import { QUESTIONS, type Answers } from "@/lib/questionnaire";

import {
  INITIAL_STATE,
  STEP_COUNT,
  STORAGE_KEY,
  TOTAL_QUESTIONS,
  WEEK_COUNT,
  firstMissingIndex,
  groupSlotsByDay,
  optionIndexFromKey,
  parseStoredState,
  progressStep,
  reduce,
  serializeState,
  timeZoneChoices,
  utcOffsetLabel,
  weekBounds,
  type FunnelAction,
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

/** Un jeu de réponses complet et valide : la première option de chaque question. */
const COMPLETE: Answers = Object.fromEntries(QUESTIONS.map((question) => [question.id, question.options[0]]));

/** Répond aux questions dans l'ordre, à partir de l'état donné. */
function answerAll(state: FunnelState): FunnelState {
  let next = state;
  for (const question of QUESTIONS) next = reduce(next, { type: "answer", questionId: question.id, value: question.options[0] });
  return next;
}

function run(state: FunnelState, actions: FunnelAction[]): FunnelState {
  return actions.reduce(reduce, state);
}

describe("reduce — l'ordre du parcours", () => {
  it("s'ouvre sur la première question, sans intro ni adresse", () => {
    expect(INITIAL_STATE).toMatchObject({ step: "question", questionIndex: 0, leadId: null });
    expect(progressStep(INITIAL_STATE)).toBe(1);
  });

  it("les six réponses d'abord, gardées dans l'état, puis l'adresse", () => {
    const first = reduce(INITIAL_STATE, { type: "answer", questionId: QUESTIONS[0].id, value: QUESTIONS[0].options[1] });
    expect(first).toMatchObject({ step: "question", questionIndex: 1, answers: { [QUESTIONS[0].id]: QUESTIONS[0].options[1] } });
    const atEmail = answerAll(INITIAL_STATE);
    expect(atEmail.step).toBe("email");
    expect(atEmail.answers).toEqual(COMPLETE);
    expect(atEmail.leadId).toBeNull();
    expect(progressStep(atEmail)).toBe(STEP_COUNT);
  });

  it("l'adresse crée le lead et ouvre le calcul ; le verdict ouvre le rendez-vous ou les conseils", () => {
    const computing = reduce(answerAll(INITIAL_STATE), { type: "lead_created", leadId: "l1", firstName: "Ana" });
    expect(computing).toMatchObject({ step: "computing", leadId: "l1", firstName: "Ana", answers: COMPLETE });
    expect(progressStep(computing)).toBeNull();
    expect(reduce(computing, { type: "computed", temperature: "chaud" }).step).toBe("ready");
    expect(reduce(computing, { type: "computed", temperature: "tiede" }).step).toBe("ready");
    expect(reduce(computing, { type: "computed", temperature: "froid" }).step).toBe("cold");
  });

  it("puis la réservation et la confirmation", () => {
    const ready = run(answerAll(INITIAL_STATE), [
      { type: "lead_created", leadId: "l1", firstName: "Ana" },
      { type: "computed", temperature: "chaud" },
    ]);
    const confirmed = run(ready, [{ type: "book" }, { type: "confirmed", booking, timeZone: "Europe/Paris" }]);
    expect(confirmed).toMatchObject({ step: "confirmed", booking, bookingTimeZone: "Europe/Paris" });
    expect(reduce(confirmed, { type: "reset" })).toBe(INITIAL_STATE);
  });

  it("compte sept étapes : six questions et l'adresse", () => {
    expect(STEP_COUNT).toBe(7);
    expect(progressStep({ step: "question", questionIndex: 3 })).toBe(4);
    expect(progressStep({ step: "ready", questionIndex: 0 })).toBeNull();
  });
});

describe("reduce — retours en arrière", () => {
  it("question précédente ; rien avant la première", () => {
    const q2: FunnelState = { ...INITIAL_STATE, questionIndex: 2 };
    expect(reduce(q2, { type: "back" }).questionIndex).toBe(1);
    expect(reduce(INITIAL_STATE, { type: "back" })).toBe(INITIAL_STATE);
  });

  it("depuis l'adresse, la dernière question, réponses intactes", () => {
    const back = reduce(answerAll(INITIAL_STATE), { type: "back" });
    expect(back).toMatchObject({ step: "question", questionIndex: TOTAL_QUESTIONS - 1, answers: COMPLETE });
    // Répondre de nouveau ramène à l'adresse.
    const last = QUESTIONS[TOTAL_QUESTIONS - 1];
    expect(reduce(back, { type: "answer", questionId: last.id, value: last.options[1] }).step).toBe("email");
  });

  it("depuis la réservation, l'écran de résultat de la température", () => {
    expect(reduce({ ...INITIAL_STATE, step: "booking", leadId: "l1", temperature: "froid" }, { type: "back" }).step).toBe("cold");
    expect(reduce({ ...INITIAL_STATE, step: "booking", leadId: "l1", temperature: "chaud" }, { type: "back" }).step).toBe("ready");
    const computing: FunnelState = { ...INITIAL_STATE, step: "computing", leadId: "l1", answers: COMPLETE };
    expect(reduce(computing, { type: "back" })).toBe(computing);
  });
});

describe("reduce — cas limites", () => {
  it("une réponse en retard, pour une autre question que l'écran, est ignorée", () => {
    const q1 = reduce(INITIAL_STATE, { type: "answer", questionId: QUESTIONS[0].id, value: QUESTIONS[0].options[0] });
    expect(reduce(q1, { type: "answer", questionId: QUESTIONS[0].id, value: QUESTIONS[0].options[2] })).toBe(q1);
  });

  it("une réponse hors de l'étape question est ignorée", () => {
    const state: FunnelState = { ...INITIAL_STATE, step: "ready", leadId: "l1" };
    expect(reduce(state, { type: "answer", questionId: "goal", value: "x" })).toBe(state);
  });

  it("lead existant : la dernière réponse repart au calcul sans redemander l'adresse", () => {
    const withLead: FunnelState = { ...INITIAL_STATE, leadId: "l1", firstName: "Ana" };
    expect(answerAll(withLead)).toMatchObject({ step: "computing", leadId: "l1", answers: COMPLETE });
  });

  it("le serveur signale une réponse manquante : retour à cette question, puis au calcul", () => {
    const computing: FunnelState = { ...INITIAL_STATE, step: "computing", leadId: "l1", answers: COMPLETE };
    const atBudget = reduce(computing, { type: "goto_question", index: 4 });
    expect(atBudget).toMatchObject({ step: "question", questionIndex: 4 });
    const done = run(atBudget, [
      { type: "answer", questionId: QUESTIONS[4].id, value: QUESTIONS[4].options[2] },
      { type: "answer", questionId: QUESTIONS[5].id, value: QUESTIONS[5].options[0] },
    ]);
    expect(done.step).toBe("computing");
    expect(reduce(computing, { type: "goto_question", index: 99 }).questionIndex).toBe(TOTAL_QUESTIONS - 1);
  });

  it("la dernière question atteinte avec un trou renvoie à la première question sans réponse", () => {
    const gap: FunnelState = { ...INITIAL_STATE, questionIndex: TOTAL_QUESTIONS - 1, answers: { ...COMPLETE, frequency: undefined } };
    const last = QUESTIONS[TOTAL_QUESTIONS - 1];
    expect(reduce(gap, { type: "answer", questionId: last.id, value: last.options[0] })).toMatchObject({
      step: "question",
      questionIndex: QUESTIONS.findIndex((q) => q.id === "frequency"),
    });
  });

  it("adresse refusée ou réseau coupé : l'écran ne bouge pas tant qu'aucun lead n'arrive", () => {
    const atEmail = answerAll(INITIAL_STATE);
    // Aucune action n'est émise sur un refus : seul `lead_created` fait avancer.
    expect(reduce(atEmail, { type: "computed", temperature: "chaud" })).toBe(atEmail);
    expect(reduce(atEmail, { type: "book" })).toBe(atEmail);
  });

  it("calcul en échec réseau : sans température, l'écran du rendez-vous s'ouvre quand même", () => {
    const computing: FunnelState = { ...INITIAL_STATE, step: "computing", leadId: "l1", answers: COMPLETE };
    expect(reduce(computing, { type: "computed", temperature: null })).toMatchObject({ step: "ready", temperature: null });
  });

  it("un lead qui arrive après un retour aux questions est retenu sans changer d'écran", () => {
    const back: FunnelState = { ...INITIAL_STATE, questionIndex: 5, answers: COMPLETE };
    expect(reduce(back, { type: "lead_created", leadId: "l1", firstName: "Ana" })).toMatchObject({ step: "question", leadId: "l1" });
  });

  it("ne réserve que depuis un écran de résultat", () => {
    expect(reduce({ ...INITIAL_STATE, step: "ready" }, { type: "book" }).step).toBe("booking");
    expect(reduce({ ...INITIAL_STATE, step: "cold" }, { type: "book" }).step).toBe("booking");
    expect(reduce({ ...INITIAL_STATE, step: "email" }, { type: "book" }).step).toBe("email");
  });
});

describe("firstMissingIndex", () => {
  it("la première question sans réponse valable, ou rien", () => {
    expect(firstMissingIndex(COMPLETE)).toBeNull();
    expect(firstMissingIndex({})).toBe(0);
    expect(firstMissingIndex({ ...COMPLETE, budget: "inconnue" })).toBe(QUESTIONS.findIndex((q) => q.id === "budget"));
  });
});

describe("parseStoredState — reprise après rechargement", () => {
  it("relit ce qu'il a sérialisé", () => {
    const state: FunnelState = {
      ...INITIAL_STATE,
      step: "confirmed",
      leadId: "l1",
      firstName: "Ana",
      temperature: "tiede",
      answers: COMPLETE,
      booking,
      bookingTimeZone: "Europe/Paris",
    };
    expect(parseStoredState(serializeState(state))).toEqual(state);
  });

  it("reprend une question sans lead, réponses comprises", () => {
    const state: FunnelState = { ...INITIAL_STATE, questionIndex: 3, answers: { goal: "ventes", frequency: "hebdo", management: "moi" } };
    expect(parseStoredState(serializeState(state))).toEqual(state);
  });

  it("reprend l'adresse sans lead quand les six réponses sont là", () => {
    const atEmail = answerAll(INITIAL_STATE);
    expect(parseStoredState(serializeState(atEmail))).toEqual(atEmail);
  });

  it("une adresse ou un calcul aux réponses incomplètes revient à la première question manquante", () => {
    expect(parseStoredState(JSON.stringify({ step: "email", answers: { goal: "ventes" } }))).toMatchObject({ step: "question", questionIndex: 1 });
    expect(parseStoredState(JSON.stringify({ step: "computing", leadId: "l1" }))).toMatchObject({ step: "question", questionIndex: 0 });
  });

  it("un calcul avec son lead reprend tel quel ; sans lead, il revient à l'adresse", () => {
    expect(parseStoredState(JSON.stringify({ step: "computing", leadId: "l1", answers: COMPLETE }))).toMatchObject({ step: "computing", leadId: "l1" });
    expect(parseStoredState(JSON.stringify({ step: "computing", answers: COMPLETE }))).toMatchObject({ step: "email", leadId: null });
    expect(parseStoredState(JSON.stringify({ step: "ready", temperature: "chaud", answers: COMPLETE }))).toMatchObject({ step: "email" });
  });

  it("un résultat se recale sur sa température ; une confirmation sans réservation revient au résultat", () => {
    const base = { leadId: "l1", answers: COMPLETE };
    expect(parseStoredState(JSON.stringify({ ...base, step: "cold", temperature: "chaud" }))).toMatchObject({ step: "ready" });
    expect(parseStoredState(JSON.stringify({ ...base, step: "ready" }))).toMatchObject({ step: "ready", temperature: null });
    expect(parseStoredState(JSON.stringify({ ...base, step: "confirmed", temperature: "froid" }))).toMatchObject({ step: "cold" });
    expect(parseStoredState(JSON.stringify({ ...base, step: "booking", temperature: "tiede" }))).toMatchObject({ step: "booking" });
  });

  it("rejette l'illisible, l'inconnu et la forme de l'ancien ordre", () => {
    expect(parseStoredState(null)).toBeNull();
    expect(parseStoredState("{")).toBeNull();
    expect(parseStoredState(JSON.stringify({ step: "ailleurs" }))).toBeNull();
    expect(parseStoredState(JSON.stringify({ step: "intro" }))).toBeNull();
    expect(STORAGE_KEY).not.toBe("antidotes-funnel");
  });

  it("écarte les réponses à des questions inconnues et borne l'indice", () => {
    const parsed = parseStoredState(JSON.stringify({ step: "question", questionIndex: 42, answers: { goal: "x", autre: "y", budget: [1] } }));
    expect(parsed?.answers).toEqual({ goal: "x" });
    expect(parsed?.questionIndex).toBe(TOTAL_QUESTIONS - 1);
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
