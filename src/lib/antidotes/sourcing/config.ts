/**
 * La configuration résolue d'une campagne.
 *
 * Tout paramètre du sourcing se règle depuis l'écran de campagne et vit dans
 * trois jsonb (`source_params`, `filters`, `targeting`) où chaque clé est
 * optionnelle. Ce module est le seul endroit qui connaisse les défauts : le
 * moteur, la qualification, la cascade de décisionnaire et la cascade
 * d'adresses lisent une configuration **complète**, jamais la ligne brute.
 *
 * Module pur, sans base : testé tel quel.
 */

import type {
  Campaign,
  CampaignEngine,
  CampaignFilters,
  CampaignSourceParams,
  CampaignTargeting,
  DiscoverySourceKey,
  EmailProviderKey,
  ScoringWeights,
  SizeSignal,
} from "../types";
import { DEFAULT_SIZE_TOLERANCE, resolveScoringWeights } from "../scoring";

/** Les postes visés par défaut — dirigeant d'abord, marketing ensuite. */
export const DEFAULT_JOB_KEYWORDS = [
  "fondateur",
  "fondatrice",
  "dirigeant",
  "dirigeante",
  "gérant",
  "gérante",
  "président",
  "présidente",
  "CEO",
  "responsable marketing",
  "directeur marketing",
  "directrice marketing",
  "responsable e-commerce",
  "responsable communication",
];

/** À partir de vingt salariés, le dirigeant ne lit plus ses mails de prospection. */
export const DEFAULT_MARKETING_THRESHOLD = 20;

export const DEFAULT_DISCOVERY_SOURCES: { source: DiscoverySourceKey; enabled: boolean }[] = [
  { source: "linkedin", enabled: true },
  { source: "legal_registry", enabled: true },
  { source: "website", enabled: true },
];

export const DEFAULT_ENRICHMENT_WATERFALL: { provider: EmailProviderKey; enabled: boolean }[] = [
  { provider: "dropcontact", enabled: true },
  { provider: "hunter", enabled: true },
  { provider: "pattern", enabled: true },
];

/** Six mois : au-delà, une adresse vérifiée se revérifie avant tout envoi. */
export const DEFAULT_VERIFICATION_TTL_DAYS = 180;

export const DEFAULT_MIN_RATING = 4;
export const DEFAULT_COUNTRIES = ["FR"];
export const DEFAULT_RADIUS_KM = 10;
/** Cent lieux par recherche : environ 0,40 $ chez Apify, un ordre de grandeur sans surprise. */
export const DEFAULT_MAX_PLACES = 100;

export type ResolvedFilters = {
  size_tolerance: number;
  require_ads: boolean | "bonus";
  countries: string[];
  min_rating: number;
  scoring: ScoringWeights;
  reference_sector: string | null;
  reference_size: SizeSignal | null;
};

export type ResolvedTargeting = {
  job_keywords: string[];
  marketing_threshold: number;
  discovery_sources: { source: DiscoverySourceKey; enabled: boolean }[];
  enrichment_waterfall: { provider: EmailProviderKey; enabled: boolean }[];
  verification_ttl_days: number;
};

export type ResolvedSourceParams = {
  keywords: string[];
  cities: string[];
  radius_km: number;
  max_places: number;
  category: string;
  country: string;
  traffic_min: number | null;
  traffic_max: number | null;
  /** L'URL collée telle quelle ; `ad-library-url.ts` la lit au moment de vérifier les publicités. */
  ad_library_url: string | null;
};

export type ResolvedCampaignConfig = {
  engine: CampaignEngine;
  reference_client: string | null;
  source: ResolvedSourceParams;
  filters: ResolvedFilters;
  targeting: ResolvedTargeting;
};

const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    : [];

const number = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const nullableNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/**
 * Une liste ordonnée de sources ou de fournisseurs : ce que la campagne
 * porte dans son ordre, complété par ce qu'elle a oublié — un fournisseur
 * ajouté au code apparaît activé chez les campagnes qui ne le connaissent
 * pas encore, plutôt que de disparaître en silence.
 */
function orderedToggles<K extends string, T extends { enabled: boolean }>(
  raw: unknown,
  defaults: T[],
  keyOf: (entry: T) => K,
  build: (key: K, enabled: boolean) => T,
): T[] {
  const known = new Set(defaults.map(keyOf));
  const seen = new Set<K>();
  const result: T[] = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (typeof entry !== "object" || entry === null) continue;
      const candidate = entry as Record<string, unknown>;
      const key = (candidate.source ?? candidate.provider) as K;
      if (!known.has(key) || seen.has(key)) continue;
      seen.add(key);
      result.push(build(key, candidate.enabled !== false));
    }
  }
  for (const entry of defaults) {
    if (!seen.has(keyOf(entry))) result.push(entry);
  }
  return result;
}

