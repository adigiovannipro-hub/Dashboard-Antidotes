import { describe, expect, it } from "vitest";

import { acceptsAttachments, characterLimit } from "./limits";

describe("characterLimit", () => {
  it("distingue un commentaire d'un message privé sur le même réseau", () => {
    // Instagram accepte 2 200 caractères sous un post et 1 000 en message.
    expect(characterLimit("instagram", "comment")).toBe(2_200);
    expect(characterLimit("instagram", "dm")).toBe(1_000);
  });

  it("connaît les trois canaux branchés", () => {
    expect(characterLimit("facebook", "comment")).toBe(8_000);
    expect(characterLimit("youtube", "comment")).toBe(10_000);
  });

  it("rend `null` pour un canal sans plafond connu", () => {
    // Mieux vaut pas de compteur qu'un plafond inventé.
    expect(characterLimit("linkedin", "comment")).toBeNull();
    expect(characterLimit("google_reviews", "review")).toBeNull();
    expect(characterLimit("youtube", "dm")).toBeNull();
  });
});

describe("acceptsAttachments", () => {
  it("refuse partout : l'envoi ne poste que du texte", () => {
    expect(acceptsAttachments("instagram", "dm")).toBe(false);
    expect(acceptsAttachments("facebook", "comment")).toBe(false);
  });
});
