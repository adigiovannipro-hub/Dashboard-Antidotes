import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { syncWorkspaceReporting } from "@/lib/connectors/meta/sync";
import { missingServerEnv, serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * La synchronisation quotidienne du Reporting — tous les espaces qui ont un
 * compte Meta affecté dans Connexions.
 *
 * Une fois par jour suffit : les chiffres publicitaires de la veille ne
 * bougent plus assez vite pour mériter mieux, et le bouton « Synchroniser »
 * de la page couvre l'impatience. Contrairement à Airwallex, Meta accepte les
 * adresses IP de Vercel : ce cron tourne donc chez Vercel, dans le deuxième
 * et dernier créneau du plan Hobby.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request): boolean {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;

  const provided = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(serverEnv("CRON_SECRET").CRON_SECRET);

  // Comparaison à temps constant : un `===` fuiterait, par sa durée, combien
  // de caractères de tête sont corrects.
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

export async function GET(request: Request) {
  const missing = missingServerEnv(
    "CRON_SECRET",
    "SUPABASE_SERVICE_ROLE_KEY",
    "CREDENTIALS_ENCRYPTION_KEY",
  );
  if (missing.length > 0) {
    return NextResponse.json(
      { ok: false, error: `Variables absentes : ${missing.join(", ")}.` },
      { status: 500 },
    );
  }

  if (!authorized(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: links, error: linksError } = await admin
    .from("workspace_social_accounts")
    .select("workspace_id")
    .in("kind", ["meta_ad_account", "instagram", "facebook_page"]);

  /* Sans ce test, une table absente donnerait un `data` nul, donc une liste
     vide, donc un « aucun espace à synchroniser » parfaitement rassurant — et
     un cron muet pendant des semaines. */
  if (linksError) {
    return NextResponse.json(
      {
        ok: false,
        error: `Lecture des affectations impossible : ${linksError.message}. Les migrations 0043-0044 sont-elles appliquées ?`,
      },
      { status: 500 },
    );
  }

  const workspaceIds = [
    ...new Set(
      ((links ?? []) as { workspace_id: string }[]).map((link) => link.workspace_id),
    ),
  ];

  if (workspaceIds.length === 0) {
    return NextResponse.json({ ok: true, note: "Aucun compte Meta affecté." });
  }

  const report: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const workspaceId of workspaceIds) {
    try {
      const sources = await syncWorkspaceReporting({ admin, workspaceId });
      report[workspaceId] = sources;
      for (const source of sources) {
        if (source.error) {
          errors.push(`${source.account} : ${source.error}`);
        }
      }
    } catch (error) {
      errors.push(
        `espace ${workspaceId} : ${error instanceof Error ? error.message : "erreur"}`,
      );
    }
  }

  /* 200 même en échec partiel : un 500 ferait rejouer par l'ordonnanceur ce
     qui a déjà réussi. Les erreurs sont dans le corps, et dans
     `data_sources.last_error` pour l'écran. */
  return NextResponse.json({ ok: errors.length === 0, report, errors });
}
