/**
 * Monter les fournisseurs depuis l'environnement.
 *
 * Chaque tiers se branche par une clé ; une clé absente retire le fournisseur
 * et le nomme dans `missing` — l'écran de campagne l'affiche, le journal du
 * passage le garde. Le registre légal n'a pas de clé : il est toujours là.
 *
 *   APIFY_TOKEN             Google Maps et la recherche LinkedIn
 *   META_AD_LIBRARY_TOKEN   les publicités actives (Ad Library)
 *   DROPCONTACT_API_KEY     l'adresse, cible française
 *   HUNTER_API_KEY          l'adresse internationale et le vérificateur
 *
 * Ni `server-only` ni base : lu par le script de passage comme par la page.
 */

import { createMetaAdsChecker } from "./ads/meta-ad-library";
import { createLegalRegistryFinder } from "./discovery/legal-registry";
import { createLinkedinSearchFinder } from "./discovery/linkedin-search";
import { createWebsiteFinder } from "./discovery/website";
import { createDropcontactFinder } from "./email/dropcontact";
import { createHunterFinder, createHunterVerifier } from "./email/hunter";
import { createMapsEngine } from "./engines/maps";
import type { Providers } from "./providers";

export type ProviderAvailability = {
  maps: boolean;
  ecommerce: boolean;
  ads: boolean;
  linkedin: boolean;
  legal_registry: boolean;
  website: boolean;
  dropcontact: boolean;
  hunter: boolean;
  pattern: boolean;
};

function key(name: string, env: NodeJS.ProcessEnv): string | null {
  const value = env[name]?.trim();
  return value ? value : null;
}

export function providerAvailability(env: NodeJS.ProcessEnv = process.env): ProviderAvailability {
  const apify = key("APIFY_TOKEN", env) !== null;
  return {
    maps: apify,
    // Le moteur e-commerce attend le choix d'une source (voir la ligne du
    // pôle dans CLAUDE.md) : aucune n'est branchée.
    ecommerce: false,
    ads: key("META_AD_LIBRARY_TOKEN", env) !== null,
    linkedin: apify,
    legal_registry: true,
    website: true,
    dropcontact: key("DROPCONTACT_API_KEY", env) !== null,
    hunter: key("HUNTER_API_KEY", env) !== null,
    pattern: true,
  };
}

export function assembleProviders(env: NodeJS.ProcessEnv = process.env): Providers {
  const apify = key("APIFY_TOKEN", env);
  const meta = key("META_AD_LIBRARY_TOKEN", env);
  const dropcontact = key("DROPCONTACT_API_KEY", env);
  const hunter = key("HUNTER_API_KEY", env);
  const missing: string[] = [];

  if (!apify) missing.push("APIFY_TOKEN (Google Maps, recherche LinkedIn)");
  if (!meta) missing.push("META_AD_LIBRARY_TOKEN (publicités actives)");
  if (!dropcontact) missing.push("DROPCONTACT_API_KEY");
  if (!hunter) missing.push("HUNTER_API_KEY");

  return {
    engines: {
      ...(apify ? { maps: createMapsEngine({ token: apify }) } : {}),
    },
    ads: meta ? createMetaAdsChecker({ token: meta }) : null,
    discovery: {
      ...(apify ? { linkedin: createLinkedinSearchFinder({ token: apify }) } : {}),
      legal_registry: createLegalRegistryFinder(),
      website: createWebsiteFinder(),
    },
    email: {
      ...(dropcontact ? { dropcontact: createDropcontactFinder({ apiKey: dropcontact }) } : {}),
      ...(hunter ? { hunter: createHunterFinder({ apiKey: hunter }) } : {}),
    },
    verifier: hunter ? createHunterVerifier({ apiKey: hunter }) : null,
    missing,
  };
}
