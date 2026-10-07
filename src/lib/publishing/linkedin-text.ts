/**
 * Le texte d'un post LinkedIn, mis au format que l'API attend.
 *
 * `/rest/posts` lit la légende en « Little Text » : `(`, `)`, `[`, `]`, `@`,
 * `#`, `*`, `_`, `~`, `<`, `>`, `{`, `}`, `|` et `\` y sont des caractères
 * réservés. Non échappés, ils ne s'affichent pas tels quels — une parenthèse
 * ouverte suffit à **couper la légende** à cet endroit, sans erreur ni
 * avertissement, et le post part amputé.
 *
 * Un hashtag, lui, n'est pas un `#` échappé : c'est un modèle
 * `{hashtag|\#|mot}`, sans quoi il s'afficherait en texte inerte. Le
 * connecteur du Reporting fait le chemin inverse (`decodeCommentary`).
 */

const RESERVED = /[\\|{}@[\]()<>#*_~]/g;

/** Échappe les caractères réservés du Little Text. */
export function escapeLittleText(text: string): string {
  return text.replace(RESERVED, (character) => `\\${character}`);
}

/** Un `#` en début de mot, suivi de lettres, de chiffres ou de soulignés. */
const HASHTAG = /(^|[\s(])#([\p{L}\p{N}_]+)/gu;

/** La légende du planning, prête pour le champ `commentary` de LinkedIn. */
export function toLittleText(caption: string): string {
  let out = "";
  let last = 0;
  for (const match of caption.matchAll(HASHTAG)) {
    const hash = (match.index ?? 0) + (match[1]?.length ?? 0);
    const word = match[2] ?? "";
    out += escapeLittleText(caption.slice(last, hash));
    out += `{hashtag|\\#|${escapeLittleText(word)}}`;
    last = hash + 1 + word.length;
  }
  return out + escapeLittleText(caption.slice(last));
}
