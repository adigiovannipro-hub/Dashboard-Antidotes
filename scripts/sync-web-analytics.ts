/**
 * Synchronisation Google Analytics à la main — l'équivalent en terminal du
 * bouton « Synchroniser » de l'onglet Site Web.
 *
 *   pnpm sync:web                     fenêtre normale (8 jours glissants,
 *                                     ou tout l'historique au premier passage)
 *   pnpm sync:web --depuis 2024-02-01 force la borne basse (rattrapage)
 *
 * Toutes les propriétés rattachées, tous espaces confondus. Le gros du temps
 * la collecte passe par le cron Vercel quotidien ; ce script sert au premier
 * rattrapage et aux reprises.
 *
 * Comme les autres synchronisations, `server-only` est neutralisé par la
 * condition `react-server` de Node — nous *sommes* le serveur.
 *
 * Variables requises : NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY, COMPOSIO_API_KEY.
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "COMPOSIO_API_KEY",
] as const;

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : undefined;
}

async function main() {
  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    console.error(`Variables absentes : ${missing.join(", ")}.`);
    process.exit(1);
  }

  const atLeastSince = argValue("depuis");
  if (atLeastSince && !/^\d{4}-\d{2}-\d{2}$/.test(atLeastSince)) {
    console.error(`--depuis doit être une date AAAA-MM-JJ, reçu « ${atLeastSince} ».`);
    process.exit(1);
  }

  const { createAdminClient } = await import("../src/lib/supabase/server");
  const { syncWorkspaceWebAnalytics } = await import(
    "../src/lib/connectors/google-analytics/sync"
  );

  const admin = createAdminClient();
  const { data: sources, error } = await admin
    .from("data_sources")
    .select("workspace_id")
    .eq("provider", "google_analytics");
  if (error) {
    console.error(`Lecture des propriétés GA : ${error.message}`);
    process.exit(1);
  }

  const workspaceIds = [
    ...new Set(
      ((sources ?? []) as { workspace_id: string }[]).map((row) => row.workspace_id),
    ),
  ];
  if (workspaceIds.length === 0) {
    console.log("Aucune propriété Google Analytics rattachée : rien à collecter.");
    return;
  }

  let failed = false;
  for (const workspaceId of workspaceIds) {
    const reports = await syncWorkspaceWebAnalytics({
      admin,
      workspaceId,
      atLeastSince,
    });
    for (const report of reports) {
      if (report.error) {
        failed = true;
        console.error(`  ✗ ${report.property} — ${report.error}`);
      } else {
        console.log(`  ✓ ${report.property} — ${report.rows} lignes`);
      }
    }
  }

  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
