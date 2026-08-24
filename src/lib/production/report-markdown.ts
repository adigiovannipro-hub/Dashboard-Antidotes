/**
 * Découpe du compte rendu mensuel en blocs affichables — **fonction pure**.
 *
 * Pas de dépendance markdown : le prompt fixe la structure du rapport (cinq
 * sections en `###`, des listes, du gras), et un analyseur de trente lignes
 * couvre exactement ça. Ajouter une librairie de rendu markdown complète pour
 * un seul panneau ferait grossir le bundle de tous les écrans.
 *
 * Ce qui n'est pas reconnu retombe en paragraphe : un rapport un peu hors
 * format s'affiche en texte lisible plutôt que de disparaître.
 */

export type ReportBlock =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "paragraph"; spans: ReportSpan[] }
  | { kind: "list"; items: ReportSpan[][] };

/** Le gras est le seul style que le prompt produise à l'intérieur d'une ligne. */
export type ReportSpan = { text: string; strong: boolean };

/** `**Portée** en hausse` → deux fragments, dont un en gras. */
export function parseSpans(line: string): ReportSpan[] {
  const spans: ReportSpan[] = [];
  // Découpe sur les paires de `**` ; une étoile orpheline reste du texte.
  for (const part of line.split(/(\*\*[^*]+\*\*)/g)) {
    if (part === "") continue;
    const strong = part.startsWith("**") && part.endsWith("**") && part.length > 4;
    spans.push({ text: strong ? part.slice(2, -2) : part, strong });
  }
  return spans.length > 0 ? spans : [{ text: line, strong: false }];
}

export function parseReport(markdown: string): ReportBlock[] {
  const blocks: ReportBlock[] = [];
  let list: ReportSpan[][] | null = null;

  const closeList = () => {
    if (list && list.length > 0) blocks.push({ kind: "list", items: list });
    list = null;
  };

  for (const raw of markdown.split("\n")) {
    const line = raw.trim();

    if (line === "") {
      closeList();
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      // Au-delà de trois dièses, on retombe sur le plus petit niveau : la page
      // n'a pas de style pour un titre de niveau 5.
      const level = Math.min(heading[1]!.length, 3) as 1 | 2 | 3;
      blocks.push({ kind: "heading", level, text: heading[2]!.trim() });
      continue;
    }

    const item = /^[-*•]\s+(.*)$/.exec(line) ?? /^\d+[.)]\s+(.*)$/.exec(line);
    if (item) {
      list ??= [];
      list.push(parseSpans(item[1]!.trim()));
      continue;
    }

    closeList();
    blocks.push({ kind: "paragraph", spans: parseSpans(line) });
  }

  closeList();
  return blocks;
}

/**
 * La première phrase du rapport, pour l'aperçu du panneau replié.
 *
 * Le panneau est fermé par défaut — un compte rendu de deux pages en tête de
 * page repousserait tous les chiffres sous la ligne de flottaison — donc son
 * résumé doit dire de quoi il parle, pas seulement qu'il existe.
 */
export function firstSentence(markdown: string, maxLength = 140): string {
  const blocks = parseReport(markdown);
  const paragraph = blocks.find((block) => block.kind === "paragraph");
  if (!paragraph) return "";
  const text = paragraph.spans.map((span) => span.text).join("").trim();
  const end = text.search(/[.!?](\s|$)/);
  const sentence = end === -1 ? text : text.slice(0, end + 1);
  return sentence.length > maxLength ? `${sentence.slice(0, maxLength - 1)}…` : sentence;
}
