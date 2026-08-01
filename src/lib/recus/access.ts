import "server-only";

import { cache } from "react";
import { notFound } from "next/navigation";

import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ReceiptSource } from "./types";

/**
 * Résolution de l'accès au module Reçus.
 *
 * Le module est interne à l'organisation : il ne s'agit pas d'un espace client
 * mais de la comptabilité d'Antidotes. Comme pour la Modération, les routes
 * renvoient un 404 plutôt qu'un 403 — quelqu'un qui n'y a pas droit ne doit pas
 * même apprendre que le module existe.
 *
 * Deux niveaux, et pas trois : lire, et décider. Un module qui range des
 * factures n'a pas besoin d'une hiérarchie plus fine.
 */

export type ReceiptsAccess = {
  orgId: string;
  /** Peut valider, transférer, ignorer, configurer. */
  canDecide: boolean;
  /** Boîtes surveillées. Vide tant que rien n'est connecté. */
  sources: ReceiptSource[];
};

export const getReceiptsContext = cache(
  async (): Promise<ReceiptsAccess | null> => {
    const viewer = await getViewer();
    if (!viewer) return null;

    const orgId = viewer.ownedOrgIds[0] ?? null;
    if (!orgId) return null;

    const supabase = await createClient();

    // La RLS filtre déjà : cette requête ne rend que ce qui est accessible, et
    // ne rend rien du tout à qui n'est pas owner de l'organisation.
    const { data } = await supabase
      .from("receipt_sources")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at");

    return {
      orgId,
      canDecide: viewer.isOwner,
      sources: (data ?? []) as unknown as ReceiptSource[],
    };
  },
);

/** Exige l'accès. Renvoie un 404 sinon — jamais un 403. */
export async function requireReceiptsAccess(): Promise<ReceiptsAccess> {
  const context = await getReceiptsContext();
  if (!context) notFound();
  return context;
}
