import "server-only";

import {
  extractPlatformRules,
  renderAssetSummaries,
  renderBrief,
} from "./injected-context";
import { getActiveContext, listAssets } from "./queries";

/**
 * Contexte éditorial d'un client — la matière première des prompts.
 *
 * Le contrat est celui qu'attend `src/lib/production/generate.ts` : six
 * champs texte, vides plutôt qu'inventés. Il était rempli par un bouchon en
 * attendant que le module Contexte existe ; il l'est maintenant pour de vrai,
 * depuis le brief actif et les documents cochés de l'espace.
 *
 * Trois champs restent vides parce que **rien ne les alimente aujourd'hui** :
 * le Contexte décrit la marque, pas le mois. Les prompts affichent alors
 * « Non renseigné. » et le modèle sait qu'il travaille sans cette matière —
 * c'est la règle de la maison, une source absente se dit, elle ne s'invente
 * pas. Les accroches déjà publiées ne passent pas non plus par ici : la
 * génération lit `wording_history` elle-même, au moment où elle en a besoin.
 */

export type ClientContext = {
  /** Brief éditorial du client — ligne, ton, thématiques. */
  client_context: string;
  /** Résumés des documents de référence fournis par le client. */
  client_assets_summaries: string;
  /** Règles de rédaction par plateforme, propres au client. */
  platform_rules: string;
  /** Contraintes particulières du mois (événement, lancement, pause). */
  contraintes: string;
  /** Marronniers et événements sectoriels identifiés. */
  marronniers: string;
  /** Objectifs chiffrés fixés avec le client. */
  objectifs: string;
};

export async function getClientContext(options: {
  workspaceId: string;
}): Promise<ClientContext> {
  const [brief, assets] = await Promise.all([
    getActiveContext(options.workspaceId),
    listAssets(options.workspaceId),
  ]);

  const platformRules = Object.entries(extractPlatformRules(brief))
    .map(([platform, rule]) => `- ${platform} : ${rule}`)
    .join("\n");

  return {
    // Le brief entier : contexte principal, positionnement, cibles, ton,
    // piliers, livrables mensuels, mentions et interdits.
    client_context: renderBrief(brief),
    // Seuls les documents cochés : la case de la page Contexte est ce qui
    // décide de ce qui part dans les prompts.
    client_assets_summaries: renderAssetSummaries(assets),
    platform_rules: platformRules,
    contraintes: "",
    marronniers: "",
    objectifs: "",
  };
}
