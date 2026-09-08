/**
 * Le relevé du radar inbound — depuis une machine GitHub.
 *
 *   pnpm radar:passage
 *
 * Pour chaque organisation qui veille des comptes : relève les derniers
 * posts de chaque compte actif par le connecteur de son réseau, range le
 * corpus, note abonnés, date et erreur sur le compte. Puis vectorise mes
 * posts qui n'ont pas encore de vecteur (`OPENAI_API_KEY`).
 *
 * `server-only` est neutralisé par la condition `react-server` de Node.
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

const REQUIRED = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;

async function main() {
  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    console.error(`Variables absentes : ${missing.join(", ")}.`);
    process.exit(1);
  }

  const { createAdminClient } = await import("../src/lib/supabase/server");
  const { assembleRadarProviders } = await import("../src/lib/antidotes/inbound/radar/assemble");
  const { collectRadar } = await import("../src/lib/antidotes/inbound/collect");
  const { createRadarStore, embedMissing, listRadarOrgIds } = await import("../src/lib/antidotes/inbound/store");
  const { embedderFromEnv } = await import("../src/lib/antidotes/inbound/embeddings");

  const admin = createAdminClient();
  const providers = await assembleRadarProviders(admin);
  const missingProviders = Object.entries(providers.missing);
  if (missingProviders.length > 0) {
    console.log(`Réseaux sans connecteur : ${missingProviders.map(([platform, why]) => `${platform} (${why})`).join(" · ")}.`);
  }

  const orgIds = await listRadarOrgIds(admin);
  if (orgIds.length === 0) console.log("Aucun compte veillé.");
  let failures = 0;
  for (const orgId of orgIds) {
    const report = await collectRadar({ store: createRadarStore(admin, orgId), providers, now: () => new Date() });
    console.log(`→ organisation ${orgId} : ${report.accounts} compte(s) relevé(s), ${report.collected} post(s) rangés`);
    for (const skipped of report.skipped) console.log(`    · ${skipped.account} ignoré — ${skipped.reason}`);
    for (const error of report.errors) console.log(`    ⚠ ${error.account} — ${error.message}`);
    failures += report.errors.length;
  }

  const embedder = embedderFromEnv();
  if (embedder) {
    const result = await embedMissing({ admin, embedder });
    console.log(`Vecteurs calculés : ${result.embedded}${result.errors.length ? ` · erreurs : ${result.errors.join(" ; ")}` : ""}`);
  } else {
    console.log("OPENAI_API_KEY absente : pas de vecteurs, le studio rapproche par recoupement lexical.");
  }

  if (failures > 0) process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
