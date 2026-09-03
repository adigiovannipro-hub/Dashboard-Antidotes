import "server-only";

import { cache } from "react";
import { notFound, redirect } from "next/navigation";

import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ModerationAccess } from "./permissions";
import { NO_ACCESS } from "./permissions";
import type { ModerationClient, ModerationRole } from "./types";

/**
 * Résolution de l'accès au module Modération.
 *
 * Le module est interne : il n'apparaît nulle part pour qui n'a aucun client
 * rattaché, et les routes renvoient un 404 plutôt qu'un 403. Un client du
 * dashboard de reporting ne doit pas pouvoir déduire de l'existence d'un 403
 * que le module existe.
 */

export type ModerationContext = {
  access: ModerationAccess;
  clients: ModerationClient[];
};

export const getModerationContext = cache(async (): Promise<ModerationContext> => {
  const viewer = await getViewer();
  if (!viewer) return { access: NO_ACCESS, clients: [] };

  const supabase = await createClient();

  /* Les filtres sont explicites et non délégués à la RLS. Elle suffirait si
     elle s'appliquait toujours — mais en accès ouvert les lectures passent en
     `service_role`, et « la RLS filtre déjà » devient faux : la liste
     revenait complète, si bien qu'une élève de l'Academy ou un client
     d'espace atteignait la Modération. */
  const [{ data: clients }, { data: memberships }] = await Promise.all([
    supabase.from("moderation_clients").select("*").order("name"),
    supabase
      .from("moderation_members")
      .select("client_id, role, requires_approval")
      .eq("user_id", viewer.user.id),
  ]);

  const membershipRowsBrutes = (memberships ?? []) as unknown as {
    client_id: string;
    role: "operator" | "viewer";
    requires_approval: boolean;
  }[];

  /* Deux chemins ouvrent un client de modération, et un seul suffit :
     une adhésion nominative (`moderation_members`), ou le rattachement du
     client à un espace où la personne est **contributrice** (0041). L'owner
     voit tout.

     Le rôle compte : un client d'espace atteint son planning, jamais la
     Modération — c'est un outil interne, et il ne doit pas même en apprendre
     l'existence. Retenir « tout espace atteint » l'y laissait entrer. */
  const espacesAtteints = new Set(
    viewer.workspaces
      .filter((workspace) => workspace.role === "contributor")
      .map((workspace) => workspace.id),
  );
  const clientsAdherents = new Set(membershipRowsBrutes.map((row) => row.client_id));

  const list = ((clients ?? []) as unknown as ModerationClient[]).filter(
    (client) =>
      viewer.isOwner ||
      clientsAdherents.has(client.id) ||
      (client.workspace_id !== null && espacesAtteints.has(client.workspace_id)),
  );
  if (list.length === 0) {
    // L'owner voit le module même vide : c'est lui qui branche les comptes
    // dans Connexions et lance la première synchronisation. Pour tout autre,
    // un module vide n'existe pas.
    return viewer.isOwner
      ? {
          access: { role: "owner", clientIds: [], requiresApprovalByClient: {} },
          clients: [],
        }
      : { access: NO_ACCESS, clients: [] };
  }

  const membershipRows = membershipRowsBrutes;

  // L'owner d'organisation prime : il voit tous les clients sans adhésion.
  // Un contributeur n'a pas de ligne dans `moderation_members` — c'est le
  // rattachement `moderation_clients.workspace_id` qui lui ouvre la boîte
  // (0041). Il y répond, donc il est opérateur.
  const contributor = viewer.workspaces.some(
    (workspace) => workspace.role === "contributor",
  );
  const role: ModerationRole = viewer.isOwner
    ? "owner"
    : membershipRows.some((row) => row.role === "operator") || contributor
      ? "operator"
      : "viewer";

  return {
    access: {
      role,
      clientIds: list.map((client) => client.id),
      requiresApprovalByClient: Object.fromEntries(
        membershipRows.map((row) => [row.client_id, row.requires_approval]),
      ),
    },
    clients: list,
  };
});

/** Exige l'accès au module. 404 plutôt que 403 — voir plus haut. */
export async function requireModeration(): Promise<ModerationContext> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const context = await getModerationContext();
  if (context.clients.length === 0 && context.access.role !== "owner") notFound();
  return context;
}

export async function requireModerationClient(slug: string): Promise<{
  context: ModerationContext;
  client: ModerationClient;
}> {
  const context = await requireModeration();
  const client = context.clients.find((candidate) => candidate.slug === slug);
  if (!client) notFound();
  return { context, client };
}
