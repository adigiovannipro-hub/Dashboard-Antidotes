import { describe, expect, it } from "vitest";

import {
  evaluateAutoSend,
  penalizeConfidence,
  rewardConfidence,
  type AutoSendContext,
} from "./auto-send";
import type { AutoSendSettings } from "./types";

/** Réglage permissif : tout est autorisé, pour isoler un garde-fou à la fois. */
const PERMISSIVE: AutoSendSettings = {
  enabled: true,
  min_confidence: 0.9,
  hourly_cap: 20,
  emergency_stop: false,
  eligible_channels: ["instagram"],
  eligible_categories: ["livraison"],
};

function context(overrides: Partial<AutoSendContext> = {}): AutoSendContext {
  return {
    settings: PERMISSIVE,
    conversation: {
      channel: "instagram",
      flags: [],
      status: "to_process",
      message_count: 4,
    },
    draft: {
      status: "proposed",
      confidence: 0.95,
      sources: [{ faq_entry_id: "faq-1", question: "Délais ?", similarity: 0.88 }],
    },
    sourceCategories: ["livraison"],
    autoSentLastHour: 0,
    sendWindowOpen: true,
    hasPriorInteraction: true,
    ...overrides,
  };
}

describe("auto-envoi — cas autorisé", () => {
  it("autorise quand tous les garde-fous sont satisfaits", () => {
    const decision = evaluateAutoSend(context());
    expect(decision.allowed).toBe(true);
    if (decision.allowed) expect(decision.rule.confidence).toBe(0.95);
  });
});

describe("auto-envoi — désactivé par défaut", () => {
  it("refuse quand la fonctionnalité est désactivée", () => {
    const decision = evaluateAutoSend(
      context({ settings: { ...PERMISSIVE, enabled: false } }),
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.refusals).toContain("disabled");
  });

  it("refuse tout sous arrêt d'urgence, même parfaitement conforme", () => {
    const decision = evaluateAutoSend(
      context({ settings: { ...PERMISSIVE, emergency_stop: true } }),
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.refusals).toContain("emergency_stop");
  });
});

describe("auto-envoi — exclusions systématiques, non configurables", () => {
  it("refuse un message signalé, quel que soit le réglage", () => {
    for (const flag of ["dispute", "insult", "refund", "sensitive", "spam"] as const) {
      const decision = evaluateAutoSend(
        context({
          conversation: {
            channel: "instagram",
            flags: [flag],
            status: "to_process",
            message_count: 4,
          },
        }),
      );
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) expect(decision.refusals).toContain("flagged");
    }
  });

  it("refuse un brouillon sans source FAQ", () => {
    const decision = evaluateAutoSend(
      context({ draft: { status: "proposed", confidence: 0.99, sources: [] } }),
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.refusals).toContain("no_faq_source");
  });

  it("refuse la première interaction d'un nouvel utilisateur", () => {
    // C'est le moment où une réponse automatique ratée coûte le plus cher.
    const decision = evaluateAutoSend(context({ hasPriorInteraction: false }));
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.refusals).toContain("first_interaction");
  });

  it("refuse si la fenêtre de réponse est fermée", () => {
    const decision = evaluateAutoSend(context({ sendWindowOpen: false }));
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.refusals).toContain("send_window_closed");
  });
});

describe("auto-envoi — réglages du client", () => {
  it("refuse sous le seuil de confiance", () => {
    const decision = evaluateAutoSend(
      context({
        draft: {
          status: "proposed",
          confidence: 0.89,
          sources: [{ faq_entry_id: "f", question: "q", similarity: 0.8 }],
        },
      }),
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.refusals).toContain("below_confidence");
  });

  it("refuse une confiance absente", () => {
    const decision = evaluateAutoSend(
      context({
        draft: {
          status: "proposed",
          confidence: null,
          sources: [{ faq_entry_id: "f", question: "q", similarity: 0.8 }],
        },
      }),
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.refusals).toContain("below_confidence");
  });

  it("refuse un canal non éligible", () => {
    const decision = evaluateAutoSend(
      context({
        conversation: {
          channel: "whatsapp",
          flags: [],
          status: "to_process",
          message_count: 4,
        },
      }),
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.refusals).toContain("channel_not_eligible");
  });

  it("traite une liste de canaux vide comme « aucun », jamais comme « tous »", () => {
    // L'inverse serait un piège : activer l'auto-envoi sans choisir de canal
    // ouvrirait la vanne partout.
    const decision = evaluateAutoSend(
      context({ settings: { ...PERMISSIVE, eligible_channels: [] } }),
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.refusals).toContain("channel_not_eligible");
  });

  it("exige que TOUTES les catégories citées soient éligibles", () => {
    const decision = evaluateAutoSend(
      context({ sourceCategories: ["livraison", "sav"] }),
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.refusals).toContain("category_not_eligible");
  });

  it("refuse au plafond horaire", () => {
    const atCap = evaluateAutoSend(context({ autoSentLastHour: 20 }));
    expect(atCap.allowed).toBe(false);
    if (!atCap.allowed) expect(atCap.refusals).toContain("hourly_cap_reached");

    expect(evaluateAutoSend(context({ autoSentLastHour: 19 })).allowed).toBe(true);
  });

  it("refuse un brouillon déjà traité", () => {
    const decision = evaluateAutoSend(
      context({
        draft: {
          status: "sent",
          confidence: 0.99,
          sources: [{ faq_entry_id: "f", question: "q", similarity: 0.9 }],
        },
      }),
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.refusals).toContain("draft_not_proposed");
  });
});

describe("auto-envoi — diagnostic", () => {
  it("remonte toutes les raisons de refus, pas seulement la première", () => {
    // Un opérateur qui cherche pourquoi rien ne part a besoin de la liste
    // complète, pas d'un jeu de piste.
    const decision = evaluateAutoSend(
      context({
        settings: { ...PERMISSIVE, enabled: false, eligible_channels: [] },
        conversation: {
          channel: "tiktok",
          flags: ["dispute"],
          status: "to_process",
          message_count: 1,
        },
        draft: { status: "proposed", confidence: 0.2, sources: [] },
        hasPriorInteraction: false,
        sendWindowOpen: false,
      }),
    );

    expect(decision.allowed).toBe(false);
    if (decision.allowed) return;
    expect(decision.refusals).toEqual(
      expect.arrayContaining([
        "disabled",
        "flagged",
        "no_faq_source",
        "first_interaction",
        "below_confidence",
        "channel_not_eligible",
        "send_window_closed",
      ]),
    );
  });
});

describe("confiance d'une entrée FAQ", () => {
  it("baisse à chaque correction sans jamais annuler l'entrée", () => {
    let confidence = 1;
    for (let index = 0; index < 20; index += 1) {
      confidence = penalizeConfidence(confidence);
    }
    // Plancher : l'entrée sort du champ de l'auto-envoi, elle ne disparaît pas.
    expect(confidence).toBe(0.1);
  });

  it("remonte lentement sur validation directe, plafonnée à 1", () => {
    expect(rewardConfidence(0.9)).toBe(0.95);
    expect(rewardConfidence(0.98)).toBe(1);
    expect(rewardConfidence(1)).toBe(1);
  });

  it("descend plus vite qu'elle ne remonte", () => {
    // Trois validations ne doivent pas effacer un refus.
    const afterCorrection = penalizeConfidence(1);
    let recovered = afterCorrection;
    for (let index = 0; index < 2; index += 1) recovered = rewardConfidence(recovered);
    expect(recovered).toBeLessThan(1);
  });
});
