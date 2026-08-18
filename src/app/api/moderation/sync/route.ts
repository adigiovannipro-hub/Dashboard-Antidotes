import { NextResponse } from "next/server";

import { getViewer } from "@/lib/auth";
import { missingServerEnv } from "@/lib/env";
import { syncModerationInbox } from "@/lib/moderation/sync";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * La synchronisation à la demande — le bouton « Synchroniser » de l'inbox.
 *
 * Le passage horaire fait le fond ; ce bouton couvre le « un client vient de
 * commenter, je veux le voir maintenant ». Module interne réservé au
 * propriétaire : pour tout autre, la route n'existe pas (404, jamais 403).
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  // Le contrôle d'accès d'abord, avant tout travail.
  const viewer = await getViewer();
  if (!viewer?.isOwner) {
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
  const reports = await syncModerationInbox({ admin });

  const errors = reports.filter((report) => report.error);
  return NextResponse.json({
    ok: errors.length === 0,
    reports,
    note:
      reports.length === 0
        ? "Aucun compte Instagram ou Page affecté — à faire depuis Connexions, sur le Planning d'un espace."
        : undefined,
  });
}
