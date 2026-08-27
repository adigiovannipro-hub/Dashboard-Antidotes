import { describe, expect, it } from "vitest";

import {
  DeterministicEmbeddings,
  LocalModelEmbeddings,
  pendingEmbeddingFilter,
} from "./embeddings";

describe("pendingEmbeddingFilter", () => {
  it("retient l'absence de vecteur, la source inconnue et la source étrangère", () => {
    expect(pendingEmbeddingFilter("all-MiniLM-L6-v2")).toBe(
      "embedding.is.null,embedding_source.is.null,embedding_source.neq.all-MiniLM-L6-v2",
    );
  });

  it("les identifiants de fournisseur restent sûrs dans la syntaxe PostgREST", () => {
    // Une virgule ou une parenthèse dans l'identifiant casserait le `or=` :
    // l'invariant se vérifie ici, au moment où on déclarerait un fournisseur.
    for (const id of [
      new DeterministicEmbeddings().id,
      new LocalModelEmbeddings().id,
    ]) {
      expect(id).not.toMatch(/[,()]/);
    }
  });
});
