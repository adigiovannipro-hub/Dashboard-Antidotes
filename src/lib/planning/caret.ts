/**
 * Où poser le curseur quand on clique dans un texte affiché, pour le retrouver
 * au même endroit dans le champ qui s'ouvre. Pur, sauf `caretOffsetAt`, qui
 * lit le DOM.
 */

/**
 * Le texte au repos d'une cellule a ses blancs réduits à une espace
 * (`replace(/\s+/g, " ")`) : un rang compté sur ce texte se ramène au rang du
 * texte brut, celui du champ.
 */
export function rawIndexFromCollapsed(raw: string, collapsedIndex: number): number {
  let collapsed = 0;
  let index = 0;
  while (index < raw.length && collapsed < collapsedIndex) {
    if (/\s/.test(raw[index]!)) {
      while (index < raw.length && /\s/.test(raw[index]!)) index += 1;
    } else {
      index += 1;
    }
    collapsed += 1;
  }
  return Math.min(index, raw.length);
}

/** Le rang du caractère sous le pointeur, compté dans `container`, ou null. */
export function caretOffsetAt(container: Node, x: number, y: number): number | null {
  const doc = container.ownerDocument;
  if (!doc) return null;
  let node: Node | null = null;
  let offset = 0;
  if ("caretPositionFromPoint" in doc && typeof doc.caretPositionFromPoint === "function") {
    const position = doc.caretPositionFromPoint(x, y);
    node = position?.offsetNode ?? null;
    offset = position?.offset ?? 0;
  } else if ("caretRangeFromPoint" in doc && typeof doc.caretRangeFromPoint === "function") {
    const range = doc.caretRangeFromPoint(x, y);
    node = range?.startContainer ?? null;
    offset = range?.startOffset ?? 0;
  }
  if (!node || !container.contains(node)) return null;
  const range = doc.createRange();
  range.setStart(container, 0);
  range.setEnd(node, offset);
  return range.toString().length;
}
