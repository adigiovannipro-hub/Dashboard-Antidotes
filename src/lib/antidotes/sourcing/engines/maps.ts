/**
 * Le moteur « lieu physique » : Google Maps, par l'acteur Apify
 * `compass/crawler-google-places`.
 *
 * Une recherche par ville — « opticien » dans « Lyon, FR » — bornée par
 * `max_places`, qui est aussi ce qui borne la facture : l'acteur se paie au
 * lieu rendu, quelques dixièmes de centime l'unité. Le nombre d'avis sert de
 * proxy de taille, la note de proxy de qualité.
 *
 * L'appel est **synchrone côté Apify** (`run-sync-get-dataset-items`) : la
 * réponse est le jeu de résultats, sans sondage d'exécution. Apify le borne à
 * cinq minutes ; au-delà d'une centaine de lieux par recherche, il faudrait
 * passer par une exécution asynchrone — ce n'est pas le cas d'usage.
 *
 * Le rayon de la campagne n'est pas transmis : l'acteur cherche dans la ville
 * nommée. Le géocodage d'un cercle demanderait une sonde sur la forme exacte
 * de `customGeolocation`, jamais jouée contre le vrai acteur.
 */

import { fetchJson, type Fetcher, type SourcedCompany, type SourcingEngine } from "../providers";
import type { ResolvedSourceParams } from "../config";

export const MAPS_ACTOR = "compass~crawler-google-places";

/** Ce que l'acteur rend par lieu — les seuls champs lus. */
export type MapsPlace = {
  title?: string;
  website?: string | null;
  phone?: string | null;
  city?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  totalScore?: number | null;
  reviewsCount?: number | null;
  placeId?: string | null;
  categoryName?: string | null;
  permanentlyClosed?: boolean;
  temporarilyClosed?: boolean;
};

/** Le corps envoyé à l'acteur pour une ville. */
export function mapsActorInput(params: ResolvedSourceParams, city: string) {
  return {
    searchStringsArray: params.keywords,
    locationQuery: `${city}, ${params.country}`,
    maxCrawledPlacesPerSearch: params.max_places,
    language: "fr",
    skipClosedPlaces: true,
  };
}

/** Un lieu de l'acteur → une société sourcée ; `null` s'il n'y a rien à en faire. */
export function mapMapsPlace(place: MapsPlace, fallbackCountry: string): SourcedCompany | null {
  const name = place.title?.trim();
  if (!name || place.permanentlyClosed) return null;
  const placeId = place.placeId?.trim() || null;
  return {
    company_name: name,
    website: place.website?.trim() || null,
    country: (place.countryCode?.trim().toUpperCase() || fallbackCountry) || null,
    city: place.city?.trim() || null,
    postal_code: place.postalCode?.trim() || null,
    sector: place.categoryName?.trim() || null,
    rating: typeof place.totalScore === "number" ? Math.round(place.totalScore * 10) / 10 : null,
    reviews_count: typeof place.reviewsCount === "number" ? place.reviewsCount : null,
    phone: place.phone?.trim() || null,
    external_ids: placeId ? { place_id: placeId } : {},
  };
}

export function createMapsEngine(options: { token: string; fetcher?: Fetcher }): SourcingEngine {
  const fetcher = options.fetcher ?? fetch;
  return async (params) => {
    const companies = new Map<string, SourcedCompany>();
    for (const city of params.cities) {
      const url = `https://api.apify.com/v2/acts/${MAPS_ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(options.token)}&timeout=300&format=json&clean=true`;
      const items = await fetchJson<MapsPlace[]>(fetcher, "Apify Google Maps", url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mapsActorInput(params, city)),
        timeoutMs: 320_000,
      });
      for (const item of Array.isArray(items) ? items : []) {
        const company = mapMapsPlace(item, params.country);
        if (!company) continue;
        // Un même lieu rendu par deux mots-clés ne rentre qu'une fois.
        const key = company.external_ids.place_id ?? `${company.company_name}|${company.city}`;
        if (!companies.has(key)) companies.set(key, company);
      }
    }
    return [...companies.values()];
  };
}
