import "server-only";

import { publicEnv } from "@/lib/env";
import { displayName } from "@/lib/profil/identity";
import { sendMessage } from "@/lib/recus/gmail";
import { createAdminClient } from "@/lib/supabase/server";

import { getGmailTransport } from "./notify";
import { buildApprovalMime } from "./notify-mime";
import { FORMAT_LABELS, type PlanningFormat } from "./types";

/**
 * Prévient l'agence qu'un client vient de valider des publications.
 *
 * Appelé en arrière-plan (`after()`) par les actions du planning, quand
 * quelqu'un qui n'est pas owner passe une ligne à `validated` : rien ici ne
 * retarde ni ne fait échouer la validation elle-même. Un courriel par
 * publication, à chaque owner de l'organisation de l'espace, depuis la boîte
 * Gmail des Reçus — le transport de tout courriel sortant du produit.
 *
 * Client admin : il faut lire les adresses des owners et la fiche de qui a
 * validé, hors de portée de la session d'un client. Le statut est relu ici et
 * non transmis : seule une ligne **encore** validée au moment de l'envoi part.
 */
export async function notifyApprovals(input: {
  subjectIds: string[];
  approverId: string;
  /** Test par la vraie chaîne : ces adresses **à la place** des owners. */
  recipientsOverride?: string[];
}): Promise<{ sent: number; reason?: string }> {
  if (input.subjectIds.length === 0) return { sent: 0 };
  const admin = createAdminClient();

  const { data: subjectRows, error } = await admin
    .from("planning_subjects")
    .select("id, name, format, scheduled_on, wording, lane_id, board_id, workspace_id")
    .in("id", input.subjectIds)
    .eq("status", "validated")
    .is("deleted_at", null);
  if (error) return { sent: 0, reason: error.message };
  const subjects = (subjectRows ?? []) as unknown as {
    id: string;
    name: string;
    format: string;
    scheduled_on: string | null;
    wording: string | null;
    lane_id: string;
    board_id: string;
    workspace_id: string;
  }[];
  if (subjects.length === 0) return { sent: 0 };

  const unique = (values: string[]) => [...new Set(values)];
  const [lanes, boards, workspaces, approver] = await Promise.all([
    admin.from("planning_lanes").select("id, name").in("id", unique(subjects.map((s) => s.lane_id))),
    admin.from("planning_boards").select("id, slug").in("id", unique(subjects.map((s) => s.board_id))),
    admin
      .from("workspaces")
      .select("id, name, slug, org_id")
      .in("id", unique(subjects.map((s) => s.workspace_id))),
    admin
      .from("profiles")
      .select("email, full_name, first_name, last_name")
      .eq("id", input.approverId)
      .maybeSingle(),
  ]);
  const laneName = new Map(((lanes.data ?? []) as { id: string; name: string }[]).map((l) => [l.id, l.name]));
  const boardSlug = new Map(((boards.data ?? []) as { id: string; slug: string }[]).map((b) => [b.id, b.slug]));
  const workspaceById = new Map(
    ((workspaces.data ?? []) as { id: string; name: string; slug: string; org_id: string }[]).map((w) => [w.id, w]),
  );

  const orgIds = unique([...workspaceById.values()].map((w) => w.org_id));
  const { data: ownerRows } = await admin
    .from("organization_members")
    .select("org_id, user_id")
    .in("org_id", orgIds)
    .eq("role", "owner");
  const owners = (ownerRows ?? []) as { org_id: string; user_id: string }[];
  const { data: ownerProfiles } = owners.length
    ? await admin.from("profiles").select("id, email").in("id", unique(owners.map((o) => o.user_id)))
    : { data: [] };
  const emailById = new Map(((ownerProfiles ?? []) as { id: string; email: string }[]).map((p) => [p.id, p.email]));

  const gmail = await getGmailTransport();
  if (!gmail.ok) return { sent: 0, reason: gmail.reason };
  const { accessToken, from } = gmail.transport;
  const approverName = displayName(approver.data as Parameters<typeof displayName>[0]);

  let sent = 0;
  let lastError: string | undefined;
  for (const subject of subjects) {
    const workspace = workspaceById.get(subject.workspace_id);
    if (!workspace) continue;
    const recipients = input.recipientsOverride ?? unique(
      owners
        .filter((owner) => owner.org_id === workspace.org_id)
        .map((owner) => emailById.get(owner.user_id))
        .filter((email): email is string => !!email),
    );
    for (const to of recipients) {
      try {
        await sendMessage({
          accessToken,
          mime: buildApprovalMime({
            from,
            to,
            workspaceName: workspace.name,
            subjectName: subject.name,
            laneName: laneName.get(subject.lane_id) ?? "",
            formatLabel: FORMAT_LABELS[subject.format as PlanningFormat] ?? subject.format,
            dateLabel: subject.scheduled_on ? formatDay(subject.scheduled_on) : null,
            approverName,
            wording: subject.wording,
            link: `${publicEnv.NEXT_PUBLIC_SITE_URL}/espace/${workspace.slug}/planning/${boardSlug.get(subject.board_id) ?? ""}?sujet=${subject.id}`,
          }),
        });
        sent += 1;
      } catch (cause) {
        lastError = (cause as Error).message;
      }
    }
  }

  if (lastError) console.error(`Validation client : courriel non parti (${lastError})`);
  return { sent, reason: lastError };
}

/** « jeudi 15 octobre 2026 » — jour métier, donc lu en UTC. */
function formatDay(day: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}
