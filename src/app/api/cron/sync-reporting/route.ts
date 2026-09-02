import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { syncWorkspaceWebAnalytics } from "@/lib/connectors/google-analytics/sync";
import { syncWorkspaceLinkedin } from "@/lib/connectors/linkedin/sync";
import { syncWorkspaceReporting } from "@/lib/connectors/meta/sync";
import { missingServerEnv, serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * La synchronisation quotidienne du Reporting — tous les espaces qui ont un
 * compte Meta affecté dans Connexions, puis toutes les propriétés Google
 * Analytics rattachées (l'onglet Site Web, via Composio).
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

  /* LinkedIn ensuite, sur ses propres affectations : un espace peut n'avoir
     que LinkedIn, et le lier à la boucle Meta l'aurait laissé de côté. */
  const { data: linkedinLinks, error: linkedinError } = await admin
    .from("workspace_social_accounts")
    .select("workspace_id")
    .eq("kind", "linkedin");
  if (linkedinError) {
    errors.push(`Lecture des affectations LinkedIn : ${linkedinError.message}`);
  }

  const linkedinWorkspaceIds = [
    ...new Set(
      ((linkedinLinks ?? []) as { workspace_id: string }[]).map(
        (link) => link.workspace_id,
      ),
    ),
  ];

  for (const workspaceId of linkedinWorkspaceIds) {
    try {
      const source = await syncWorkspaceLinkedin({ admin, workspaceId });
      if (source) {
        report[`linkedin:${workspaceId}`] = source;
        if (source.error) errors.push(`${source.account} : ${source.error}`);
      }
    } catch (error) {
      errors.push(
        `linkedin ${workspaceId} : ${error instanceof Error ? error.message : "erreur"}`,
      );
    }
  }

  /* Le Site Web ensuite : les espaces qui ont une propriété GA rattachée.
     Même règle que pour Meta — l'`error` de la requête est testé, une table
     absente ne doit jamais ressembler à « rien à faire ». */
  const { data: webSources, error: webSourcesError } = await admin
    .from("data_sources")
    .select("workspace_id")
    .eq("provider", "google_analytics");
  if (webSourcesError) {
    errors.push(`Lecture des propriétés GA : ${webSourcesError.message}`);
  }

  const webWorkspaceIds = [
    ...new Set(
      ((webSources ?? []) as { workspace_id: string }[]).map(
        (source) => source.workspace_id,
      ),
    ),
  ];

  for (const workspaceId of webWorkspaceIds) {
    try {
      const sources = await syncWorkspaceWebAnalytics({ admin, workspaceId });
      report[`web:${workspaceId}`] = sources;
      for (const source of sources) {
        if (source.error) {
          errors.push(`${source.property} : ${source.error}`);
        }
      }
    } catch (error) {
      errors.push(
        `site web ${workspaceId} : ${error instanceof Error ? error.message : "erreur"}`,
      );
    }
  }

  if (
    workspaceIds.length === 0 &&
    linkedinWorkspaceIds.length === 0 &&
    webWorkspaceIds.length === 0
  ) {
    return NextResponse.json({
      ok: true,
      note: "Aucun compte Meta ni LinkedIn affecté, aucune propriété GA rattachée.",
    });
  }

  /* 200 même en échec partiel : un 500 ferait rejouer par l'ordonnanceur ce
     qui a déjà réussi. Les erreurs sont dans le corps, et dans
     `data_sources.last_error` pour l'écran. */
  return NextResponse.json({ ok: errors.length === 0, report, errors });
}
