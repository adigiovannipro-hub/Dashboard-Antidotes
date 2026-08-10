import { describe, expect, it } from "vitest";

import {
  effectiveConfidence,
  evaluateAutoForward,
  shouldSuggestAutomation,
  type AutoForwardContext,
} from "./auto-forward";
import type { MatchResult } from "./matching";
import { DEFAULT_SOURCE_SETTINGS } from "./types";

const match = (overrides: Partial<MatchResult> = {}): MatchResult => ({
  best: {
    expense_id: "exp-1",
    confidence: 0.95,
    method: "exact",
    reason: "Montant identique · Même jour",
  },
  candidates: [],
  ambiguous: false,
  ...overrides,
});

/** Contexte du cas nominal : tout est réuni pour que la pièce parte seule. */
const context = (overrides: Partial<AutoForwardContext> = {}): AutoForwardContext => ({
  settings: { ...DEFAULT_SOURCE_SETTINGS.auto_forward, enabled: true },
  document: {
    kind: "invoice",
    classification_confidence: 0.96,
    amount_cents: 2450,
    currency: "EUR",
    status: "awaiting_validation",
  },
  billedEurCents: 2450,
  match: match(),
  rule: { auto_forward: true },
  senderDomain: "grab.com",
  ignoredSenders: [],
  autoForwardedLastHour: 0,
  ...overrides,
});

describe("evaluateAutoForward", () => {
  it("autorise le cas nominal", () => {
    const decision = evaluateAutoForward(context());
    expect(decision.allowed).toBe(true);
  });

  it("refuse par défaut, réglages d'origine", () => {
    // Le défaut compte : un outil qui envoie des mails en votre nom ne doit
    // rien envoyer tant que personne ne le lui a demandé.
    const decision = evaluateAutoForward(
      context({ settings: DEFAULT_SOURCE_SETTINGS.auto_forward }),
    );
    expect(decision).toMatchObject({ allowed: false });
    if (!decision.allowed) expect(decision.refusals).toContain("disabled");
  });

  it("refuse sur arrêt d'urgence même tout le reste étant vert", () => {
    const decision = evaluateAutoForward(
      context({
        settings: {
          ...DEFAULT_SOURCE_SETTINGS.auto_forward,
          enabled: true,
          emergency_stop: true,
        },
      }),
    );
    expect(decision).toMatchObject({ allowed: false });
    if (!decision.allowed) expect(decision.refusals).toContain("emergency_stop");
  });

  it("refuse un rapprochement ambigu quelle que soit la confiance", () => {
    const decision = evaluateAutoForward(
      context({ match: match({ ambiguous: true }) }),
    );
    expect(decision).toMatchObject({ allowed: false });
    if (!decision.allowed) expect(decision.refusals).toContain("ambiguous_match");
  });

  it("refuse un fournisseur jamais approuvé, même avec une confiance parfaite", () => {
    // L'automatisme se mérite domaine par domaine : c'est l'utilisateur qui
    // l'accorde, pas le score.
    const decision = evaluateAutoForward(
      context({
        rule: null,
        document: {
          kind: "invoice",
          classification_confidence: 1,
          amount_cents: 100,
          currency: "EUR",
          status: "awaiting_validation",
        },
      }),
    );
    expect(decision).toMatchObject({ allowed: false });
    if (!decision.allowed) {
      expect(decision.refusals).toContain("merchant_not_trusted");
    }
  });

  it("refuse au-dessus du plafond de montant", () => {
    const decision = evaluateAutoForward(
      context({
        document: {
          kind: "invoice",
          classification_confidence: 0.99,
          amount_cents: 120_000,
          currency: "EUR",
          status: "awaiting_validation",
        },
        billedEurCents: 120_000,
      }),
    );
    expect(decision).toMatchObject({ allowed: false });
    if (!decision.allowed) expect(decision.refusals).toContain("amount_above_cap");
  });

  it("laisse passer une course en roupies dont le débit est modeste", () => {
    // Le cas qui bloquait tout : 154 400 IDR — 7,56 € — pesait 15 440 000
    // « centimes » et dépassait n'importe quel plafond pensé en euros.
    const decision = evaluateAutoForward(
      context({
        document: {
          kind: "invoice",
          classification_confidence: 0.96,
          amount_cents: 15_440_000,
          currency: "IDR",
          status: "awaiting_validation",
        },
        billedEurCents: 756,
      }),
    );
    expect(decision).toMatchObject({ allowed: true });
  });

  it("refuse une devise étrangère dont on ignore le débit", () => {
    // Ne pas savoir combien on engage n'autorise pas à l'engager.
    const decision = evaluateAutoForward(
      context({
        document: {
          kind: "invoice",
          classification_confidence: 0.96,
          amount_cents: 15_440_000,
          currency: "IDR",
          status: "awaiting_validation",
        },
        billedEurCents: null,
      }),
    );
    expect(decision).toMatchObject({ allowed: false });
    if (!decision.allowed) expect(decision.refusals).toContain("amount_above_cap");
  });

  it("refuse une pièce sans valeur comptable", () => {
    const decision = evaluateAutoForward(
      context({
        document: {
          kind: "other",
          classification_confidence: 0.99,
          amount_cents: 1000,
          currency: "EUR",
          status: "awaiting_validation",
        },
      }),
    );
    expect(decision).toMatchObject({ allowed: false });
    if (!decision.allowed) expect(decision.refusals).toContain("not_accountable");
  });

  it("refuse quand aucune dépense ne correspond et que le rapprochement est exigé", () => {
    const decision = evaluateAutoForward(
      context({ match: match({ best: null }) }),
    );
    expect(decision).toMatchObject({ allowed: false });
    if (!decision.allowed) expect(decision.refusals).toContain("no_expense_match");
  });

  it("accepte sans dépense correspondante si le rapprochement n'est pas exigé", () => {
    const decision = evaluateAutoForward(
      context({
        settings: {
          ...DEFAULT_SOURCE_SETTINGS.auto_forward,
          enabled: true,
          require_expense_match: false,
        },
        match: match({ best: null }),
      }),
    );
    expect(decision.allowed).toBe(true);
  });

  it("refuse au-delà du plafond horaire", () => {
    const decision = evaluateAutoForward(context({ autoForwardedLastHour: 10 }));
    expect(decision).toMatchObject({ allowed: false });
    if (!decision.allowed) {
      expect(decision.refusals).toContain("hourly_cap_reached");
    }
  });

  it("refuse un expéditeur mis de côté", () => {
    const decision = evaluateAutoForward(
      context({ ignoredSenders: ["grab.com"] }),
    );
    expect(decision).toMatchObject({ allowed: false });
    if (!decision.allowed) expect(decision.refusals).toContain("sender_ignored");
  });

  it("refuse une pièce déjà traitée", () => {
    const decision = evaluateAutoForward(
      context({
        document: {
          kind: "invoice",
          classification_confidence: 0.99,
          amount_cents: 1000,
          currency: "EUR",
          status: "forwarded",
        },
      }),
    );
    expect(decision).toMatchObject({ allowed: false });
    if (!decision.allowed) expect(decision.refusals).toContain("already_decided");
  });

  it("énumère toutes les raisons, pas seulement la première", () => {
    const decision = evaluateAutoForward(
      context({
        settings: DEFAULT_SOURCE_SETTINGS.auto_forward,
        rule: null,
        match: match({ best: null, ambiguous: true }),
      }),
    );
    expect(decision).toMatchObject({ allowed: false });
    if (!decision.allowed) expect(decision.refusals.length).toBeGreaterThan(3);
  });
});

