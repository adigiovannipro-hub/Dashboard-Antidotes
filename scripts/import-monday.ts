/**
 * Reprise d'un planning éditorial depuis Monday.com.
 *
 *   pnpm import:monday --list
 *   pnpm import:monday --workspace=bondet --board=pe-2026 --monday=5094677213
 *
 * À lancer une fois par tableau, pour récupérer ce qui a déjà été saisi. Après
 * quoi le dashboard fait autorité : rien n'est jamais réécrit dans Monday.
 *
 * Rejouable sans créer de doublon — les identifiants Monday sont conservés, une
 * seconde passe met à jour.
 */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

import { MondayConnector } from "../src/lib/planning/connectors/monday";
import { importMondayBoard } from "../src/lib/planning/import";
import type { Database } from "../src/lib/supabase/database.types";

dotenv.config({ path: ".env.local", quiet: true });

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function option(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = process.env.MONDAY_API_TOKEN;

  if (!token) {
    console.error(
      "MONDAY_API_TOKEN absent de .env.local.\n" +
        "Le créer depuis Monday : avatar → Développeurs → Mes jetons d'accès.",
    );
    process.exit(1);
  }

  const connector = new MondayConnector(token);

  // `--list` sert à retrouver l'identifiant du board sans quitter le terminal.
  if (flag("list")) {
    const boards = await connector.listBoards(option("search") ?? "PE");
    for (const board of boards) {
      console.log(`${board.id.padEnd(12)} ${board.name}`);
    }
    return;
  }

  if (!url || !serviceKey) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis dans .env.local.",
    );
    process.exit(1);
  }

  const workspaceSlug = option("workspace");
  const boardSlug = option("board");
  const mondayBoardId = option("monday");

  if (!workspaceSlug || !boardSlug || !mondayBoardId) {
    console.error(
      "Usage : pnpm import:monday --workspace=<slug> --board=<slug> --monday=<id>\n" +
        "        pnpm import:monday --list",
    );
    process.exit(1);
  }

  // L'import écrit la structure : il lui faut la clé `service_role`, qui
  // contourne la RLS. C'est l'un des trois usages prévus pour elle.
  const admin = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: workspace } = await admin
    .from("workspaces")
    .select("id")
    .eq("slug", workspaceSlug)
    .maybeSingle();

  if (!workspace) throw new Error(`Espace « ${workspaceSlug} » introuvable.`);

  const { data: board } = await admin
    .from("planning_boards")
    .select("id, year")
    .eq("workspace_id", workspace.id)
    .eq("slug", boardSlug)
    .maybeSingle();

  if (!board) throw new Error(`Tableau « ${boardSlug} » introuvable dans cet espace.`);

  const report = await importMondayBoard({
    admin,
    connector,
    mondayBoardId,
    boardId: board.id,
    workspaceId: workspace.id,
    year: board.year ?? undefined,
  });

  console.log(`Mois          ${report.months}`);
  console.log(`Réseaux       ${report.lanes}`);
  console.log(`Publications  ${report.subjects}`);

  if (report.skippedGroups.length > 0) {
    console.log(
      `\nGroupes ignorés (pas des mois) : ${report.skippedGroups.join(", ")}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
