import { describe, expect, it } from "vitest";

import { buildStudioPrompt, cleanGeneratedPost } from "./studio-prompt";

describe("buildStudioPrompt", () => {
  it("ordonne sujet, angle, consignes, exemples et post de la veille", () => {
    const prompt = buildStudioPrompt({
      topic: "Pourquoi vos posts d'expertise n'attirent aucun client",
      angle: "L'expertise rassure, elle ne fait pas signer.",
      brief: "Citer le cas Bondet.",
      examples: [{ content: "Mon post A", similarity: 0.8 }, { content: "Mon post B", similarity: 0.6 }],
      source: { platform: "LinkedIn", author: "quelqu'un", content: "Le post qui a marché" },
      authorName: "Sandro",
    });
    expect(prompt).toContain("SUJET : Pourquoi vos posts d'expertise n'attirent aucun client");
    expect(prompt.indexOf("ANGLE")).toBeLessThan(prompt.indexOf("CONSIGNES"));
    expect(prompt).toContain("[Exemple 1]\nMon post A");
    expect(prompt).toContain("[Exemple 2]\nMon post B");
    expect(prompt).toContain("POST DE LA VEILLE QUI A INSPIRÉ LE SUJET (LinkedIn, quelqu'un)");
  });

  it("dit l'absence d'exemples plutôt que de se taire", () => {
    expect(buildStudioPrompt({ topic: "x", angle: null, brief: null, examples: [], source: null, authorName: null })).toContain(
      "aucun exemple disponible",
    );
  });
});

describe("cleanGeneratedPost", () => {
  it("retire guillemets, clôtures et lignes vides en rafale", () => {
    expect(cleanGeneratedPost('```\n« Première ligne.\n\n\n\nDeuxième. »\n```')).toBe("Première ligne.\n\nDeuxième.");
  });
});
