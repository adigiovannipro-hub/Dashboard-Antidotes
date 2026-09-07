/**
 * Le site de la société : mentions légales, page équipe, « qui sommes-nous ».
 *
 * On lit la page d'accueil puis les chemins habituels, et on s'arrête à la
 * première qui nomme quelqu'un. Chaque page est bornée en temps et en taille
 * — un site lent ou une brochure de dix mégaoctets ne doivent pas coûter le
 * passage. Le parseur, lui, est pur (`website-people.ts`).
 */

import type { PeopleFinder, Fetcher } from "../providers";
import { CANDIDATE_PATHS, extractPeopleFromHtml } from "../website-people";

const MAX_BYTES = 600_000;
const USER_AGENT = "Mozilla/5.0 (compatible; AntidotesBot/1.0; +https://antidotes.hk)";

async function fetchPage(fetcher: Fetcher, url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetcher(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "";
    if (type && !type.includes("html")) return null;
    const text = await response.text();
    return text.slice(0, MAX_BYTES);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Les liens internes d'une page d'accueil qui ressemblent à une page utile. */
export function usefulLinks(homeHtml: string, base: URL): string[] {
  const found = new Set<string>();
  for (const match of homeHtml.matchAll(/href=["']([^"'#?]+)["']/gi)) {
    const href = match[1]!;
    if (!/mention|legal|propos|equipe|équipe|team|about|qui-sommes/i.test(href)) continue;
    try {
      const url = new URL(href, base);
      if (url.hostname !== base.hostname) continue;
      found.add(url.toString());
    } catch {
      // Un href illisible n'est pas une page.
    }
  }
  return [...found].slice(0, 6);
}

export function createWebsiteFinder(options: { fetcher?: Fetcher } = {}): PeopleFinder {
  const fetcher = options.fetcher ?? fetch;
  return async (input) => {
    if (!input.website) return { people: [] };
    let base: URL;
    try {
      base = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(input.website) ? input.website : `https://${input.website}`);
    } catch {
      return { people: [] };
    }

    const home = await fetchPage(fetcher, base.toString());
    const pages = [
      ...(home ? usefulLinks(home, base) : []),
      ...CANDIDATE_PATHS.map((path) => new URL(path, base).toString()),
    ];
    const visited = new Set<string>();

    if (home) {
      const people = extractPeopleFromHtml(home);
      if (people.length > 0) return { people };
    }
    for (const url of pages) {
      if (visited.has(url)) continue;
      visited.add(url);
      const html = await fetchPage(fetcher, url);
      if (!html) continue;
      const people = extractPeopleFromHtml(html);
      if (people.length > 0) return { people };
    }
    return { people: [] };
  };
}
