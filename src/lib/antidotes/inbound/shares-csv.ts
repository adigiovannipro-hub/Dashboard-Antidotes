/**
 * L'export LinkedIn « Shares.csv » — le seul chemin pour rapatrier mes propres
 * posts en nombre : LinkedIn ne rend les publications d'un membre à aucune
 * API ouverte, mais l'export des données personnelles (Paramètres →
 * Confidentialité → Obtenir une copie de vos données) contient un fichier
 * `Shares.csv` : Date, ShareLink, ShareCommentary, SharedUrl, MediaUrl,
 * Visibility. Sans chiffres — les likes se saisissent à la main sur les
 * posts qui comptent.
 *
 * Parseur CSV minimal mais conforme (RFC 4180) : un commentaire contient des
 * virgules, des guillemets doublés et des sauts de ligne.
 */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^﻿/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((value) => value.trim().length > 0));
}

export type SharedPost = { published_at: string | null; url: string | null; content: string };

/** Les posts de l'export, du plus récent au plus ancien ; les partages sans texte sont écartés. */
export function parseSharesCsv(text: string): { posts: SharedPost[]; skipped: number } {
  const rows = parseCsv(text);
  const header = rows[0]?.map((cell) => cell.trim().toLowerCase()) ?? [];
  const column = (name: string) => header.indexOf(name.toLowerCase());
  const date = column("Date");
  const link = column("ShareLink");
  const commentary = column("ShareCommentary");
  if (commentary < 0) throw new Error("Ce fichier n'a pas de colonne ShareCommentary : ce n'est pas l'export Shares.csv de LinkedIn.");

  const posts: SharedPost[] = [];
  let skipped = 0;
  for (const row of rows.slice(1)) {
    const content = (row[commentary] ?? "").trim();
    if (content.length < 40) {
      skipped += 1;
      continue;
    }
    const rawDate = date >= 0 ? (row[date] ?? "").trim() : "";
    const parsed = rawDate ? Date.parse(rawDate.replace(" ", "T") + (rawDate.length <= 19 ? "Z" : "")) : Number.NaN;
    posts.push({
      published_at: Number.isNaN(parsed) ? null : new Date(parsed).toISOString(),
      url: link >= 0 ? (row[link] ?? "").trim() || null : null,
      content,
    });
  }
  posts.sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
  return { posts, skipped };
}
