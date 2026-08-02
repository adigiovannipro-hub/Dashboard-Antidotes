import "server-only";

import { cache } from "react";
import { notFound, redirect } from "next/navigation";

import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PlanningAccess } from "./permissions";
import { NO_ACCESS } from "./permissions";
import type { PlanningClient, PlanningRole } from "./types";

/**
 * Résolution de l'accès au module Planning Édito.
 *
 * Même posture que la Modération : le module est interne, et les routes
 * renvoient un 404 plutôt qu'un 403 pour qui n'y a pas accès. Un 403 confirmerait
 * son existence à un client du dashboard de reporting.
 */

export type PlanningContext = {
  access: PlanningAccess;
  clients: PlanningClient[];
};

export const getPlanningContext = cache(async (): Promise<PlanningContext> => {
  const viewer = await getViewer();
  if (!viewer) return { access: NO_ACCESS, clients: [] };

  const supabase = await createClient();

  // La RLS filtre déjà : cette requête ne rend que les clients accessibles.
  const [{ data: clients }, { data: memberships }] = await Promise.all([
    supabase
      .from("planning_clients")
      .select("*")
      .is("archived_at", null)
      .order("name"),
    supabase.from("planning_members").select("client_id, role"),
  ]);

  const list = (clients ?? []) as unknown as PlanningClient[];
  if (list.length === 0) return { access: NO_ACCESS, clients: [] };

  const membershipRows = (memberships ?? []) as unknown as {
    client_id: string;
    role: "editor" | "viewer";
  }[];

  const role: PlanningRole = viewer.isOwner
    ? "owner"
    : membershipRows.some((row) => row.role === "editor")
      ? "editor"
      : "viewer";

  return {
    access: { role, clientIds: list.map((client) => client.id) },
    clients: list,
  };
});

/** Exige l'accès au module. 404 plutôt que 403 — voir plus haut. */
export async function requirePlanning(): Promise<PlanningContext> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const context = await getPlanningContext();
  if (context.clients.length === 0) notFound();
  return context;
}

export async function requirePlanningClient(slug: string): Promise<{
  context: PlanningContext;
  client: PlanningClient;
}> {
  const context = await requirePlanning();
  const client = context.clients.find((candidate) => candidate.slug === slug);
  if (!client) notFound();
  return { context, client };
}
