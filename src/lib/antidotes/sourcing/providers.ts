/**
 * Les fournisseurs du sourcing, vus par le moteur.
 *
 * Chaque étape de la chaîne parle à un tiers — Apify pour Google Maps et la
 * recherche LinkedIn, l'Ad Library de Meta pour les publicités, le registre
 * légal pour les dirigeants, Dropcontact et Hunter pour les adresses — et
 * chacun se branche par une clé d'environnement. Ce module ne fait qu'en
 * décrire la forme ; les implémentations vivent dans `engines/`, `ads/`,
 * `discovery/` et `email/`, et `assembleProviders()` (server) les monte
 * selon les clés présentes.
 *
 * Un fournisseur absent n'est pas une panne : l'étape le dit, le passage
 * continue avec ce qu'il a, et le taux de survie le montre.
 */

import type { PersonCandidate } from "./decision-maker";
import type { ResolvedSourceParams } from "./config";
import type {
  CampaignEngine,
  DiscoverySourceKey,
  EmailProviderKey,
  EmailStatus,
} from "../types";

export type Fetcher = typeof fetch;

/** Une société telle qu'un moteur la rend, avant qualification. */
export type SourcedCompany = {
  company_name: string;
  website: string | null;
  /** ISO 3166-1 alpha-2, majuscules. */
  country: string | null;
  city: string | null;
  postal_code: string | null;
  sector: string | null;
  rating: number | null;
  reviews_count: number | null;
  phone: string | null;
  /** Les identifiants externes, pour l'idempotence : `place_id` pour Maps. */
  external_ids: Record<string, string>;
};

export type SourcingEngine = (params: ResolvedSourceParams) => Promise<SourcedCompany[]>;

/** `null` : impossible de savoir — jeton absent, refus, plafond. */
export type AdsVerdict = { active: boolean; last_seen_at: string | null } | null;

export type AdsChecker = (input: { company_name: string; country: string }) => Promise<AdsVerdict>;

export type DiscoveryInput = {
  company_name: string;
  website: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
};

export type DiscoveryResult = {
  people: PersonCandidate[];
  /** Ce que la source apprend en passant : effectif, SIREN, page LinkedIn. */
  employees?: number | null;
  siren?: string | null;
  company_linkedin_url?: string | null;
};

export type PeopleFinder = (input: DiscoveryInput) => Promise<DiscoveryResult>;

export type EmailInput = {
  first_name: string;
  last_name: string;
  website: string | null;
  company_name: string;
};

export type EmailResult = {
  email: string;
  status: EmailStatus;
  provider: EmailProviderKey;
};

export type EmailFinder = (input: EmailInput) => Promise<EmailResult | null>;

/** Vérifie une adresse déduite : la déduction seule ne sort jamais `valid`. */
export type EmailVerifier = (email: string) => Promise<EmailStatus>;

export type Providers = {
  engines: Partial<Record<CampaignEngine, SourcingEngine>>;
  ads: AdsChecker | null;
  discovery: Partial<Record<DiscoverySourceKey, PeopleFinder>>;
  email: Partial<Record<EmailProviderKey, EmailFinder>>;
  verifier: EmailVerifier | null;
  /** Ce qui n'est pas branché, en clair — pour l'écran et pour le journal. */
  missing: string[];
};

/** Une erreur d'un tiers, avec ce qu'il a répondu : le journal la garde telle quelle. */
export class ProviderError extends Error {
  constructor(
    public readonly provider: string,
    message: string,
    public readonly status?: number,
  ) {
    super(`${provider} : ${message}`);
    this.name = "ProviderError";
  }
}

/** Un appel HTTP borné dans le temps : un tiers qui ne répond pas ne bloque pas le passage. */
export async function fetchJson<T>(
  fetcher: Fetcher,
  provider: string,
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 30_000);
  try {
    const response = await fetcher(url, { ...init, signal: controller.signal });
    const text = await response.text();
    if (!response.ok) {
      throw new ProviderError(provider, `${response.status} ${text.slice(0, 300)}`, response.status);
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ProviderError(provider, `réponse illisible : ${text.slice(0, 120)}`);
    }
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new ProviderError(provider, /abort/i.test(message) ? "délai dépassé" : message);
  } finally {
    clearTimeout(timer);
  }
}

/** Comparaison souple de deux noms de société : accents, casse, ponctuation et formes juridiques ignorés. */
export function companyNamesMatch(left: string, right: string): boolean {
  const a = companyKey(left);
  const b = companyKey(right);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export function companyKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(sarl|sas|sasu|eurl|sa|sci|snc|societe|société|ltd|gmbh|inc)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
