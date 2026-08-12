import "server-only";

import {
  buildInjectedContext,
  extractPlatformRules,
  renderAssetSummaries,
} from "./injected-context";
import { getActiveContext, listAssets, listRecentAccroches } from "./queries";
import type { ClientContext } from "./types";

/**
 * Le contexte complet d'un client, prêt à être injecté dans une génération.
 *
 * C'est la vraie source du stub prévu par la branche des cartes client :
 * toutes les routes de génération (`/api/generate/*`) l'appellent avec l'id
 * de l'espace, et le contexte suit le client automatiquement — aucune
 * sélection manuelle, aucun copier-coller.
 *
 * Seuls le brief actif et les **résumés** des documents cochés partent dans
 * les prompts. Jamais un document brut.
 */

export type ClientGenerationContext = {
  brief: ClientContext | null;
  /** Résumés des documents où `include_in_context` est coché, concaténés. */
  assetSummaries: string;
  /** Règles d'écriture par réseau, extraites du champ `platforms` du brief. */
  platformRules: Record<string, string>;
  /** Les 30 dernières accroches validées — à ne jamais recycler. */
  recentAccroches: string[];
};

export async function getClientContext(clientId: string): Promise<ClientGenerationContext> {
  const [brief, assets, accroches] = await Promise.all([
    getActiveContext(clientId),
    listAssets(clientId),
    listRecentAccroches(clientId, { limit: 30 }),
  ]);

  return {
    brief,
    assetSummaries: renderAssetSummaries(assets),
    platformRules: extractPlatformRules(brief),
    recentAccroches: accroches.map((entry) => entry.hook),
  };
}

/** La chaîne injectée telle quelle dans les prompts — celle que mesure le compteur. */
export function renderClientContext(context: ClientGenerationContext): string {
  return buildInjectedContext(context);
}
