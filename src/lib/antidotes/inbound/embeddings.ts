/**
 * Les vecteurs du corpus — `text-embedding-3-small` d'OpenAI, 1 536
 * dimensions, la taille que la colonne `embedding` fixe depuis 20260907a.
 *
 * Pourquoi un tiers ici, quand la FAQ de la Modération tourne en local : le
 * studio tourne sur Vercel, où le modèle local ne charge pas, et le sujet du
 * jour doit être vectorisé à la demande. Le coût est nul en pratique — deux
 * centièmes de dollar le million de jetons, un corpus de cinquante posts en
 * vaut quelques milliers. Sans `OPENAI_API_KEY`, le studio retombe sur le
 * recoupement lexical et le dit.
 */

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_SOURCE = "openai";
export const EMBEDDING_DIMENSIONS = 1536;

export type Embedder = {
  readonly source: string;
  embed(texts: string[]): Promise<number[][]>;
};

type EmbeddingsResponse = { data?: { index?: number; embedding?: number[] }[]; error?: { message?: string } };

export function parseEmbeddingsResponse(payload: EmbeddingsResponse, expected: number): number[][] {
  if (payload.error) throw new Error(`OpenAI : ${payload.error.message ?? "réponse en erreur"}`);
  const rows = [...(payload.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  if (rows.length !== expected) throw new Error(`OpenAI : ${rows.length} vecteurs rendus pour ${expected} textes.`);
  return rows.map((row) => {
    if (!row.embedding || row.embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`OpenAI : vecteur de ${row.embedding?.length ?? 0} dimensions, ${EMBEDDING_DIMENSIONS} attendues.`);
    }
    return row.embedding;
  });
}

export function createOpenAiEmbedder(options: { apiKey: string; fetcher?: typeof fetch }): Embedder {
  const fetcher = options.fetcher ?? fetch;
  return {
    source: EMBEDDING_SOURCE,
    async embed(texts) {
      if (texts.length === 0) return [];
      const response = await fetcher("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts.map((text) => text.slice(0, 8000)) }),
      });
      const payload = (await response.json().catch(() => ({}))) as EmbeddingsResponse;
      if (!response.ok && !payload.error) throw new Error(`OpenAI : HTTP ${response.status}.`);
      return parseEmbeddingsResponse(payload, texts.length);
    },
  };
}

/** L'embedder de l'environnement, ou `null` sans clé — jamais une erreur. */
export function embedderFromEnv(): Embedder | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  return apiKey ? createOpenAiEmbedder({ apiKey }) : null;
}

/** La forme que pgvector accepte en écriture à travers PostgREST. */
export function toPgVector(vector: number[]): string {
  return `[${vector.join(",")}]`;
}
