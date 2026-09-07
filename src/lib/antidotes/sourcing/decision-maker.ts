/**
 * Choisir le décisionnaire parmi les personnes trouvées.
 *
 * Deux règles du cahier des charges, et rien d'autre :
 *   • on ne garde qu'un poste qui répond aux mots-clés de la campagne —
 *     sans poste reconnu, il n'y a **pas** de contact, et le prospect sort du
 *     flux (`no_contact_found`) plutôt que d'écrire à n'importe qui ;
 *   • à partir d'un certain effectif, on vise le marketing avant le dirigeant
 *     — en dessous, l'inverse.
 *
 * Module pur, testé. Les accents et la casse ne comptent pas : « Gérant » et
 * « gerant » sont le même poste.
 */

import type { DiscoverySourceKey, Seniority } from "../types";

export type PersonCandidate = {
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  linkedin_url?: string | null;
  source: DiscoverySourceKey;
};

export type DecisionMaker = {
  person: PersonCandidate;
  seniority: Seniority;
  matched_keyword: string;
};

export function normalizeLabel(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const FOUNDER_WORDS = [
  "fondat",
  "founder",
  "dirigeant",
  "gerant",
  "president",
  "ceo",
  "directeur general",
  "directrice generale",
  "co-fondat",
  "cofondat",
  "owner",
  "proprietaire",
];
const HEAD_WORDS = ["directeur", "directrice", "director", "head of", "cmo", "vp ", "chief"];
const MANAGER_WORDS = ["responsable", "manager", "charge", "chargee", "lead"];
const MARKETING_WORDS = ["marketing", "communication", "e-commerce", "ecommerce", "digital", "growth", "acquisition"];

/** Le niveau d'un poste, lu dans son libellé. */
export function seniorityOf(role: string | null | undefined): Seniority {
  const label = normalizeLabel(role);
  if (!label) return "other";
  if (FOUNDER_WORDS.some((word) => label.includes(word))) return "founder";
  if (HEAD_WORDS.some((word) => label.includes(word))) return "head_of";
  if (MANAGER_WORDS.some((word) => label.includes(word))) return "manager";
  return "other";
}

export function isMarketingRole(role: string | null | undefined): boolean {
  const label = normalizeLabel(role);
  return MARKETING_WORDS.some((word) => label.includes(word));
}

/** Le premier mot-clé de la campagne que le poste contient, ou `null`. */
export function matchJobKeyword(role: string | null | undefined, keywords: string[]): string | null {
  const label = normalizeLabel(role);
  if (!label) return null;
  for (const keyword of keywords) {
    const needle = normalizeLabel(keyword);
    if (needle && label.includes(needle)) return keyword;
  }
  return null;
}

const SENIORITY_RANK: Record<Seniority, number> = {
  founder: 3,
  head_of: 2,
  manager: 1,
  other: 0,
};

export function pickDecisionMaker(
  candidates: PersonCandidate[],
  options: { jobKeywords: string[]; marketingThreshold: number; employees: number | null },
): DecisionMaker | null {
  const preferMarketing =
    options.employees !== null && options.employees >= options.marketingThreshold;

  let best: { entry: DecisionMaker; score: number } | null = null;

  for (const person of candidates) {
    if (!person.first_name && !person.last_name) continue;
    const keyword = matchJobKeyword(person.role, options.jobKeywords);
    if (!keyword) continue;

    const seniority = seniorityOf(person.role);
    const marketing = isMarketingRole(person.role);

    // La famille voulue d'abord, le niveau ensuite, un nom complet enfin.
    const family = preferMarketing ? (marketing ? 2 : 1) : marketing ? 1 : 2;
    const score =
      family * 100 + SENIORITY_RANK[seniority] * 10 + (person.first_name && person.last_name ? 1 : 0);

    if (!best || score > best.score) {
      best = { entry: { person, seniority, matched_keyword: keyword }, score };
    }
  }

  return best?.entry ?? null;
}
