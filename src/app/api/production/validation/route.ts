import { NextResponse } from "next/server";
import { z } from "zod";

import { getWorkspace } from "@/lib/auth";
import { sendPlanningValidation } from "@/lib/production/validation";

/**
 * « Envoyer en validation » depuis la carte cockpit.
 *
 * Réservé au propriétaire — c'est l'agence qui prévient son client, jamais
 * l'inverse — et 404 pour tout autre : la carte n'existe que sur l'accueil
 * de l'agence.
 */

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  workspace: z.string().min(1),
  target_month: z.string().regex(/^\d{4}-\d{2}-01$/),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }

  // Le contrôle d'accès d'abord, avant tout travail.
  const workspace = await getWorkspace(parsed.data.workspace);
  if (!workspace || workspace.role !== "owner") {
    return new NextResponse(null, { status: 404 });
  }

  const outcome = await sendPlanningValidation({
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
    workspaceName: workspace.name,
    orgId: workspace.org_id,
    targetMonth: parsed.data.target_month,
  });

  return NextResponse.json({
    ok: outcome.sent.length > 0,
    ...outcome,
  });
}
