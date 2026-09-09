/**
 * « Cette société diffuse-t-elle des publicités ? » — l'Ad Library de Meta.
 *
 * Depuis le DSA, l'API rend toutes les publicités diffusées dans l'Union
 * (`ad_type=ALL`), pas seulement les politiques. On cherche les annonces
 * **actives** dont la Page porte le nom de la société ; une correspondance
 * suffit. Une réponse vide est un « non » ; un refus de Meta — jeton, plafond
 * — est un « on ne sait pas », qui envoie la société en revue plutôt qu'au
 * rejet. Quand la campagne porte une URL de la Bibliothèque qui désigne une
 * page (`view_all_page_id`), la recherche se fait par cette page et non par
 * le nom ; le filtre sur le nom de la Page reste, pour qu'une société ne soit
 * jamais dite « active » sur les annonces d'une autre.
 *
 * Jamais lancé contre le vrai Meta : le jeton attendu est un jeton
 * utilisateur d'une application ayant accès à l'Ad Library, ce que
 * `pnpm sonde:sourcing` établira au premier essai.
 */

import { companyNamesMatch, fetchJson, type AdsChecker, type Fetcher } from "../providers";

export const AD_LIBRARY_VERSION = "v21.0";

export type AdArchiveEntry = {
  id?: string;
  page_name?: string;
  ad_delivery_start_time?: string;
};

export function adLibraryUrl(input: {
  company_name: string;
  country: string;
  token: string;
  page_id?: string | null;
}): string {
  const params = new URLSearchParams({
    access_token: input.token,
    ad_type: "ALL",
    ad_active_status: "ACTIVE",
    ad_reached_countries: JSON.stringify([input.country]),
    fields: "id,page_name,ad_delivery_start_time",
    limit: "25",
  });
  // Une page désignée se cherche par son identifiant : c'est la lecture
  // exacte, là où le nom passe par une recherche plein texte et ses homonymes.
  if (input.page_id) {
    params.set("search_page_ids", JSON.stringify([input.page_id]));
  } else {
    params.set("search_terms", input.company_name);
    params.set("search_type", "KEYWORD_EXACT_PHRASE");
  }
  return `https://graph.facebook.com/${AD_LIBRARY_VERSION}/ads_archive?${params.toString()}`;
}

/** Les annonces dont la Page porte le nom de la société. */
export function matchingAds(entries: AdArchiveEntry[], companyName: string): AdArchiveEntry[] {
  return entries.filter((entry) => entry.page_name && companyNamesMatch(entry.page_name, companyName));
}

export function createMetaAdsChecker(options: { token: string; fetcher?: Fetcher }): AdsChecker {
  const fetcher = options.fetcher ?? fetch;
  return async (input) => {
    try {
      const payload = await fetchJson<{ data?: AdArchiveEntry[] }>(
        fetcher,
        "Meta Ad Library",
        adLibraryUrl({ ...input, token: options.token }),
        { timeoutMs: 20_000 },
      );
      const matches = matchingAds(payload.data ?? [], input.company_name);
      if (matches.length === 0) return { active: false, last_seen_at: null };
      const latest = matches
        .map((entry) => entry.ad_delivery_start_time ?? null)
        .filter((value): value is string => value !== null)
        .sort()
        .at(-1);
      return { active: true, last_seen_at: latest ?? new Date().toISOString() };
    } catch {
      // Un refus n'est pas un « non » : la société part en revue.
      return null;
    }
  };
}
