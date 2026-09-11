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

/**
 * Le résumé du rapport : son premier paragraphe, coupé en fin de phrase.
 *
 * Affiché en clair sous le titre du panneau replié — les éléments clés du mois
 * analysé se lisent sans un clic, le détail reste derrière le dépli. La coupe
 * tombe sur la dernière phrase entière qui tient dans la limite : un résumé
 * tronqué en plein chiffre dirait le contraire de ce qu'il résume.
 */
export function summaryParagraph(markdown: string, maxLength = 420): string {
  const blocks = parseReport(markdown);
  const paragraph = blocks.find((block) => block.kind === "paragraph");
  if (!paragraph) return "";
  const text = paragraph.spans.map((span) => span.text).join("").trim();
  if (text.length <= maxLength) return text;

  let cut = "";
  for (const match of text.matchAll(/[.!?](\s|$)/g)) {
    const end = match.index + 1;
    if (end > maxLength) break;
    cut = text.slice(0, end);
  }
  return cut !== "" ? cut : `${text.slice(0, maxLength - 1)}…`;
}

// --- Points d'ancrage de la boucle -------------------------------------------

/**
 * Les deux sections que le prompt de reporting produit **sous un titre fixe**.
 *
 * `client_reports.report` est du markdown libre, et une boucle qui relit du
 * texte libre a besoin d'un point d'ancrage stable : sans lui, les phases
 * Intentions et Content devraient soit tout réinjecter — deux comptes rendus
 * entiers doublent le prompt d'entrée — soit deviner où se trouve la
 * conclusion. Le prompt s'engage sur ces deux titres, ces fonctions les
 * retrouvent, et un rapport plus ancien qui ne les porte pas retombe
 * proprement sur son premier paragraphe.
 */
export const REPORT_SECTION_KEPT = "Mécaniques retenues";
export const REPORT_SECTION_DROPPED = "Mécaniques à retirer";

function normalizeHeading(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Le corps d'une section, du titre demandé jusqu'au titre suivant de niveau
 * égal ou supérieur. Chaîne vide quand la section n'existe pas — un rapport
 * antérieur à cette structure ne doit pas faire échouer la lecture.
 */
export function extractReportSection(markdown: string, title: string): string {
  const wanted = normalizeHeading(title);
  const blocks = parseReport(markdown);

  let level: number | null = null;
  const kept: string[] = [];

  for (const block of blocks) {
    if (block.kind === "heading") {
      if (level === null) {
        // Le titre peut être numéroté par le modèle : « 6. Mécaniques retenues ».
        const heading = normalizeHeading(block.text).replace(/^\d+\s*/, "");
        if (heading === wanted || heading.endsWith(` ${wanted}`)) level = block.level;
        continue;
      }
      if (block.level <= level) break;
      kept.push(block.text);
      continue;
    }
    if (level === null) continue;
    if (block.kind === "paragraph") {
      kept.push(block.spans.map((span) => span.text).join("").trim());
    } else {
      for (const item of block.items) {
        kept.push(`- ${item.map((span) => span.text).join("").trim()}`);
      }
    }
  }

  return kept.join("\n").trim();
}

/** Une synthèse passée, réduite à ce que la génération suivante doit en savoir. */
export type PastReport = {
  /** Le mois **analysé**, en toutes lettres — « juillet 2026 ». */
  monthLabel: string;
  report: string;
};

/** Au-delà, deux synthèses entières doublent le prompt d'entrée. */
const MAX_REPORT_EXCERPT_CHARS = 1200;

/**
 * `{{syntheses_precedentes}}` — ce que les derniers comptes rendus ont conclu.
 *
 * **Le mois analysé est toujours nommé**, et c'est le point délicat : la phase
 * Reporting analyse M−1 quand les Intentions visent M+1. Deux mois d'écart que
 * le modèle ne voit pas si on lui sert un texte sans étiquette — il daterait
 * les enseignements du mois qu'il prépare.
 */
export function renderRecentReports(reports: PastReport[]): string {
  if (reports.length === 0) return "";
  return reports
    .map((entry) => {
      const kept = extractReportSection(entry.report, REPORT_SECTION_KEPT);
      const dropped = extractReportSection(entry.report, REPORT_SECTION_DROPPED);
      const body =
        kept === "" && dropped === ""
          ? // Rapport antérieur aux sections normalisées : son résumé vaut mieux
            // que rien, et il est dit pour ce qu'il est.
            `Synthèse (ce compte rendu est antérieur aux sections normalisées) :\n${summaryParagraph(
              entry.report,
              MAX_REPORT_EXCERPT_CHARS,
            )}`
          : [
              kept === "" ? "" : `${REPORT_SECTION_KEPT} :\n${kept}`,
              dropped === "" ? "" : `${REPORT_SECTION_DROPPED} :\n${dropped}`,
            ]
              .filter((part) => part !== "")
              .join("\n\n");
      return `--- Analyse du mois de ${entry.monthLabel} ---\n${body}`;
    })
    .join("\n\n");
}
