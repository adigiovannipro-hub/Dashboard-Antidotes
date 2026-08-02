/**
 * Synchronisation des plannings éditoriaux depuis Monday.com.
 *
 *   pnpm sync:planning              synchronise tous les clients
 *   pnpm sync:planning --discover   recense d'abord les boards « CLIENT I PE ANNÉE »
 *   pnpm sync:planning --archives   inclut les boards d'archive
 *   pnpm sync:planning --client=<slug>
 *
 * Le job est idempotent : il peut se rejouer sans créer de doublon, les
 * identifiants Monday servant de clés de conflit.
 */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

import { MondayConnector } from "../src/lib/planning/connectors/monday";
import { discoverBoards, pullClient } from "../src/lib/planning/sync";
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

  if (!url || !serviceKey) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis dans .env.local.",
    );
    process.exit(1);
  }
  if (!token) {
    console.error(
      "MONDAY_API_TOKEN absent de .env.local.\n" +
        "Le créer depuis Monday : avatar → Développeurs → Mes jetons d'accès.",
    );
    process.exit(1);
  }

  // Le job écrit la structure : il lui faut la clé `service_role`, qui
  // contourne la RLS. C'est l'un des trois usages prévus pour elle.
  const admin = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const connector = new MondayConnector(token);

  if (flag("discover")) {
    const { data: orgs } = await admin
      .from("organizations")
      .select("id")
      .eq("slug", "antidotes")
      .maybeSingle();

    if (!orgs) throw new Error("Organisation « antidotes » introuvable.");

    const found = await discoverBoards({
      admin,
      connector,
      orgId: orgs.id,
    });
    console.log(
      `Découverte : ${found.clients} client(s) créé(s), ${found.boards} board(s) rattaché(s).`,
    );
  }

  const slug = option("client");
  let query = admin.from("planning_clients").select("id, slug, name");
  if (slug) query = query.eq("slug", slug);

  const { data: clients } = await query;

  if (!clients || clients.length === 0) {
    console.log(
      slug
        ? `Aucun client « ${slug} ». Lancer --discover d'abord ?`
        : "Aucun client. Lancer --discover d'abord ?",
    );
    return;
  }

  for (const client of clients) {
    process.stdout.write(`${client.name.padEnd(24)} `);
    try {
      const report = await pullClient({
        admin,
        connector,
        clientId: client.id,
        includeArchives: flag("archives"),
      });
      console.log(
        `${report.boardsSeen} board(s), ${report.monthsUpserted} mois, ` +
          `${report.subjectsUpserted} contenus`,
      );
    } catch (error) {
      console.log(`échec — ${(error as Error).message}`);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
