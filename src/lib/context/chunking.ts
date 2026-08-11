/**
 * Découpe d'un document trop long pour une seule lecture.
 *
 * Fonction pure : la limite est passée en option pour être testable. La
 * coupe se fait de préférence entre deux paragraphes, à défaut entre deux
 * lignes, en dernier recours au caractère près — un document sans le moindre
 * saut de ligne ne doit pas produire un morceau infini.
 */

/**
 * ~100 000 caractères ≈ 28 000 tokens : très en dessous de la fenêtre du
 * modèle, assez grand pour que l'écrasante majorité des documents tienne en
 * un seul appel.
 */
export const MAX_CHUNK_CHARS = 100_000;

export function splitIntoChunks(
  text: string,
  options: { maxChars?: number } = {},
): string[] {
  const maxChars = options.maxChars ?? MAX_CHUNK_CHARS;
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  if (trimmed.length <= maxChars) return [trimmed];

  const chunks: string[] = [];
  let rest = trimmed;

  while (rest.length > maxChars) {
    const window = rest.slice(0, maxChars);
    // Couper au dernier saut de paragraphe du créneau ; sinon à la dernière
    // ligne ; sinon au ras de la limite. Le seuil de moitié évite de couper
    // ridiculement tôt sur un document au premier paragraphe géant.
    const paragraph = window.lastIndexOf("\n\n");
    const line = window.lastIndexOf("\n");
    const cut =
      paragraph > maxChars / 2 ? paragraph : line > maxChars / 2 ? line : maxChars;

    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }

  if (rest.length > 0) chunks.push(rest);
  return chunks;
}
