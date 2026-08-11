import { describe, expect, it } from "vitest";

import { estimateTokens, INJECTED_CONTEXT_TOKEN_LIMIT } from "./token-estimate";

describe("estimateTokens", () => {
  it("rend zéro pour une chaîne vide", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("estime environ un token pour 3,5 caractères", () => {
    expect(estimateTokens("a".repeat(3500))).toBe(1000);
    expect(estimateTokens("a")).toBe(1);
  });

  it("croît avec la longueur du texte", () => {
    const short = estimateTokens("Un brief court.");
    const long = estimateTokens("Un brief nettement plus détaillé. ".repeat(50));
    expect(long).toBeGreaterThan(short);
  });

  it("expose un seuil d'avertissement à 6000 tokens", () => {
    expect(INJECTED_CONTEXT_TOKEN_LIMIT).toBe(6000);
  });
});
