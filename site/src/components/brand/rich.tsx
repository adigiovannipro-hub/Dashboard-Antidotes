import { Fragment, type ReactNode } from "react";

/**
 * La voix de la charte dans un titre (r-02, r-15) : un mot-clé vert et une
 * touche manuscrite en italique. Les dictionnaires les marquent sans HTML :
 * `*mot-clé*` passe en vert (`.kw`), `_deux ou trois mots_` en Instrument
 * Serif italique (`.serif`). Le texte lu par un lecteur d'écran ou repris
 * en métadonnées passe par `plainText`, qui retire les marques.
 */
const MARK = /(\*[^*]+\*|_[^_]+_)/g;

export function Rich({ text }: { text: string }): ReactNode {
  const parts = text.split(MARK).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("*") && part.endsWith("*")) return <span key={index} className="kw">{part.slice(1, -1)}</span>;
    if (part.startsWith("_") && part.endsWith("_")) return <em key={index} className="serif">{part.slice(1, -1)}</em>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export function plainText(text: string): string {
  return text.replace(MARK, (part) => part.slice(1, -1));
}
