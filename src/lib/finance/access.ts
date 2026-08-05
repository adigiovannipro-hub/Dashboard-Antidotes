import "server-only";

import { cache } from "react";
import { notFound } from "next/navigation";

import { getViewer } from "@/lib/auth";

/**
 * Résolution de l'accès au module Finance.
 *
 * Même posture que Reçus et Modération : outil interne, comptabilité
 * d'Antidotes. Les routes renvoient un 404 plutôt qu'un 403 — qui n'y a pas
 * droit ne doit pas même apprendre que le module existe.
 *
 * Deux niveaux : lire, et décider (recatégoriser, valider un rapprochement,
 * déclencher une synchronisation). La RLS applique la même frontière côté
 * base ; ceci ne fait que l'exprimer côté écran.
 */

export type FinanceAccess = {
  orgId: string;
  /** Peut recatégoriser, décider des rapprochements, synchroniser. */
  canDecide: boolean;
};

export const getFinanceContext = cache(
  async (): Promise<FinanceAccess | null> => {
    const viewer = await getViewer();
    if (!viewer) return null;

    const orgId = viewer.ownedOrgIds[0] ?? null;
    if (!orgId) return null;

    return { orgId, canDecide: viewer.isOwner };
  },
);

/** Exige l'accès. Renvoie un 404 sinon — jamais un 403. */
export async function requireFinanceAccess(): Promise<FinanceAccess> {
  const context = await getFinanceContext();
  if (!context) notFound();
  return context;
}
