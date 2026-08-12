import "server-only";

/**
 * Contexte éditorial d'un client — la matière première des prompts.
 *
 * TODO(prompt 2) : brancher les vraies sources (`client_context`,
 * `client_assets`) quand le module Contexte existera. En attendant, la couche
 * renvoie des champs vides sans planter : les prompts affichent alors
 * « Non renseigné. » et le modèle sait qu'il travaille sans brief.
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
  // Le paramètre fait partie du contrat dès aujourd'hui : le prompt 2 s'en
  // servira pour aller chercher le brief du bon espace.
  void options.workspaceId;
  return {
    client_context: "",
    client_assets_summaries: "",
    platform_rules: "",
    contraintes: "",
    marronniers: "",
    objectifs: "",
  };
}
