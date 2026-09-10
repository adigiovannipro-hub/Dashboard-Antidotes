import { describe, expect, it } from "vitest";

import { buildReelPrompt, REEL_SYSTEM } from "./reel-prompt";

const base = {
  topic: "Le format n'est pas le message",
  angle: null,
  brief: null,
  guidelines: null,
  example: null,
  examples: [],
  source: null,
  authorName: null,
};

describe("REEL_SYSTEM", () => {
  it("impose la forme parlée : accroche, plans, chute", () => {
    expect(REEL_SYSTEM).toContain("ACCROCHE (3 s)");
    expect(REEL_SYSTEM).toContain("CHUTE :");
    expect(REEL_SYSTEM).toContain("quarante-cinq à soixante secondes");
  });
});

describe("buildReelPrompt", () => {
  it("ne pose que ce qui existe", () => {
    const prompt = buildReelPrompt(base);
    expect(prompt).toBe("SUJET : Le format n'est pas le message");
  });

  it("place mes consignes avant mes exemples", () => {
    const prompt = buildReelPrompt({
      ...base,
      guidelines: "Phrases courtes. Jamais de « Voici ».",
      example: "ACCROCHE (3 s) : J'ai arrêté les carrousels.",
      examples: [{ content: "Montrez le prix, pas la méthode.", similarity: 0.8 }],
    });
    expect(prompt.indexOf("COMMENT J'ÉCRIS")).toBeLessThan(prompt.indexOf("UN DE MES SCRIPTS"));
    expect(prompt.indexOf("UN DE MES SCRIPTS")).toBeLessThan(prompt.indexOf("MES POSTS SUR DES SUJETS PROCHES"));
  });

  it("borne la matière de la veille et la nomme comme telle", () => {
    const prompt = buildReelPrompt({
      ...base,
      source: { platform: "Instagram", author: "clara", content: "x".repeat(3000) },
    });
    expect(prompt).toContain("matière, pas modèle");
    expect(prompt).toContain("Instagram, clara");
    expect(prompt.length).toBeLessThan(2200);
  });
});
