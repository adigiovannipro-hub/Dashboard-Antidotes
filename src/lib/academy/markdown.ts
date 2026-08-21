/**
 * Lecture du markdown des scripts de leçon.
 *
 * Un parseur maison plutôt qu'une dépendance MDX : les scripts sont de la
 * prose — titres, paragraphes, listes, emphase, liens — et n'embarquent aucun
 * composant. Le parseur produit une structure de blocs que le composant
 * `ScriptView` rend en JSX, sans `dangerouslySetInnerHTML` : le texte reste du
 * texte, il n'y a rien à échapper ni à injecter.
 *
 * Pur et partagé : le serveur rend la leçon, le navigateur rend l'aperçu en
 * direct du back-office avec exactement le même résultat.
 */

export type InlineNode =
  | { kind: "text"; value: string }
  | { kind: "strong"; value: string }
  | { kind: "em"; value: string }
  | { kind: "code"; value: string }
  | { kind: "link"; value: string; href: string };

export type ScriptBlock =
  | { kind: "heading"; level: 2 | 3; content: InlineNode[] }
  | { kind: "paragraph"; content: InlineNode[] }
  | { kind: "list"; ordered: boolean; items: InlineNode[][] }
  | { kind: "quote"; content: InlineNode[] }
  | { kind: "hr" };

/* L'ordre compte : `**gras**` doit être reconnu avant `*italique*`, sans quoi
   la première étoile du gras ouvrirait un italique vide. */
const INLINE_PATTERN =
  /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

export function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push({ kind: "text", value: text.slice(lastIndex, index) });
    }
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push({ kind: "strong", value: token.slice(2, -2) });
    } else if (token.startsWith("`")) {
      nodes.push({ kind: "code", value: token.slice(1, -1) });
    } else if (token.startsWith("[")) {
      const closing = token.indexOf("](");
      nodes.push({
        kind: "link",
        value: token.slice(1, closing),
        href: token.slice(closing + 2, -1),
      });
    } else {
      nodes.push({ kind: "em", value: token.slice(1, -1) });
    }
    lastIndex = index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push({ kind: "text", value: text.slice(lastIndex) });
  }
  return nodes;
}

export function parseScript(markdown: string): ScriptBlock[] {
  const blocks: ScriptBlock[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");

  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ kind: "paragraph", content: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    blocks.push({
      kind: "list",
      ordered: list.ordered,
      items: list.items.map(parseInline),
    });
    list = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed === "") {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      flushList();
      // Un `#` dans un script est traité comme un `##` : le titre de la leçon
      // vit dans la base, le script n'a pas de h1 à lui.
      const level = heading[1]!.length <= 2 ? 2 : 3;
      blocks.push({ kind: "heading", level, content: parseInline(heading[2]!) });
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "hr" });
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(trimmed);
    if (quote) {
      flushParagraph();
      flushList();
      const previous = blocks[blocks.length - 1];
      if (previous?.kind === "quote") {
        // Les lignes consécutives d'une citation se rejoignent.
        previous.content.push({ kind: "text", value: " " }, ...parseInline(quote[1]!));
      } else {
        blocks.push({ kind: "quote", content: parseInline(quote[1]!) });
      }
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      flushParagraph();
      if (list && list.ordered) flushList();
      list ??= { ordered: false, items: [] };
      list.items.push(bullet[1]!);
      continue;
    }

    const numbered = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (numbered) {
      flushParagraph();
      if (list && !list.ordered) flushList();
      list ??= { ordered: true, items: [] };
      list.items.push(numbered[1]!);
      continue;
    }

    if (list) {
      // Ligne de continuation d'un élément de liste.
      list.items[list.items.length - 1] += ` ${trimmed}`;
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  return blocks;
}
