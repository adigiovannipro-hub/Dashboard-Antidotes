/**
 * Lire un décisionnaire sur le site de la société.
 *
 * Le dernier recours de la cascade, et le plus fiable pour une petite
 * structure française : la loi oblige toute page « Mentions légales » à
 * nommer le **directeur de la publication** — le dirigeant, presque toujours.
 * Les pages équipe et « qui sommes-nous » complètent.
 *
 * Module pur : il reçoit du HTML, rend des personnes. Le nom est exigé avec
 * une majuscule initiale sur chaque mot — « Directeur de la publication : la
 * société » ne doit pas devenir un contact.
 */

import type { PersonCandidate } from "./decision-maker";

/** Les pages où un nom se trouve, dans l'ordre où on les lit. */
export const CANDIDATE_PATHS = [
  "/mentions-legales",
  "/mentions-legales/",
  "/mentions-legales.html",
  "/mentions_legales",
  "/legal",
  "/a-propos",
  "/a-propos/",
  "/qui-sommes-nous",
  "/notre-equipe",
  "/equipe",
  "/team",
  "/about",
];

/** Le texte d'une page, balises et scripts retirés, espaces repliés. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&eacute;/g, "é")
    .replace(/&egrave;/g, "è")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n+/g, "\n")
    .trim();
}

/* Un nom : deux à quatre mots capitalisés, tirets et apostrophes admis. Le
   premier mot ne doit pas être une civilité, retirée en amont. */
const NAME = "([A-ZÀ-Ý][\\p{L}'’-]+(?:\\s+[A-ZÀ-Ý][\\p{L}'’-]+){1,3})";
const CIVILITY = "(?:M\\.|Mme|Mlle|Madame|Monsieur|Mr|Mrs|Ms)?\\s*";

const ROLE_FIRST: { role: string; pattern: RegExp }[] = [
  {
    role: "Directeur de la publication",
    pattern: new RegExp(
      `Direct(?:eur|rice)\\s+de\\s+(?:la\\s+)?publication\\s*[:：]?\\s*${CIVILITY}${NAME}`,
      "u",
    ),
  },
  {
    role: "Représentant légal",
    pattern: new RegExp(`Représentant(?:e)?\\s+légal(?:e)?\\s*[:：]\\s*${CIVILITY}${NAME}`, "u"),
  },
  {
    role: "Gérant",
    pattern: new RegExp(`\\bGérant(?:e)?\\s*[:：]\\s*${CIVILITY}${NAME}`, "u"),
  },
  {
    role: "Président",
    pattern: new RegExp(`\\bPrésident(?:e)?\\s*[:：]\\s*${CIVILITY}${NAME}`, "u"),
  },
  {
    role: "Fondateur",
    pattern: new RegExp(`\\b(?:Co-)?Fondat(?:eur|rice)\\s*[:：]\\s*${CIVILITY}${NAME}`, "u"),
  },
  {
    role: "Directeur général",
    pattern: new RegExp(`\\bDirect(?:eur|rice)\\s+général(?:e)?\\s*[:：]\\s*${CIVILITY}${NAME}`, "u"),
  },
];

/* « Camille Roux, gérante » / « Camille Roux – Responsable marketing ». */
const NAME_FIRST = new RegExp(
  `${NAME}\\s*[,–—-]\\s*((?:co-?)?fondat(?:eur|rice)|gérant(?:e)?|président(?:e)?|dirigeant(?:e)?|CEO|direct(?:eur|rice)\\s+(?:général(?:e)?|marketing|de\\s+la\\s+communication)|responsable\\s+(?:marketing|communication|e-?commerce|digital))`,
  "giu",
);

const STOP_WORDS = new Set(["La", "Le", "Les", "Société", "Sarl", "Sas", "Sasu", "Eurl", "Sa", "The"]);

function splitName(full: string): { first_name: string; last_name: string } | null {
  const words = full
    .replace(/[’]/g, "'")
    .split(/\s+/)
    .filter((word) => word.length > 1);
  if (words.length < 2 || STOP_WORDS.has(words[0]!)) return null;
  // Tout en capitales — « ROUX Camille » — est un nom d'abord : le registre
  // et les mentions légales écrivent souvent le nom avant le prénom.
  const upper = words.filter((word) => word === word.toUpperCase() && /\p{L}/u.test(word));
  if (upper.length > 0 && upper.length < words.length) {
    const last = upper.map(titleCase).join(" ");
    const first = words.filter((word) => word !== word.toUpperCase()).join(" ");
    return { first_name: first, last_name: last };
  }
  return { first_name: words[0]!, last_name: words.slice(1).join(" ") };
}

function titleCase(word: string): string {
  return word
    .toLowerCase()
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("-");
}

export function extractPeopleFromHtml(html: string): PersonCandidate[] {
  const text = htmlToText(html);
  const people: PersonCandidate[] = [];
  const seen = new Set<string>();

  const push = (full: string, role: string) => {
    const name = splitName(full);
    if (!name) return;
    const key = `${name.first_name} ${name.last_name}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    people.push({ ...name, role, source: "website" });
  };

  for (const { role, pattern } of ROLE_FIRST) {
    const match = pattern.exec(text);
    if (match?.[1]) push(match[1], role);
  }

  for (const match of text.matchAll(NAME_FIRST)) {
    if (match[1] && match[2]) push(match[1], match[2]);
  }

  return people;
}
