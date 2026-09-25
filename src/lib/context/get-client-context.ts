import "server-only";

import { buildContextSections, renderContextSections, totalContextTokens } from "./injected-context";
import type { ContextSection } from "./injected-context";
import {
  getActiveContext,
  getGenerationSettings,
  listAssets,
  listRecentAccroches,
} from "./queries";

/**
 * Le contexte éditorial d'un client — la matière première des prompts.
 *
 * **Une seule chaîne d'assemblage, partagée avec l'écran.** Cette fonction
 * rendait auparavant cinq champs séparés (`client_context`,
 * `client_assets_summaries`, `platform_rules`, `contraintes`, `marronniers`)
 * interpolés à la main dans trois markdown : deux d'entre eux ne recevaient
 * jamais les règles de plateforme, et les deux derniers champs valaient `""`
 * depuis toujours. Elle rend maintenant le **même tableau de sections** que la
 * modale « Voir le prompt injecté », plus son `join`. Le compteur de l'écran
 * et le texte du modèle ne peuvent donc plus diverger.
 *
 * `objectifs` a été retiré bien avant, pour la même raison : une section qui
 * promet ce qu'elle n'a pas est pire qu'une section absente.
 */
export type ClientContextBundle = {
  /** Les sections, dans l'ordre où le modèle les lit. */
  sections: ContextSection[];
  /** Le texte exact envoyé au modèle. */
  injected: string;
  /** Son poids estimé — le même chiffre que celui affiché à l'écran. */
  tokens: number;
};

export async function getClientContext(options: {
  workspaceId: string;
  /**
   * Mois visé par la génération (`YYYY-MM-01`). C'est lui qui décide si la
   * consigne du mois part : une consigne d'août n'a rien à faire dans une
   * génération d'octobre, et aucun trigger ne l'efface pour nous.
   */
  targetMonth?: string | null;
  /** Ajustement à chaud saisi au lancement. Jamais persisté. */
  adjustment?: string | null;
  /** Plafond d'accroches injectées en négatif. */
  accrochesLimit?: number;
  /** Le client du job appelant — un job sans requête n'a pas de cookies. */
  client?: Parameters<typeof getActiveContext>[1];
}): Promise<ClientContextBundle> {
  const [brief, assets, settings, accroches] = await Promise.all([
    getActiveContext(options.workspaceId, options.client),
    listAssets(options.workspaceId, options.client),
    getGenerationSettings(options.workspaceId, options.client),
    listRecentAccroches(options.workspaceId, {
      limit: options.accrochesLimit ?? 30,
      client: options.client,
    }),
  ]);

  const sections = buildContextSections({
    brief,
    assets,
    settings,
    accroches: accroches.map((entry) => entry.hook),
    targetMonth: options.targetMonth ?? null,
    adjustment: options.adjustment ?? null,
  });

  return {
    sections,
    injected: renderContextSections(sections),
    tokens: totalContextTokens(sections),
  };
}
