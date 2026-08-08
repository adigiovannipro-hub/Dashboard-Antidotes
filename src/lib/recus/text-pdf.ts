/**
 * Un PDF depuis le texte d'un mail, sans dépendance ni navigateur.
 *
 * Pourquoi ce fichier existe : beaucoup de reçus n'arrivent qu'en HTML — Grab
 * en tête — et le rendu fidèle par navigateur ne s'exécute nulle part dans
 * cette installation (Playwright est une dépendance de développement que pnpm
 * ne rend pas résolvable à l'exécution). Le repli était alors « aucune pièce
 * jointe » : Airwallex recevait un courrier sans rien à accrocher, et
 * n'accrochait rien. Un justificatif lisible vaut mieux qu'un justificatif
 * absent.
 *
 * Le PDF produit est **du texte, pas une image** : l'OCR d'Airwallex n'a même
 * pas à deviner les caractères, ils sont là. Le prix à payer est la mise en
 * page du commerçant, perdue — le contenu, lui, est intact.
 *
 * Fonction pure : aucun accès réseau, aucun état. Elle se teste et se rejoue.
 */

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 48;
const BODY_SIZE = 10;
const TITLE_SIZE = 14;
const LEADING = 14;

const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const LINES_PER_PAGE = Math.floor((PAGE_HEIGHT - 2 * MARGIN - 32) / LEADING);

/**
 * Largeurs Helvetica, en millièmes de cadratin, pour l'ASCII imprimable.
 *
 * Une largeur moyenne ne suffit pas : « A » fait 667 et « l » 222, si bien
 * qu'une référence en capitales — le cas courant sur un justificatif —
 * débordait la marge alors qu'un texte en bas de casse rentrait largement.
 * Les caractères hors table (accents, ponctuation typographique) prennent la
 * largeur médiane, très proche de celle de leur lettre de base.
 */
const HELVETICA_WIDTHS: readonly number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

const DEFAULT_WIDTH = 556;

/** Largeur d'un texte, en points, au corps donné. */
export function textWidth(text: string, size = BODY_SIZE): number {
  let units = 0;
  for (const char of text) {
    const code = char.codePointAt(0)!;
    units +=
      code >= 32 && code <= 126
        ? HELVETICA_WIDTHS[code - 32]!
        : DEFAULT_WIDTH;
  }
  return (units * size) / 1000;
}

/* WinAnsi place quelques signes courants entre 0x80 et 0x9F, là où Latin-1 n'a
   rien. Sans cette table, un euro ou une apostrophe typographique sortirait en
   caractère de contrôle. */
/* Écrit en points de code et non en caractères : deux apostrophes
   typographiques se ressemblent trop à l'œil pour qu'on distingue une clé
   dupliquée d'une paire légitime. */
const WIN_ANSI_HIGH: Record<string, number> = {
  "€": 0x80, // €
  "‚": 0x82, // ‚
  "ƒ": 0x83, // ƒ
  "„": 0x84, // „
  "…": 0x85, // …
  "†": 0x86, // †
  "‡": 0x87, // ‡
  "ˆ": 0x88, // ˆ
  "‰": 0x89, // ‰
  "Š": 0x8a, // Š
  "‹": 0x8b, // ‹
  "Œ": 0x8c, // Œ
  "Ž": 0x8e, // Ž
  "‘": 0x91, // guillemet simple ouvrant
  "’": 0x92, // apostrophe typographique
  "“": 0x93, // “
  "”": 0x94, // ”
  "•": 0x95, // •
  "–": 0x96, // – (demi-cadratin)
  "—": 0x97, // — (cadratin)
  "˜": 0x98, // ˜
  "™": 0x99, // ™
  "š": 0x9a, // š
  "›": 0x9b, // ›
  "œ": 0x9c, // œ
  "ž": 0x9e, // ž
  "Ÿ": 0x9f, // Ÿ
};

/** Texte → octets WinAnsi. Ce qui n'a pas d'équivalent devient « ? » plutôt
    que d'être tronqué en un octet arbitraire. */
function toWinAnsi(text: string): Buffer {
  const bytes: number[] = [];
  for (const char of text) {
    const high = WIN_ANSI_HIGH[char];
    if (high !== undefined) {
      bytes.push(high);
      continue;
    }
    const code = char.codePointAt(0)!;
    bytes.push(code <= 0xff ? code : 0x3f);
  }
  return Buffer.from(bytes);
}

/** Échappe ce qu'une chaîne PDF ne supporte pas nu. */
function pdfString(text: string): Buffer {
  const escaped = text.replace(/([\\()])/g, "\\$1");
  return toWinAnsi(escaped);
}

/**
 * Coupe aux mots, jamais au milieu — sauf pour un mot plus long que la ligne,
 * qui serait sinon rejeté hors de la page (une référence bancaire, une URL).
 */
