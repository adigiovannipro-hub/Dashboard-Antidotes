import { describe, expect, it } from "vitest";

import { createOpenAiEmbedder, parseEmbeddingsResponse, toPgVector } from "./embeddings";

const vector = (fill: number) => Array.from({ length: 1536 }, () => fill);

describe("parseEmbeddingsResponse", () => {
  it("remet les vecteurs dans l'ordre des textes", () => {
    const rows = parseEmbeddingsResponse(
      { data: [{ index: 1, embedding: vector(2) }, { index: 0, embedding: vector(1) }] },
      2,
    );
    expect(rows[0]![0]).toBe(1);
    expect(rows[1]![0]).toBe(2);
  });

  it("refuse un compte ou une dimension inattendus, et relaie l'erreur d'OpenAI", () => {
    expect(() => parseEmbeddingsResponse({ data: [{ index: 0, embedding: vector(1) }] }, 2)).toThrow(/1 vecteurs rendus pour 2/);
    expect(() => parseEmbeddingsResponse({ data: [{ index: 0, embedding: [1, 2] }] }, 1)).toThrow(/2 dimensions/);
    expect(() => parseEmbeddingsResponse({ error: { message: "quota" } }, 1)).toThrow(/quota/);
  });
});

describe("createOpenAiEmbedder", () => {
  it("poste le modèle et les textes, et rend les vecteurs", async () => {
    let sent: unknown = null;
    const embedder = createOpenAiEmbedder({
      apiKey: "sk-test",
      fetcher: (async (_url: unknown, init?: RequestInit) => {
        sent = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ data: [{ index: 0, embedding: vector(0.5) }] }), { status: 200 });
      }) as typeof fetch,
    });
    const rows = await embedder.embed(["bonjour"]);
    expect(rows).toHaveLength(1);
    expect(sent).toEqual({ model: "text-embedding-3-small", input: ["bonjour"] });
    expect(await embedder.embed([])).toEqual([]);
  });
});

describe("toPgVector", () => {
  it("sérialise comme pgvector l'attend", () => {
    expect(toPgVector([0.1, 0.2])).toBe("[0.1,0.2]");
  });
});
