/**
 * Collecte LinkedIn à la main — le rattrapage, quand on ne veut pas
 * attendre le cron.
 *
 *   pnpm sync:linkedin [--espace <slug>] [--depuis 2025-09-01]
 *
 * Sans `--espace`, tous les espaces qui ont une page LinkedIn affectée.
 * Étape du workflow « Base de données ».
 */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

import { syncWorkspaceLinkedin } from "../src/lib/connectors/linkedin/sync";
import type { Database } from "../src/lib/supabase/database.types";

dotenv.config({ path: ".env.local", quiet: true });

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.");
    process.exit(1);
  }

  const admin = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const slug = argValue("espace");
  const atLeastSince = argValue("depuis");

  const { data: links, error } = await admin
    .from("workspace_social_accounts")
    .select("workspace_id")
    .eq("kind", "linkedin");
  if (error) {
    console.error(`Lecture des affectations : ${error.message}`);
    process.exit(1);
  }

  let ids = [
    ...new Set(((links ?? []) as { workspace_id: string }[]).map((l) => l.workspace_id)),
  ];

  if (slug) {
    const { data: workspace } = await admin
      .from("workspaces")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    const id = (workspace as { id?: string } | null)?.id;
    if (!id) {
      console.error(`Espace « ${slug} » introuvable.`);
      process.exit(1);
    }
    ids = ids.filter((candidate) => candidate === id);
    if (ids.length === 0) {
      console.error(`Aucune page LinkedIn affectée à « ${slug} ».`);
      process.exit(1);
    }
  }

  if (ids.length === 0) {
    console.log("Aucun espace n'a de page LinkedIn affectée — rien à collecter.");
    return;
  }

  console.log(`${ids.length} espace(s) à collecter.`);
  let echecs = 0;

  for (const workspaceId of ids) {
    const report = await syncWorkspaceLinkedin({ admin, workspaceId, atLeastSince });
    if (!report) continue;
    if (report.error) {
      echecs += 1;
      console.log(`  ✗ ${report.account} — ${report.error}`);
    } else {
      console.log(
        `  ✓ ${report.account} — ${report.rows} ligne(s)${report.warning ? ` — ${report.warning}` : ""}`,
      );
    }
  }

  /* Un échec doit faire rougir le job : un passage qui n'a rien collecté et
     finit vert, c'est une perte silencieuse — la leçon de l'import des
     abonnés, qui avait jeté les trois quarts des données sans broncher. */
  if (echecs > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
