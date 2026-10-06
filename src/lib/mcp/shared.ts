import "server-only";

import { parisStamp } from "@/lib/publishing/readiness";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Ce que partagent les outils du connecteur.
 *
 * Client `service_role` : un appel MCP n'a pas de session, et l'accès est déjà
 * tranché par la route (clé secrète dans l'adresse, 404 sinon). Le connecteur
 * est donc celui de l'owner, et de lui seul : chaque `where` de tenant est
 * écrit en toutes lettres, la RLS ne filtrant rien pour ce client.
 */

export type Admin = ReturnType<typeof createAdminClient>;

export type Workspace = { id: string; slug: string; name: string; org_id: string };

export function admin(): Admin {
  return createAdminClient();
}

/** Les lignes d'une réponse postgrest, ou l'erreur en français. */
export function rows<T>(
  result: { data: unknown; error: { message: string } | null },
  what: string,
): T[] {
  if (result.error) throw new Error(`${what} : ${result.error.message}`);
  return (result.data ?? []) as T[];
}

export function todayParis(): string {
  return parisStamp(new Date()).date;
}

/** L'owner de l'agence : l'organisation et la personne au nom de qui on écrit. */
export async function ownerContext(client: Admin): Promise<{ orgId: string; userId: string }> {
  const members = rows<{ org_id: string; user_id: string }>(
    await client
      .from("organization_members")
      .select("org_id, user_id")
      .eq("role", "owner")
      .order("created_at")
      .limit(1),
    "Lecture de l'owner",
  );
  const owner = members[0];
  if (!owner) throw new Error("Aucun owner d'organisation en base.");
  return { orgId: owner.org_id, userId: owner.user_id };
}

export async function listWorkspaces(client: Admin): Promise<Workspace[]> {
  return rows<Workspace>(
    await client.from("workspaces").select("id, slug, name, org_id").order("name"),
    "Lecture des espaces",
  );
}

export async function findWorkspace(client: Admin, key: unknown): Promise<Workspace> {
  const wanted = String(key ?? "").trim().toLowerCase();
  const all = await listWorkspaces(client);
  const found = all.find(
    (workspace) => workspace.slug === wanted || workspace.name.toLowerCase() === wanted,
  );
  if (!found) {
    throw new Error(
      `Client « ${String(key)} » introuvable. Clients : ${all.map((w) => w.slug).join(", ")}.`,
    );
  }
  return found;
}

/** Un client facultatif : absent ou vide, tous les clients. */
export async function optionalWorkspace(client: Admin, key: unknown): Promise<Workspace | null> {
  return String(key ?? "").trim() ? findWorkspace(client, key) : null;
}

export async function findMonth(
  client: Admin,
  workspaceId: string,
  month: string,
): Promise<{ boardId: string; monthId: string } | null> {
  const boards = rows<{ id: string }>(
    await client
      .from("planning_boards")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("kind", "editorial")
      .eq("year", Number(month.slice(0, 4))),
    "Lecture du planning",
  );
  const board = boards[0];
  if (!board) return null;
  const months = rows<{ id: string }>(
    await client
      .from("planning_months")
      .select("id")
      .eq("board_id", board.id)
      .eq("month", month)
      .is("deleted_at", null),
    "Lecture du mois",
  );
  return months[0] ? { boardId: board.id, monthId: months[0].id } : null;
}

/** Les clients de modération rattachés à un espace. */
export async function moderationClientIds(client: Admin, workspaceId: string): Promise<string[]> {
  return rows<{ id: string }>(
    await client.from("moderation_clients").select("id").eq("workspace_id", workspaceId),
    "Lecture du client de modération",
  ).map((row) => row.id);
}

/**
 * Trace au journal d'une publication, comme le font les actions de
 * l'application — un client relit ce journal sur son planning. En tolérance
 * d'échec : perdre une ligne de journal ne défait pas l'écriture qu'elle décrit.
 */
export async function logPlanning(
  client: Admin,
  input: {
    workspaceId: string;
    actorId: string;
    entries: { subjectId: string; field: string; before?: unknown; after?: unknown }[];
  },
): Promise<void> {
  if (input.entries.length === 0) return;
  const asText = (value: unknown): string | null =>
    value === null || value === undefined || value === "" ? null : String(value);
  try {
    await Promise.all([
      client.from("planning_activity").insert(
        input.entries.map((entry) => ({
          subject_id: entry.subjectId,
          workspace_id: input.workspaceId,
          actor_id: input.actorId,
          field: entry.field,
          before: asText(entry.before),
          after: asText(entry.after),
        })) as never,
      ),
      client
        .from("planning_subjects")
        .update({ updated_by: input.actorId } as never)
        .in("id", [...new Set(input.entries.map((entry) => entry.subjectId))]),
    ]);
  } catch {
    // Le journal est un témoin, pas un verrou.
  }
}

export const clientArg = {
  type: "string",
  description: "Identifiant du client (slug, ex. « anmf ») ou son nom. lister_clients les donne.",
};
export const optionalClientArg = {
  type: "string",
  description: "Identifiant du client (slug) ou son nom. Absent : tous les clients.",
};
export const monthArg = { type: "string", description: "Mois au format AAAA-MM, ex. 2026-11." };

export function text(value: unknown): string {
  return String(value ?? "").trim();
}
