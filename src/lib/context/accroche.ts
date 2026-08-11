/**
 * Extraction de l'accroche d'un wording : la première ligne pleine, celle qui
 * ouvre le post. C'est elle qui part dans `wording_history` à la validation,
 * pour que les générations suivantes ne la recyclent jamais.
 */

const MAX_ACCROCHE_CHARS = 300;

export function extractAccroche(wording: string): string {
  const firstLine =
    wording
      .split("\n")
      .map((line) => line.replace(/^[\s"«\-–—•*]+/, "").trim())
      .find((line) => line.length > 0) ?? "";

  if (firstLine.length <= MAX_ACCROCHE_CHARS) return firstLine;

  // Une première « ligne » démesurée est un paragraphe : on garde la première
  // phrase complète, à défaut une coupe franche.
  const sentenceEnd = firstLine.slice(0, MAX_ACCROCHE_CHARS).search(/[.!?]\s/);
  if (sentenceEnd > 40) return firstLine.slice(0, sentenceEnd + 1).trim();
  return firstLine.slice(0, MAX_ACCROCHE_CHARS).trim();
}
