import type { PlanningRole } from "./types";

/**
 * Permissions du module Planning Édito.
 *
 * Miroir applicatif des politiques RLS de la migration 0007. L'interface s'en
 * sert pour masquer ce qui n'est pas permis ; la base reste l'autorité.
 *
 * Une capacité mérite d'être notée : `sync.push` est ouverte à l'éditeur, parce
 * que renvoyer un wording dans Monday fait partie de son travail quotidien. Ce
 * que ce push peut toucher est en revanche verrouillé ailleurs, dans
 * `monday-mapping.ts` : le Wording et les Commentaires, rien d'autre. Aucun
 * rôle, owner compris, ne peut réécrire un statut client depuis Antidotes.
 */

export type PlanningCapability =
  // Quotidien
  | "subject.read"
  | "wording.write"
  | "sync.pull"
  | "sync.push"
  // Administration
  | "board.manage"
  | "members.manage"
  | "strategy.manage";

const CAPABILITIES: Record<PlanningRole, PlanningCapability[]> = {
  owner: [
    "subject.read",
    "wording.write",
    "sync.pull",
    "sync.push",
    "board.manage",
    "members.manage",
    "strategy.manage",
  ],
  editor: ["subject.read", "wording.write", "sync.pull", "sync.push"],
  viewer: ["subject.read"],
};

export function can(
  role: PlanningRole,
  capability: PlanningCapability,
): boolean {
  return CAPABILITIES[role].includes(capability);
}

export type PlanningAccess = {
  role: PlanningRole;
  clientIds: string[];
};

export const NO_ACCESS: PlanningAccess = { role: "viewer", clientIds: [] };

export function hasClientAccess(
  access: PlanningAccess,
  clientId: string,
): boolean {
  return access.clientIds.includes(clientId);
}

/**
 * Le module doit-il apparaître dans la navigation ?
 *
 * Non pour qui n'a aucun client rattaché — et c'est le cas de tous les clients
 * du dashboard de reporting, qui ne doivent pas même savoir qu'il existe.
 */
export function isPlanningVisible(access: PlanningAccess): boolean {
  return access.clientIds.length > 0;
}
