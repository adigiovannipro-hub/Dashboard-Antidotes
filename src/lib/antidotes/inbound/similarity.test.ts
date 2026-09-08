import { describe, expect, it } from "vitest";

import { cosine, parseVector, rankBySimilarity, tokenize } from "./similarity";

describe("tokenize", () => {
  it("retire accents, ponctuation, mots courts et mots vides", () => {
    expect(tokenize("Vos publicités Meta ne convertissent pas, et c'est normal.")).toEqual([
      "publicites",
      "meta",
      "convertissent",
      "normal",
    ]);
  });
});

describe("rankBySimilarity", () => {
  const posts = [
    { id: "a", content: "Pourquoi vos publicités Meta ne convertissent pas : le problème est le tunnel, pas le ciblage." },
    { id: "b", content: "J'ai perdu deux clients le même mois. Voici ce que j'en retire pour mon organisation." },
    { id: "c", content: "Le planning éditorial n'est pas un calendrier, c'est une promesse faite à une audience." },
  ];

  it("classe par recoupement lexical sans vecteurs", () => {
    const ranked = rankBySimilarity(posts, { text: "Publicités Meta : pourquoi le tunnel de conversion décide de tout" }, 2);
    expect(ranked.map((entry) => entry.post.id)).toEqual(["a", "b"]);
    expect(ranked[0]!.method).toBe("lexical");
    expect(ranked[0]!.similarity).toBeGreaterThan(ranked[1]!.similarity);
  });

  it("préfère les vecteurs quand le sujet et le post en ont", () => {
    const withVectors = [
      { ...posts[0]!, embedding: [1, 0, 0] },
      { ...posts[1]!, embedding: [0, 1, 0] },
      { ...posts[2]!, embedding: null },
    ];
    const ranked = rankBySimilarity(withVectors, { text: "perdre un client", embedding: [0, 1, 0] }, 3);
    expect(ranked[0]).toMatchObject({ post: { id: "b" }, similarity: 1, method: "embedding" });
    expect(ranked.find((entry) => entry.post.id === "c")?.method).toBe("lexical");
  });
});

describe("cosine / parseVector", () => {
  it("calcule un cosinus et lit la chaîne de pgvector", () => {
    expect(cosine([1, 0], [1, 0])).toBe(1);
    expect(cosine([1, 0], [0, 1])).toBe(0);
    expect(cosine([1, 0], [1])).toBe(0);
    expect(parseVector("[0.5,0.25]")).toEqual([0.5, 0.25]);
    expect(parseVector("nope")).toBeNull();
    expect(parseVector(null)).toBeNull();
  });
});
