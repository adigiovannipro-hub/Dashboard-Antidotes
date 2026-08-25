/**
 * Rattache une propriété Google Analytics à un espace client — le geste qui
 * ouvre l'onglet Site Web de son Reporting.
 *
 *   pnpm connect:web --workspace anmf --property properties/428494328 \
 *     --name "ANMF — Site web" --depuis 2024-02-01
 *
 * La propriété devient une ligne de `data_sources` (provider
 * `google_analytics`), upsertée sur la clé d'unicité de 0001 : rejouer ne
 * duplique rien. `--depuis` pose `backfill_from`, la borne du rattrapage
 * initial du connecteur ; sans elle, il remonte à 2023.
 *
 * Aucun jeton ici : l'authentification vit chez Composio, ce rattachement ne
 * fait que dire « cet espace lit cette propriété ».
 *
 * Variables requises : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local", quiet: true });

function argValue(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : null;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "Variables absentes : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY — les renseigner dans .env.local.",
    );
    process.exit(1);
  }

  const workspaceSlug = argValue("workspace");
  const property = argValue("property");
  if (!workspaceSlug || !property || !/^properties\/\d+$/.test(property)) {
    console.error(
      "Usage : pnpm connect:web --workspace <slug> --property properties/<id> [--name <libellé>] [--depuis AAAA-MM-JJ]",
    );
    process.exit(1);
  }

  const depuis = argValue("depuis");
  if (depuis && !/^\d{4}-\d{2}-\d{2}$/.test(depuis)) {
    console.error(`--depuis doit être une date AAAA-MM-JJ, reçu « ${depuis} ».`);
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: workspace, error: workspaceError } = await admin
    .from("workspaces")
    .select("id, slug, name")
    .eq("slug", workspaceSlug)
    .maybeSingle();
  if (workspaceError) {
    console.error(`Lecture des espaces : ${workspaceError.message}`);
    process.exit(1);
  }
  if (!workspace) {
    const { data: known } = await admin.from("workspaces").select("slug");
    console.error(
      `Espace « ${workspaceSlug} » introuvable. Espaces connus : ${(known ?? [])
        .map((row) => (row as { slug: string }).slug)
        .join(", ")}.`,
    );
    process.exit(1);
  }

  const { data: source, error: sourceError } = await admin
    .from("data_sources")
    .upsert(
      {
        workspace_id: workspace.id,
        provider: "google_analytics",
        external_account_id: property,
        display_name: argValue("name") ?? `${workspace.name} — Site web`,
        status: "pending",
        ...(depuis ? { backfill_from: depuis } : {}),
      },
      { onConflict: "workspace_id,provider,external_account_id" },
    )
    .select("id, display_name, backfill_from")
    .single();
  if (sourceError) {
    console.error(`Rattachement impossible : ${sourceError.message}`);
    process.exit(1);
  }

  const attached = source as { id: string; display_name: string | null; backfill_from: string | null };
  console.log(
    `✓ ${attached.display_name} rattachée à « ${workspace.name} » (source ${attached.id}, rattrapage depuis ${attached.backfill_from ?? "2023-01-01"}).`,
  );
  console.log(
    "La collecte passe par le cron quotidien, le bouton Synchroniser du Reporting, ou pnpm sync:web.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
