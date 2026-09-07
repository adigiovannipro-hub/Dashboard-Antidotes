/**
 * LinkedIn, sans toucher à LinkedIn : une recherche Google
 * `site:linkedin.com/in "Société" ville` par l'acteur Apify
 * `apify/google-search-scraper`, dont la sortie est stable et documentée —
 * là où un scraper de profils demande des cookies de session et change de
 * forme tous les trimestres.
 *
 * Le titre d'un résultat porte tout ce qu'il faut : « Camille Roux - Gérante
 * - Optique Saint-Jean | LinkedIn ». On ne garde que les titres qui nomment
 * la société, sinon la recherche ramène des homonymes.
 */

import type { PersonCandidate } from "../decision-maker";
import { companyNamesMatch, fetchJson, type Fetcher, type PeopleFinder } from "../providers";

export const SEARCH_ACTOR = "apify~google-search-scraper";

export type SearchResult = { title?: string; url?: string; description?: string };
export type SearchPage = { organicResults?: SearchResult[] };

export function linkedinQuery(input: { company_name: string; city: string | null }): string {
  return `site:linkedin.com/in "${input.company_name}"${input.city ? ` ${input.city}` : ""}`;
}

/**
 * « Prénom Nom - Poste - Société | LinkedIn » → une personne, si la société
 * est bien la nôtre. LinkedIn varie les séparateurs (–, -, |) et met parfois
 * la société avant le poste : on lit les deux ordres.
 */
export function parseLinkedinTitle(
  title: string,
  companyName: string,
  url: string | null,
): PersonCandidate | null {
  const cleaned = title.replace(/\s*[|·-]\s*LinkedIn\s*$/i, "").trim();
  const parts = cleaned
    .split(/\s+[-–—|]\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;

  const [name, ...rest] = parts;
  const companyIndex = rest.findIndex((part) => companyNamesMatch(part, companyName));
  if (companyIndex === -1) return null;
  const role = rest.filter((_, index) => index !== companyIndex).join(" · ") || null;

  const words = name!.split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;

  return {
    first_name: words[0]!,
    last_name: words.slice(1).join(" "),
    role,
    linkedin_url: url,
    source: "linkedin",
  };
}

export function peopleFromSearch(pages: SearchPage[], companyName: string): PersonCandidate[] {
  const people: PersonCandidate[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    for (const result of page.organicResults ?? []) {
      if (!result.title) continue;
      const person = parseLinkedinTitle(result.title, companyName, result.url ?? null);
      if (!person) continue;
      const key = `${person.first_name} ${person.last_name}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      people.push(person);
    }
  }
  return people;
}

export function createLinkedinSearchFinder(options: { token: string; fetcher?: Fetcher }): PeopleFinder {
  const fetcher = options.fetcher ?? fetch;
  return async (input) => {
    const url = `https://api.apify.com/v2/acts/${SEARCH_ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(options.token)}&timeout=120&format=json&clean=true`;
    const pages = await fetchJson<SearchPage[]>(fetcher, "Apify recherche LinkedIn", url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        queries: linkedinQuery(input),
        countryCode: (input.country ?? "fr").toLowerCase(),
        languageCode: "fr",
        maxPagesPerQuery: 1,
        resultsPerPage: 10,
        mobileResults: false,
      }),
      timeoutMs: 130_000,
    });
    return { people: peopleFromSearch(Array.isArray(pages) ? pages : [], input.company_name) };
  };
}