describe("effectiveConfidence", () => {
  it("retient le maillon le plus faible", () => {
    expect(effectiveConfidence(0.98, 0.62, true)).toBe(0.62);
    expect(effectiveConfidence(0.55, 0.99, true)).toBe(0.55);
  });

  it("annule la confiance si le rapprochement est exigé et absent", () => {
    expect(effectiveConfidence(0.99, null, true)).toBe(0);
  });

  it("retombe sur la classification seule si le rapprochement est facultatif", () => {
    expect(effectiveConfidence(0.91, null, false)).toBe(0.91);
  });
});

describe("shouldSuggestAutomation", () => {
  it("propose après le nombre de validations concordantes", () => {
    expect(
      shouldSuggestAutomation(
        { approvals: 3, rejections: 0, auto_forward: false },
        3,
      ),
    ).toBe(true);
  });

  it("ne propose pas avant le seuil", () => {
    expect(
      shouldSuggestAutomation(
        { approvals: 2, rejections: 0, auto_forward: false },
        3,
      ),
    ).toBe(false);
  });

  it("ne propose plus dès qu'un refus est survenu", () => {
    // Un seul refus suffit : le cas n'est pas aussi routinier qu'il en avait
    // l'air, et proposer l'automatisme dessus serait mal venu.
    expect(
      shouldSuggestAutomation(
        { approvals: 12, rejections: 1, auto_forward: false },
        3,
      ),
    ).toBe(false);
  });

  it("ne propose pas ce qui est déjà automatique", () => {
    expect(
      shouldSuggestAutomation(
        { approvals: 9, rejections: 0, auto_forward: true },
        3,
      ),
    ).toBe(false);
  });
});