export function resolveFilters(filters: CampaignFilters | null | undefined): ResolvedFilters {
  const raw = filters ?? {};
  return {
    size_tolerance:
      typeof raw.size_tolerance === "number" && raw.size_tolerance >= 0
        ? raw.size_tolerance
        : DEFAULT_SIZE_TOLERANCE,
    require_ads:
      raw.require_ads === "bonus" || typeof raw.require_ads === "boolean"
        ? raw.require_ads
        : true,
    // Sans pays déclaré, la France : la cible du cahier des charges, et le
    // seul registre légal branché.
    countries: (() => {
      const listed = strings(raw.countries).map((code) => code.toUpperCase());
      return listed.length > 0 ? listed : DEFAULT_COUNTRIES;
    })(),
    min_rating: number(raw.min_rating, DEFAULT_MIN_RATING),
    scoring: resolveScoringWeights(raw),
    reference_sector: raw.reference_sector?.trim() || null,
    reference_size: raw.reference_size ?? null,
  };
}

export function resolveTargeting(targeting: CampaignTargeting | null | undefined): ResolvedTargeting {
  const raw = targeting ?? {};
  const keywords = strings(raw.job_keywords);
  return {
    job_keywords: keywords.length > 0 ? keywords : DEFAULT_JOB_KEYWORDS,
    marketing_threshold: Math.max(0, number(raw.marketing_threshold, DEFAULT_MARKETING_THRESHOLD)),
    discovery_sources: orderedToggles(
      raw.discovery_sources,
      DEFAULT_DISCOVERY_SOURCES,
      (entry) => entry.source,
      (source, enabled) => ({ source, enabled }),
    ),
    enrichment_waterfall: orderedToggles(
      raw.enrichment_waterfall,
      DEFAULT_ENRICHMENT_WATERFALL,
      (entry) => entry.provider,
      (provider, enabled) => ({ provider, enabled }),
    ),
    verification_ttl_days: Math.max(
      1,
      number(raw.verification_ttl_days, DEFAULT_VERIFICATION_TTL_DAYS),
    ),
  };
}

export function resolveSourceParams(
  params: CampaignSourceParams | null | undefined,
): ResolvedSourceParams {
  const raw = params ?? {};
  return {
    keywords: strings(raw.keywords),
    cities: strings(raw.cities),
    radius_km: Math.max(1, number(raw.radius_km, DEFAULT_RADIUS_KM)),
    max_places: Math.min(1000, Math.max(1, number(raw.max_places, DEFAULT_MAX_PLACES))),
    category: typeof raw.category === "string" ? raw.category.trim() : "",
    country: (typeof raw.country === "string" ? raw.country.trim().toUpperCase() : "") || "FR",
    traffic_min: nullableNumber(raw.traffic_min),
    traffic_max: nullableNumber(raw.traffic_max),
    ad_library_url: (typeof raw.ad_library_url === "string" ? raw.ad_library_url.trim() : "") || null,
  };
}

export function resolveCampaignConfig(
  campaign: Pick<Campaign, "engine" | "reference_client" | "source_params" | "filters" | "targeting">,
): ResolvedCampaignConfig {
  return {
    engine: campaign.engine,
    reference_client: campaign.reference_client?.trim() || null,
    source: resolveSourceParams(campaign.source_params),
    filters: resolveFilters(campaign.filters),
    targeting: resolveTargeting(campaign.targeting),
  };
}

/**
 * Ce qui manque pour qu'une campagne puisse tourner. Vide : elle peut partir.
 * L'écran l'affiche à côté du bouton, le passage refuse de démarrer sans.
 * La Bibliothèque publicitaire n'en fait pas partie : sans elle, les
 * publicités se vérifient sur le pays de la source, comme avant.
 */
export function campaignReadiness(config: ResolvedCampaignConfig): string[] {
  const missing: string[] = [];
  if (config.engine === "maps") {
    if (config.source.keywords.length === 0) missing.push("au moins un mot-clé métier");
    if (config.source.cities.length === 0) missing.push("au moins une ville");
  } else if (!config.source.category) {
    missing.push("une catégorie de boutiques");
  }
  return missing;
}
