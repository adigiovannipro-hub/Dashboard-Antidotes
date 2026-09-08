/**
 * Trouver, parmi mes posts, les cinq qui ressemblent le plus au sujet du
 * jour — ce sont eux que le prompt du studio reçoit comme exemples.
 *
 * Deux voies, la même sortie :
 *   • par **vecteurs** (`text-embedding-3-small`, 1 536 d), quand le corpus
 *     et le sujet en ont — la similarité cosinus, calculée ici en mémoire :
 *     un corpus de cinquante posts n'a pas besoin de l'index ;
 *   • par **recoupement lexical** sinon : TF-IDF sur les mots de plus de
 *     trois lettres, sans accents. Moins fin, jamais aveugle — et surtout,
 *     sans clé, le studio marche quand même, en le disant.
 *
 * Module pur, testé sans réseau.
 */

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index]! * b[index]!;
    na += a[index]! * a[index]!;
    nb += b[index]! * b[index]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** pgvector rend `[0.1,0.2,…]` en chaîne à travers PostgREST. */
export function parseVector(raw: string | number[] | null | undefined): number[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) && parsed.every((value) => typeof value === "number") ? parsed : null;
  } catch {
    return null;
  }
}

const STOP_WORDS = new Set([
  "avec", "dans", "pour", "cette", "cela", "vous", "nous", "elle", "elles", "ils", "leur", "leurs", "sont", "être", "etre",
  "fait", "faire", "plus", "moins", "tout", "tous", "toute", "toutes", "mais", "donc", "alors", "comme", "aussi", "très",
  "tres", "quand", "même", "meme", "chez", "sans", "entre", "votre", "notre", "cest", "c'est", "qu'il", "qu'on", "that",
  "this", "with", "from", "have", "your", "what", "when", "they", "their", "there", "about", "will", "just",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^[-']+|[-']+$/g, ""))
    .filter((token) => token.length > 3 && !STOP_WORDS.has(token));
}

export type RankedPost<T> = { post: T; similarity: number; method: "embedding" | "lexical" };

/**
 * Les `limit` posts les plus proches du sujet. Les vecteurs servent dès que
 * le sujet **et** le post en ont ; les autres posts passent par le lexical,
 * sur une échelle comparable (0-1) mais qui n'est pas la même — d'où la
 * méthode rendue avec chaque résultat, pour que l'écran puisse le dire.
 */
export function rankBySimilarity<T extends { content: string; embedding?: number[] | null }>(
  posts: T[],
  topic: { text: string; embedding?: number[] | null },
  limit = 5,
): RankedPost<T>[] {
  const topicTokens = tokenize(topic.text);
  const documents = posts.map((post) => tokenize(post.content));
  const frequencies = new Map<string, number>();
  for (const tokens of documents) {
    for (const token of new Set(tokens)) frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  }
  const idf = (token: string) => Math.log((posts.length + 1) / ((frequencies.get(token) ?? 0) + 1)) + 1;
  const vectorOf = (tokens: string[]) => {
    const counts = new Map<string, number>();
    for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
    const vector = new Map<string, number>();
    for (const [token, count] of counts) vector.set(token, (count / tokens.length) * idf(token));
    return vector;
  };
  const topicVector = vectorOf(topicTokens);
  const lexical = (tokens: string[]) => {
    const vector = vectorOf(tokens);
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (const [token, weight] of topicVector) {
      na += weight * weight;
      const other = vector.get(token);
      if (other) dot += weight * other;
    }
    for (const weight of vector.values()) nb += weight * weight;
    return na === 0 || nb === 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
  };

  return posts
    .map((post, index): RankedPost<T> => {
      if (topic.embedding && post.embedding && post.embedding.length === topic.embedding.length) {
        return { post, similarity: cosine(topic.embedding, post.embedding), method: "embedding" };
      }
      return { post, similarity: lexical(documents[index]!), method: "lexical" };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}
