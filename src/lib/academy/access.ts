import "server-only";

import { cache } from "react";
import { notFound } from "next/navigation";

import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Résolution de l'accès à l'Academy.
 *
 * Contrairement à Finance — owner seul — l'Academy s'ouvre à tout **membre de
 * l'organisation** : c'est une formation d'équipe, pas la comptabilité. Un
 * client d'espace n'a aucune ligne dans `organization_members` : pour lui le
 * module n'existe pas, et les routes répondent 404, jamais 403.
 *
 * Deux niveaux : suivre la formation (lire le publié, écrire sa progression
 * et ses notes), et administrer (écrire le contenu) — réservé à l'owner. La
 * RLS de la migration 0057 applique la même frontière côté base ; ceci ne
 * fait que l'exprimer côté écran.
 */

export type AcademyAccess = {
  orgId: string;
  userId: string;
  /** Peut créer, éditer, publier, téléverser — le back-office. */
  isAdmin: boolean;
};

export const getAcademyContext = cache(
  async (): Promise<AcademyAccess | null> => {
    const viewer = await getViewer();
    if (!viewer) return null;

    if (viewer.isOwner && viewer.ownedOrgIds.length > 0) {
      return { orgId: viewer.ownedOrgIds[0]!, userId: viewer.user.id, isAdmin: true };
    }

    // Membre non-owner : la RLS ne rend que ses propres lignes, mais le filtre
    // explicite garde la requête juste même en accès ouvert (client service).
    const supabase = await createClient();
    const { data } = await supabase
      .from("organization_members")
      .select("org_id")
      .eq("user_id", viewer.user.id)
      .limit(1)
      .maybeSingle();

    if (!data) return null;
    return { orgId: data.org_id, userId: viewer.user.id, isAdmin: false };
  },
);

/** Exige l'accès au module. Renvoie un 404 sinon — jamais un 403. */
export async function requireAcademyAccess(): Promise<AcademyAccess> {
  const context = await getAcademyContext();
  if (!context) notFound();
  return context;
}

/** Exige le back-office. 404 pour un membre comme pour un client. */
export async function requireAcademyAdmin(): Promise<AcademyAccess> {
  const context = await requireAcademyAccess();
  if (!context.isAdmin) notFound();
  return context;
}
