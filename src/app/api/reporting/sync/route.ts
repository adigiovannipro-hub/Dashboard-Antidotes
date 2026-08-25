import { NextResponse } from "next/server";
import { z } from "zod";

import { getWorkspace } from "@/lib/auth";
import { syncWorkspaceWebAnalytics } from "@/lib/connectors/google-analytics/sync";
import { syncWorkspaceReporting } from "@/lib/connectors/meta/sync";
import { missingServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { COMPOSIO_TRANSITION_NOTE } from "@/lib/social/direct-connect";

/**
 * La synchronisation à la demande — le bouton « Synchroniser » du Reporting.
 *
 * Le cron quotidien fait le fond ; ce bouton couvre le « je viens de lancer
 * une campagne, je veux voir ». Réservé au propriétaire : un client lit les
 * chiffres, il ne pilote pas la collecte — et pour lui, la route n'existe
 * pas (404, jamais 403).
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({
  workspace: z.string().min(1),
  /** Borne basse de la plage affichée — étend la fenêtre de collecte. */
  du: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  // Le contrôle d'accès d'abord, avant tout travail.
  const workspace = await getWorkspace(parsed.data.workspace);
  if (!workspace || workspace.role !== "owner") {
    return new NextResponse(null, { status: 404 });
  }

  const missing = missingServerEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "CREDENTIALS_ENCRYPTION_KEY",
  );
  if (missing.length > 0) {
    return NextResponse.json(
      { ok: false, error: `Variables absentes : ${missing.join(", ")}.` },
      { status: 500 },
    );
  }

  // `createAdminClient` : la synchronisation écrit pour le compte du cron,
  // après une garde d'owner explicite.
  const admin = createAdminClient();
  const reports = await syncWorkspaceReporting({
    admin,
    workspaceId: workspace.id,
    atLeastSince: parsed.data.du,
  });
  // Le Site Web de l'espace, s'il a une propriété GA rattachée — le même
  // bouton couvre tous les onglets, personne ne synchronise « par réseau ».
  const webReports = await syncWorkspaceWebAnalytics({
    admin,
    workspaceId: workspace.id,
    atLeastSince: parsed.data.du,
  });

  const errors = [
    ...reports.filter((report) => report.error),
    ...webReports.filter((report) => report.error),
  ];
  return NextResponse.json({
    ok: errors.length === 0,
    reports: [...reports, ...webReports],
    note:
      reports.length === 0 && webReports.length === 0
        ? `Aucun compte Meta affecté à cet espace, aucune propriété GA rattachée. ${COMPOSIO_TRANSITION_NOTE}`
        : undefined,
  });
}
