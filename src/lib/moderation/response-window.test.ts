import { describe, expect, it } from "vitest";

import {
  computeWindowExpiry,
  evaluateSendEligibility,
  formatWindow,
  isWindowed,
} from "./response-window";

const HOUR = 60 * 60 * 1000;
const T0 = new Date("2026-07-30T10:00:00Z");

function at(hoursLater: number): Date {
  return new Date(T0.getTime() + hoursLater * HOUR);
}

describe("périmètre de la fenêtre", () => {
  it("s'applique aux messages privés Meta et WhatsApp", () => {
    expect(isWindowed("instagram", "dm")).toBe(true);
    expect(isWindowed("facebook", "dm")).toBe(true);
    expect(isWindowed("whatsapp", "dm")).toBe(true);
  });

  it("ne s'applique pas aux commentaires publics", () => {
    // On peut répondre à un commentaire de l'an dernier.
    expect(isWindowed("instagram", "comment")).toBe(false);
    expect(isWindowed("facebook", "comment")).toBe(false);
  });

  it("ne s'applique pas aux avis ni aux mentions", () => {
    expect(isWindowed("google_reviews", "review")).toBe(false);
    expect(isWindowed("instagram", "story_mention")).toBe(false);
  });
});

describe("calcul de l'expiration", () => {
  it("24 h en standard", () => {
    expect(computeWindowExpiry(T0).toISOString()).toBe(at(24).toISOString());
  });

  it("7 jours avec le tag human_agent", () => {
    expect(computeWindowExpiry(T0, true).toISOString()).toBe(at(168).toISOString());
  });
});

describe("éligibilité à l'envoi — Instagram et Facebook", () => {
  it("autorise sans tag dans les 24 h", () => {
    const result = evaluateSendEligibility({
      channel: "instagram",
      kind: "dm",
      lastInboundAt: T0,
      now: at(6),
    });
    expect(result.canSend).toBe(true);
    if (!result.canSend) return;
    expect(result.requiresHumanAgentTag).toBe(false);
    expect(result.hoursRemaining).toBeCloseTo(18, 5);
  });

  it("exige le tag human_agent entre 24 h et 7 jours", () => {
    const result = evaluateSendEligibility({
      channel: "instagram",
      kind: "dm",
      lastInboundAt: T0,
      now: at(48),
    });
    expect(result.canSend).toBe(true);
    if (!result.canSend) return;
    expect(result.requiresHumanAgentTag).toBe(true);
  });

  it("refuse au-delà de 7 jours", () => {
    const result = evaluateSendEligibility({
      channel: "facebook",
      kind: "dm",
      lastInboundAt: T0,
      now: at(200),
    });
    expect(result.canSend).toBe(false);
    if (result.canSend) return;
    expect(result.reason).toBe("window_expired");
  });

  it("traite la limite exacte de 24 h comme encore ouverte", () => {
    const result = evaluateSendEligibility({
      channel: "instagram",
      kind: "dm",
      lastInboundAt: T0,
      now: at(24),
    });
    expect(result.canSend).toBe(true);
    if (result.canSend) expect(result.requiresHumanAgentTag).toBe(false);
  });
});

describe("éligibilité à l'envoi — WhatsApp", () => {
  it("exige un template approuvé au-delà de 24 h, pas un tag", () => {
    // Le tag human_agent n'existe pas sur WhatsApp : laisser croire l'inverse
    // produirait un échec d'envoi inexplicable pour l'opérateur.
    const result = evaluateSendEligibility({
      channel: "whatsapp",
      kind: "dm",
      lastInboundAt: T0,
      now: at(48),
    });
    expect(result.canSend).toBe(false);
    if (result.canSend) return;
    expect(result.reason).toBe("requires_approved_template");
  });
});

describe("éligibilité à l'envoi — hors messagerie", () => {
  it("n'impose aucune limite sur un commentaire, même très ancien", () => {
    const result = evaluateSendEligibility({
      channel: "instagram",
      kind: "comment",
      lastInboundAt: T0,
      now: at(5000),
    });
    expect(result.canSend).toBe(true);
    if (result.canSend) expect(result.hoursRemaining).toBe(Infinity);
  });
});

describe("libellés pour l'inbox", () => {
  it("affiche les heures restantes", () => {
    const result = evaluateSendEligibility({
      channel: "instagram",
      kind: "dm",
      lastInboundAt: T0,
      now: at(18),
    });
    expect(formatWindow(result)).toBe("6 h restantes");
  });

  it("signale le tag requis", () => {
    const result = evaluateSendEligibility({
      channel: "instagram",
      kind: "dm",
      lastInboundAt: T0,
      now: at(30),
    });
    expect(formatWindow(result)).toContain("human_agent");
  });

  it("explique le cas WhatsApp plutôt que d'afficher « expiré »", () => {
    const result = evaluateSendEligibility({
      channel: "whatsapp",
      kind: "dm",
      lastInboundAt: T0,
      now: at(40),
    });
    expect(formatWindow(result)).toContain("template approuvé");
  });

  it("indique l'absence de limite", () => {
    const result = evaluateSendEligibility({
      channel: "instagram",
      kind: "comment",
      lastInboundAt: T0,
      now: at(100),
    });
    expect(formatWindow(result)).toBe("Pas de limite");
  });
});
