import { describe, expect, it } from "vitest";

import { buildTopicsPrompt, parseTopicsResponse } from "./topics";

describe("parseTopicsResponse", () => {
  const known = new Set(["p1", "p2"]);

  it("lit le JSON, même entre clôtures de code, et garde les preuves connues", () => {
    const topics = parseTopicsResponse(
      '```json\n{"topics":[{"title":"Pourquoi vos posts d\'expertise n\'attirent aucun client","angle":"L\'expertise rassure, elle ne fait pas signer.","evidence":[{"post_id":"p1","why":"38 ‰ sur un post de ce type"},{"post_id":"zz","why":"inconnu"}]}]}\n```',
      known,
    );
    expect(topics).toEqual([
      {
        title: "Pourquoi vos posts d'expertise n'attirent aucun client",
        angle: "L'expertise rassure, elle ne fait pas signer.",
        evidence: [{ post_id: "p1", why: "38 ‰ sur un post de ce type" }],
      },
    ]);
  });

  it("écarte un sujet sans preuve valide, et rend vide sur du bruit", () => {
    expect(parseTopicsResponse('{"topics":[{"title":"Vague","evidence":[{"post_id":"nope"}]}]}', known)).toEqual([]);
    expect(parseTopicsResponse("désolé, je ne peux pas", known)).toEqual([]);
  });
});

describe("buildTopicsPrompt", () => {
  it("numérote et identifie chaque post avec son engagement", () => {
    const prompt = buildTopicsPrompt([
      { id: "p1", platform: "linkedin", author_handle: "sandro", content: "Texte", engagement: "12 ‰" },
    ]);
    expect(prompt).toBe("#1 · id p1 · LinkedIn · sandro · engagement 12 ‰\nTexte");
  });
});