export function wrapLines(text: string, width = CONTENT_WIDTH): string[] {
  const output: string[] = [];

  /** Coupe un mot trop long pour tenir seul, caractère par caractère. */
  function breakWord(word: string): string[] {
    const pieces: string[] = [];
    let piece = "";
    for (const char of word) {
      if (piece !== "" && textWidth(piece + char) > width) {
        pieces.push(piece);
        piece = char;
      } else {
        piece += char;
      }
    }
    if (piece !== "") pieces.push(piece);
    return pieces;
  }

  for (const rawLine of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    if (line === "") {
      output.push("");
      continue;
    }

    let current = "";
    for (const word of line.split(/\s+/)) {
      if (textWidth(word) > width) {
        if (current !== "") {
          output.push(current);
          current = "";
        }
        const pieces = breakWord(word);
        output.push(...pieces.slice(0, -1));
        current = pieces.at(-1) ?? "";
        continue;
      }
      const candidate = current === "" ? word : `${current} ${word}`;
      if (textWidth(candidate) > width) {
        output.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current !== "") output.push(current);
  }

  return output;
}

function contentStream(title: string | null, lines: string[]): Buffer {
  const parts: Buffer[] = [];
  let cursor = PAGE_HEIGHT - MARGIN;

  if (title) {
    parts.push(
      Buffer.from(`BT /F2 ${TITLE_SIZE} Tf ${MARGIN} ${cursor} Td (`),
      pdfString(title),
      Buffer.from(") Tj ET\n"),
    );
    cursor -= TITLE_SIZE + 10;
  }

  parts.push(
    Buffer.from(`BT /F1 ${BODY_SIZE} Tf ${LEADING} TL ${MARGIN} ${cursor} Td\n`),
  );
  for (const line of lines) {
    parts.push(Buffer.from("("), pdfString(line), Buffer.from(") Tj T*\n"));
  }
  parts.push(Buffer.from("ET\n"));

  return Buffer.concat(parts);
}

export type TextPdfOptions = {
  /** Titre en tête de la première page — le sujet du mail, en pratique. */
  title: string;
  /** Lignes d'identité placées avant le corps : expéditeur, date, montant. */
  meta?: string[];
  body: string;
};

/**
 * Assemble un PDF minimal mais valide : catalogue, pages, deux polices
 * standard, un flux par page, et une table de références croisées dont les
 * décalages sont comptés en octets — c'est elle qui rend le fichier lisible.
 */
export function renderTextToPdf(options: TextPdfOptions): Buffer {
  const meta = options.meta?.filter((line) => line.trim() !== "") ?? [];
  const bodyLines = wrapLines(options.body);
  const allLines = meta.length > 0 ? [...meta, "", ...bodyLines] : bodyLines;

  const pages: string[][] = [];
  for (let index = 0; index < allLines.length; index += LINES_PER_PAGE) {
    pages.push(allLines.slice(index, index + LINES_PER_PAGE));
  }
  if (pages.length === 0) pages.push([]);

  /* Numérotation : 1 catalogue, 2 pages, 3 et 4 polices, puis deux objets par
     page — la page et son flux. */
  const firstPageObject = 5;
  const pageIds = pages.map((_, index) => firstPageObject + index * 2);

  const objects: Buffer[] = [];
  const push = (id: number, body: Buffer | string) => {
    objects.push(
      Buffer.concat([
        Buffer.from(`${id} 0 obj\n`),
        typeof body === "string" ? Buffer.from(body) : body,
        Buffer.from("\nendobj\n"),
      ]),
    );
  };

  push(1, "<< /Type /Catalog /Pages 2 0 R >>");
  push(
    2,
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  );
  push(
    3,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );
  push(
    4,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  );

  pages.forEach((lines, index) => {
    const pageId = pageIds[index]!;
    const streamId = pageId + 1;
    push(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`,
    );

    const stream = contentStream(index === 0 ? options.title : null, lines);
    push(
      streamId,
      Buffer.concat([
        Buffer.from(`<< /Length ${stream.length} >>\nstream\n`),
        stream,
        Buffer.from("endstream"),
      ]),
    );
  });

  const header = Buffer.from("%PDF-1.4\n");
  const offsets: number[] = [];
  let position = header.length;
  for (const object of objects) {
    offsets.push(position);
    position += object.length;
  }

  const count = objects.length + 1;
  const xref = [
    `xref\n0 ${count}\n`,
    "0000000000 65535 f \n",
    ...offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`),
  ].join("");

  const trailer =
    `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${position}\n%%EOF\n`;

  return Buffer.concat([
    header,
    ...objects,
    Buffer.from(xref),
    Buffer.from(trailer),
  ]);
}
