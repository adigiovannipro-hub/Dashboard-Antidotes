import { describe, expect, it } from "vitest";

import { pickTranscribable, readTranscription } from "./transcribe";

const row = (over: Partial<Parameters<typeof pickTranscribable>[0][number]> & { id: string }) => ({
  media_url: "https://example.invalid/a.mp4",
  media_kind: "video",
  transcript: null,
  ...over,
});

describe("pickTranscribable", () => {
  it("ne prend que des vidéos dont on a le média et pas encore le texte", () => {
    const rows = [
      row({ id: "à-faire" }),
      row({ id: "déjà-fait", transcript: "Bonjour." }),
      row({ id: "image", media_kind: "image" }),
      row({ id: "sans-média", media_url: null }),
      row({ id: "média-vide", media_url: "   " }),
    ];
    expect(pickTranscribable(rows, 10).map((entry) => entry.id)).toEqual(["à-faire"]);
  });

  it("respecte le plafond du passage", () => {
    const rows = [row({ id: "a" }), row({ id: "b" }), row({ id: "c" })];
    expect(pickTranscribable(rows, 2)).toHaveLength(2);
    expect(pickTranscribable(rows, 0)).toHaveLength(0);
  });
});

describe("readTranscription", () => {
  it("rend le texte quand il y en a un", () => {
    expect(readTranscription({ text: "  Trois plans, un produit.  " })).toEqual({ text: "Trois plans, un produit." });
  });

  it("nomme l'erreur de l'API plutôt que de rendre du vide", () => {
    expect(readTranscription({ error: { message: "Invalid file format." } })).toEqual({ error: "Invalid file format." });
    expect(readTranscription({ text: "   " })).toEqual({ error: "Transcription vide." });
    expect(readTranscription(null)).toEqual({ error: "Réponse illisible." });
  });
});
