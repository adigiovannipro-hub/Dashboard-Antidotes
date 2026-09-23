/**
 * Publication automatique du Planning, exécutée depuis une machine GitHub.
 *
 *   pnpm publier:planning            — ne publie qu'à 16h heure de Paris
 *   pnpm publier:planning --force    — publie maintenant, quelle que soit l'heure
 *
 * Le passage est greffé sur le workflow `airwallex-sync.yml` : le passage du
 * soir (portée `quotidien`) tombe dans la fenêtre 16h–minuit de Paris, celui
 * du matin (portée `matin`) rattrape quand il y tombe encore — le script
 * regarde l'heure de Paris et ne travaille qu'à partir de 16h, hors fenêtre il
 * coûte une seconde. Les créneaux cron de Vercel sont pleins (Mon travail à
 * 4h, Reporting à 5h) ; la greffe GitHub est gratuite.
 *
 * Comme les synchronisations, `server-only` est neutralisé par la condition
 * `react-server` de Node — nous *sommes* le serveur.
 *
 * Variables requises : NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY, CREDENTIALS_ENCRYPTION_KEY.
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CREDENTIALS_ENCRYPTION_KEY",
] as const;

async function main() {
  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    console.error(`Variables absentes : ${missing.join(", ")}.`);
    process.exit(1);
  }

  const { createAdminClient } = await import("../src/lib/supabase/server");
  const { runScheduledPublishing } = await import("../src/lib/publishing/run");

  const report = await runScheduledPublishing({
    admin: createAdminClient(),
    force: process.argv.includes("--force"),
  });

  if (report.skipped) {
    console.log(report.skipped);
    return;
  }

  console.log(
    `Paris ${report.paris.date} ${report.paris.hour}h — ` +
      `${report.published.length} publiée(s), ${report.errors.length} échec(s), ${report.ignored.length} ignorée(s).`,
  );
  for (const done of report.published) {
    console.log(`  ✓ ${done.subject} → ${done.target}${done.permalink ? ` — ${done.permalink}` : ""}`);
  }
  for (const ignored of report.ignored) {
    console.log(`  · ${ignored.subject} — ${ignored.reason}`);
  }
  for (const failed of report.errors) {
    console.error(`  ✗ ${failed.subject}${failed.target ? ` → ${failed.target}` : ""} — ${failed.error}`);
  }

  // Les échecs sont tracés en base et visibles sur les lignes : le passage
  // lui-même a fait son travail, il sort en succès pour ne pas alerter à vide.
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
