import { Fragment, type ReactNode } from "react";

/**
 * La voix de la charte dans un titre (r-02, r-15) : un mot-clé vert et une
 * touche manuscrite en italique. Les dictionnaires les marquent sans HTML :
 * `*mot-clé*` passe en vert (`.kw`), `_deux ou trois mots_` en Instrument
 * Serif italique (`.serif`). Un `\n` coupe la ligne là où la charte la
 * coupe (le titre du hero se lit sur trois lignes) : un `<br />` par
 * défaut, ou une ligne par `<span className="block">` avec `lines`, quand
 * chaque ligne doit être stylée ou animée seule. Les marques se lisent ligne
 * par ligne : une marque ne traverse jamais un retour à la ligne. Le texte
 * lu par un lecteur d'écran ou repris en métadonnées passe par `plainText`,
 * qui retire les marques et remplace les retours par une espace.
 */
const MARK = /(\*[^*\n]+\*|_[^_\n]+_)/g;
const NEWLINE = /[ \t]*\r?\n[ \t]*/;

function marked(line: string): ReactNode {
  const parts = line.split(MARK).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("*") && part.endsWith("*")) return <span key={index} className="kw">{part.slice(1, -1)}</span>;
    if (part.startsWith("_") && part.endsWith("_")) return <em key={index} className="serif">{part.slice(1, -1)}</em>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export function Rich({ text, lines = false }: { text: string; lines?: boolean }): ReactNode {
  const rows = text.split(NEWLINE);
  if (lines)
    return rows.map((row, index) => (
      <span key={index} className="block">
        {marked(row)}
      </span>
    ));
  return rows.map((row, index) => (
    <Fragment key={index}>
      {index > 0 ? <br /> : null}
      {marked(row)}
    </Fragment>
  ));
}

export function plainText(text: string): string {
  return text
    .split(NEWLINE)
    .map((row) => row.replace(MARK, (part) => part.slice(1, -1)))
    .join(" ");
}
