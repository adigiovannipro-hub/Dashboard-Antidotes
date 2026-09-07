import "server-only";

import { cache } from "react";
import { notFound } from "next/navigation";

import { getViewer } from "@/lib/auth";

/**
 * Résolution de l'accès au pôle Antidotes.
 *
 * Même posture que Finance et « Mon travail » : c'est la prospection de
 * l'agence, réservée à l'owner de l'organisation. Les routes renvoient un 404
 * plutôt qu'un 403 — qui n'y a pas droit ne doit pas même apprendre que le
 * module existe. La RLS applique la même frontière côté base ; ceci ne fait
 * que l'exprimer côté écran.
 */

export type AntidotesAccess = {
  orgId: string;
};

export const getAntidotesContext = cache(async (): Promise<AntidotesAccess | null> => {
  const viewer = await getViewer();
  if (!viewer || !viewer.isOwner) return null;

  const orgId = viewer.ownedOrgIds[0] ?? null;
  if (!orgId) return null;

  return { orgId };
});

/** Exige l'accès. Renvoie un 404 sinon — jamais un 403. */
export async function requireAntidotesAccess(): Promise<AntidotesAccess> {
  const context = await getAntidotesContext();
  if (!context) notFound();
  return context;
}
