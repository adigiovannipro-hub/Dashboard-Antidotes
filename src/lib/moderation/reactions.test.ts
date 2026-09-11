import { describe, expect, it } from "vitest";

import { isReactionOnly } from "./reactions";

describe("isReactionOnly", () => {
  it("reconnaît un emoji seul", () => {
    expect(isReactionOnly("❤️")).toBe(true);
    expect(isReactionOnly("🔥🔥🔥")).toBe(true);
    expect(isReactionOnly("😍 !")).toBe(true);
  });

  it("reconnaît un emoji composé et sa teinte", () => {
    expect(isReactionOnly("👍🏽")).toBe(true);
    expect(isReactionOnly("👩‍👩‍👧")).toBe(true);
  });

  it("reconnaît une mention seule", () => {
    expect(isReactionOnly("@sophie")).toBe(true);
    expect(isReactionOnly("@sophie @marc 😍")).toBe(true);
  });

  it("laisse passer tout ce qui porte du texte", () => {
    expect(isReactionOnly("Merci ❤️")).toBe(false);
    expect(isReactionOnly("@sophie tu as vu ?")).toBe(false);
    expect(isReactionOnly("Vous livrez en Belgique ?")).toBe(false);
  });

  it("« !!! » n'est pas une réaction : c'est peut-être de l'agacement", () => {
    expect(isReactionOnly("!!!")).toBe(false);
    expect(isReactionOnly("???")).toBe(false);
  });

  it("un message vide n'en est pas une non plus : c'est une pièce jointe", () => {
    expect(isReactionOnly("")).toBe(false);
    expect(isReactionOnly(null)).toBe(false);
    expect(isReactionOnly(undefined)).toBe(false);
  });

  it("ne garde pas d'état entre deux appels", () => {
    // Le drapeau `g` d'une expression régulière porte un curseur : réutilisée
    // telle quelle, elle répond faux un appel sur deux.
    expect(isReactionOnly("🔥")).toBe(true);
    expect(isReactionOnly("🔥")).toBe(true);
    expect(isReactionOnly("🔥")).toBe(true);
  });
});
