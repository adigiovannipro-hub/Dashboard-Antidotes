/**
 * Fourniture d'embeddings pour la recherche sémantique dans la FAQ.
 *
 * L'API Claude ne produit pas d'embeddings, et les fournisseurs payants
 * (Voyage, OpenAI) sont exclus par la contrainte de coût nul autant que par le
 * refus d'ajouter une dépendance à un tiers. Le modèle tourne donc **en local** :
 * `all-MiniLM-L6-v2`, 384 dimensions, ~25 Mo en ONNX. Aucun appel réseau au
 * moment de la recherche, aucun coût, résultats reproductibles.
 *
 * Deux implémentations derrière la même interface :
 *   • `LocalModelEmbeddings` — le vrai modèle, pour la production ;
 *   • `DeterministicEmbeddings` — projection lexicale, pour les tests et
 *     l'amorçage des données de démonstration. Les tests ne doivent jamais
 *     dépendre du téléchargement d'un modèle de 25 Mo.
 */

export const EMBEDDING_DIMENSIONS = 384;

export type EmbeddingProvider = {
  /** Identifiant stocké avec le vecteur : deux sources ne se comparent pas. */
  readonly id: string;
  embed(text: string): Promise<number[]>;
  embedMany(texts: string[]): Promise<number[][]>;
};

// --- Utilitaires vectoriels ------------------------------------------------

export function normalize(vector: number[]): number[] {
  const norm = Math.hypot(...vector);
  if (norm === 0) return vector.slice();
  return vector.map((value) => value / norm);
}

/**
 * Similarité cosinus. Sur des vecteurs déjà normalisés c'est un simple produit
 * scalaire, mais on divise quand même : un appelant peut passer des vecteurs
 * bruts, et une similarité silencieusement fausse est le pire des bugs ici.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Dimensions incompatibles : ${a.length} contre ${b.length}. ` +
        "Deux sources d'embedding différentes ne sont pas comparables.",
    );
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index]! * b[index]!;
    normA += a[index]! * a[index]!;
    normB += b[index]! * b[index]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / Math.sqrt(normA * normB);
}

/** Format littéral attendu par pgvector : `[0.1,0.2,...]`. */
export function toPgVector(vector: number[]): string {
  return `[${vector.map((value) => value.toFixed(6)).join(",")}]`;
}

export function fromPgVector(literal: string): number[] {
  return literal
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((part) => Number.parseFloat(part));
}

// --- Fournisseur déterministe (tests, amorçage) ---------------------------

const STOPWORDS = new Set([
  "le", "la", "les", "un", "une", "des", "du", "de", "à", "au", "aux", "et",
  "ou", "que", "qui", "est", "sont", "pour", "dans", "sur", "avec", "en", "ce",
  "cette", "mon", "ma", "mes", "votre", "vos", "je", "vous", "il", "elle",
  "the", "a", "an", "of", "and", "or", "that", "is", "are", "for", "in", "on",
  "with", "to", "my", "your", "i", "you", "it",
]);

function lexicalTokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

/** Hachage FNV-1a : stable entre exécutions et entre plateformes. */
function hash(token: string, seed: number): number {
  let value = 2166136261 ^ seed;
  for (let index = 0; index < token.length; index += 1) {
    value ^= token.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

/**
 * Projette un texte sur 384 dimensions par hachage de ses lemmes et de ses
 * trigrammes de caractères.
 *
 * Ce n'est pas un modèle de langue : deux formulations synonymes sans mot commun
 * ne se rapprochent pas. C'est assez pour tester la mécanique de recherche —
 * seuils, ordre, absence de correspondance — de façon déterministe, et les
 * trigrammes rattrapent les variantes morphologiques et les fautes de frappe.
 */
export class DeterministicEmbeddings implements EmbeddingProvider {
  readonly id = "deterministic-lexical-v1";

  async embed(text: string): Promise<number[]> {
    const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
    const tokens = lexicalTokens(text);

    for (const token of tokens) {
      // Trois positions par lemme : réduit les collisions de hachage.
      for (let seed = 0; seed < 3; seed += 1) {
        const index = hash(token, seed) % EMBEDDING_DIMENSIONS;
        vector[index]! += 1;
      }
      for (let start = 0; start + 3 <= token.length; start += 1) {
        const trigram = token.slice(start, start + 3);
        const index = hash(trigram, 7) % EMBEDDING_DIMENSIONS;
        vector[index]! += 0.4;
      }
    }

    return normalize(vector);
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.embed(text)));
  }
}

// --- Fournisseur local (production) ---------------------------------------

type FeatureExtractor = (
  text: string | string[],
  options: { pooling: "mean"; normalize: boolean },
) => Promise<{ tolist(): number[][] }>;

/**
 * `all-MiniLM-L6-v2` exécuté par ONNX Runtime dans le processus Node.
 *
 * Le modèle est chargé paresseusement et une seule fois : le premier appel
 * télécharge et met en cache les poids, les suivants sont locaux. À réserver au
 * serveur — jamais dans un composant client, où ce serait 25 Mo envoyés au
 * navigateur.
 */
export class LocalModelEmbeddings implements EmbeddingProvider {
  readonly id = "all-MiniLM-L6-v2";

  private extractor: Promise<FeatureExtractor> | null = null;

  private load(): Promise<FeatureExtractor> {
    this.extractor ??= (async () => {
      const { pipeline } = await import("@huggingface/transformers");
      const extractor = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
      );
      return extractor as unknown as FeatureExtractor;
    })();
    return this.extractor;
  }

  async embed(text: string): Promise<number[]> {
    const [vector] = await this.embedMany([text]);
    return vector!;
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const extractor = await this.load();
    const output = await extractor(texts, { pooling: "mean", normalize: true });
    const vectors = output.tolist();

    for (const vector of vectors) {
      if (vector.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Le modèle a renvoyé ${vector.length} dimensions, ${EMBEDDING_DIMENSIONS} attendues.`,
        );
      }
    }
    return vectors;
  }
}

/**
 * Fournisseur actif.
 *
 * `MODERATION_EMBEDDINGS=deterministic` force la projection lexicale — utile en
 * CI et dans les tests, où télécharger un modèle serait à la fois lent et
 * fragile.
 */
export function getEmbeddingProvider(): EmbeddingProvider {
  if (process.env.MODERATION_EMBEDDINGS === "deterministic") {
    return new DeterministicEmbeddings();
  }
  return new LocalModelEmbeddings();
}

/**
 * Texte à vectoriser pour une entrée FAQ : la question canonique **et** ses
 * variantes de formulation. Indexer la seule question canonique ferait manquer
 * les tournures réelles des clients, qui sont précisément ce que les variantes
 * capturent.
 */
export function faqEmbeddingText(entry: {
  question_canonical: string;
  variants: string[];
}): string {
  return [entry.question_canonical, ...entry.variants].join("\n");
}
