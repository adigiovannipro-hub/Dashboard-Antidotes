/**
 * L'essai de publication : un sujet du planning, publié **par le code du
 * produit** sur les comptes d'un espace de test — jamais sur ceux du client.
 *
 *   pnpm publier:essai --sujet <uuid> --espace <slug-de-test>
 *   pnpm publier:essai --sujet <uuid> --espace <slug-de-test> --reseau linkedin
 *
 * C'est la preuve par la vraie chaîne qu'exige tout ce qui part vers un
 * client : mêmes fichiers, même conversion, même transport que le passage de
 * 16h. Rien n'est écrit au planning — ni verrou, ni statut, ni journal.
 * TikTok part en brouillon dans l'application du compte de test.
 *
 * Étape « Essai de publication » de « Sondes et diagnostics ».
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CREDENTIALS_ENCRYPTION_KEY",
] as const;

function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

async function main() {
  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    console.error(`Variables absentes : ${missing.join(", ")}.`);
    process.exit(1);
  }

  const subjectId = arg("sujet");
  const slug = arg("espace");
  const reseau = arg("reseau");
  if (!subjectId || !slug) {
    console.error("Usage : pnpm publier:essai --sujet <uuid> --espace <slug-de-test> [--reseau instagram|facebook|tiktok|linkedin]");
    process.exit(1);
  }

  const { createAdminClient } = await import("../src/lib/supabase/server");
  const { publishTrial } = await import("../src/lib/publishing/run");
  const { PUBLISH_TARGET_LABELS } = await import("../src/lib/publishing/readiness");
  const admin = createAdminClient();

  const { data: workspace, error } = await admin
    .from("workspaces")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Espace de test : ${error.message}`);
  if (!workspace) throw new Error(`Aucun espace « ${slug} ».`);
  const test = workspace as { id: string; name: string };

  const { data: subject } = await admin
    .from("planning_subjects")
    .select("workspace_id")
    .eq("id", subjectId)
    .maybeSingle();
  if ((subject as { workspace_id?: string } | null)?.workspace_id === test.id) {
    // Le garde-fou de l'essai : il publie sur les comptes de l'espace donné,
    // et l'espace d'un sujet client a les comptes du client.
    console.log("⚠ L'espace d'essai est celui du sujet : l'essai part sur les comptes de ce client.");
  }

  const targets = reseau
    ? [reseau as keyof typeof PUBLISH_TARGET_LABELS]
    : undefined;
  if (targets && !(targets[0]! in PUBLISH_TARGET_LABELS)) {
    throw new Error(`Réseau inconnu : ${reseau}.`);
  }

  console.log(`Essai du sujet ${subjectId} sur les comptes de ${test.name}…`);
  const results = await publishTrial({
    admin,
    subjectId,
    testWorkspaceId: test.id,
    targets,
  });

  let failed = false;
  for (const result of results) {
    const label = PUBLISH_TARGET_LABELS[result.target];
    if (result.error) {
      failed = true;
      console.error(`  ✗ ${label} — ${result.error}`);
    } else if (result.outcome?.status === "awaiting") {
      console.log(`  ◌ ${label} — brouillon envoyé (${result.outcome.externalId}), à publier depuis l'application`);
    } else if (result.outcome) {
      console.log(`  ✓ ${label} — ${result.outcome.permalink ?? result.outcome.externalId}`);
    }
  }
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
