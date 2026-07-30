import type { ModerationRole } from "./types";

/**
 * Permissions du module Modération.
 *
 * Trois rôles, et une règle qui gouverne tout le reste : **le module est
 * interne**. Un client final peut recevoir un rôle opérateur sur son propre
 * périmètre, mais il n'atteint jamais un autre client, ni le journal global, ni
 * les réglages d'auto-envoi, ni les connexions API.
 *
 * Cette table est le miroir applicatif des politiques RLS de la migration 0005.
 * L'interface s'en sert pour masquer ce qui n'est pas permis ; la base reste
 * l'autorité — un appel direct à l'API ne rendrait rien de plus.
 */

export type ModerationCapability =
  // Traitement quotidien
  | "conversation.read"
  | "conversation.reply"
  | "conversation.ignore"
  | "conversation.snooze"
  | "conversation.delete"
  | "faq.read"
  | "faq.write"
  | "faq.rollback"
  // Administration
  | "client.manage"
  | "members.manage"
  | "connections.manage"
  | "autosend.manage"
  | "monday.import"
  | "audit.read"
  | "audit.read_all_clients"
  | "purge.run";

const CAPABILITIES: Record<ModerationRole, ModerationCapability[]> = {
  owner: [
    "conversation.read",
    "conversation.reply",
    "conversation.ignore",
    "conversation.snooze",
    "conversation.delete",
    "faq.read",
    "faq.write",
    "faq.rollback",
    "client.manage",
    "members.manage",
    "connections.manage",
    "autosend.manage",
    "monday.import",
    "audit.read",
    "audit.read_all_clients",
    "purge.run",
  ],
  operator: [
    "conversation.read",
    "conversation.reply",
    "conversation.ignore",
    "conversation.snooze",
    "faq.read",
    "faq.write",
    "faq.rollback",
    // Le journal, oui — mais uniquement sur ses propres clients. C'est la RLS
    // qui restreint le périmètre ; `audit.read_all_clients` reste à l'owner.
    "audit.read",
  ],
  viewer: ["conversation.read", "faq.read", "audit.read"],
};

export function can(
  role: ModerationRole,
  capability: ModerationCapability,
): boolean {
  return CAPABILITIES[role].includes(capability);
}

/**
 * Un opérateur peut être soumis à validation admin avant envoi, par client.
 * Dans ce cas il rédige et valide le brouillon, mais l'envoi attend un owner :
 * la conversation reste en `awaiting_validation`.
 */
export function canSendWithoutApproval(
  role: ModerationRole,
  requiresApproval: boolean,
): boolean {
  if (role === "owner") return true;
  if (!can(role, "conversation.reply")) return false;
  return !requiresApproval;
}

export type ModerationAccess = {
  role: ModerationRole;
  clientIds: string[];
  requiresApprovalByClient: Record<string, boolean>;
};

/** Un accès explicitement vide : aucun client, aucune capacité utile. */
export const NO_ACCESS: ModerationAccess = {
  role: "viewer",
  clientIds: [],
  requiresApprovalByClient: {},
};

export function hasClientAccess(
  access: ModerationAccess,
  clientId: string,
): boolean {
  return access.clientIds.includes(clientId);
}

/**
 * Le module doit-il apparaître dans la navigation ?
 *
 * Non pour un utilisateur sans aucun client rattaché — et c'est le cas de tous
 * les clients du dashboard de reporting, qui ne doivent même pas savoir que le
 * module existe.
 */
export function isModerationVisible(access: ModerationAccess): boolean {
  return access.clientIds.length > 0;
}
