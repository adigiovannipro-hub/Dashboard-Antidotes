import { describe, expect, it } from "vitest";

import { splitIntoChunks } from "./chunking";

describe("splitIntoChunks", () => {
  it("rend un document court en un seul morceau", () => {
    expect(splitIntoChunks("Un document bref.")).toEqual(["Un document bref."]);
  });

  it("ne rend rien pour un texte vide ou blanc", () => {
    expect(splitIntoChunks("")).toEqual([]);
    expect(splitIntoChunks("   \n\n  ")).toEqual([]);
  });

  it("coupe de préférence entre deux paragraphes", () => {
    const first = "a".repeat(60);
    const second = "b".repeat(60);
    const chunks = splitIntoChunks(`${first}\n\n${second}`, { maxChars: 100 });

    expect(chunks).toEqual([first, second]);
  });

  it("coupe au caractère près quand aucun saut de ligne n'existe", () => {
    const text = "x".repeat(250);
    const chunks = splitIntoChunks(text, { maxChars: 100 });

    expect(chunks).toHaveLength(3);
    expect(chunks.join("")).toBe(text);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(100);
  });

  it("ne perd aucun contenu au découpage", () => {
    const paragraphs = Array.from({ length: 40 }, (_, i) => `Paragraphe ${i} ${"mot ".repeat(30)}`);
    const text = paragraphs.join("\n\n");
    const chunks = splitIntoChunks(text, { maxChars: 500 });

    const rebuilt = chunks.join("\n");
    for (const paragraph of paragraphs) {
      expect(rebuilt).toContain(paragraph.trim());
    }
  });
});
